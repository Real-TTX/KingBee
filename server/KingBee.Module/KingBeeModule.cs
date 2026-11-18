using System.Reflection;
using KingBee.Module.Multiplayer;
using MatGame.Sdk;
using Microsoft.AspNetCore.Hosting;

namespace KingBee.Module;

/// <summary>
/// King Bee in MatGame. The game runs in the browser (deterministic lockstep simulation, src/game); the server only keeps the online lobbies and relays
/// the arrow inputs in fixed frames. No database: rooms live in memory. Routes below <c>/kingbee</c>:
/// <list type="bullet">
/// <item><c>/kingbee/</c> the web client (the Vite build in wwwroot, served as static web assets with the base path <c>kingbee</c>),
/// every extension-less path below falls back to its <c>index.html</c>,</item>
/// <item><c>/kingbee/hub</c> the SignalR hub (needs a session of the master: account or guest),</item>
/// <item><c>/kingbee/api/info</c> the numbers of the server (rooms, players) for the about box.</item>
/// </list>
/// </summary>
public sealed class KingBeeModule : IGameModule
{
    /// <summary>The informational version of this plugin (Directory.Build.props).</summary>
    public static readonly string Version =
        typeof(KingBeeModule).Assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion ?? "local";

    /// <summary>Who King Bee is (also used by the hub's version check).</summary>
    public static readonly GameInfo Game = new(
        Id: "kingbee",
        Name: "King Bee",
        Tagline: "Lenke den Schwarm mit drei Pfeilen in deinen Stock – und schick die Hornissen zur Konkurrenz.",
        Version: Version,
        Protocol: 1,
        MinClient: null,
        Accent: "#f29200",
        Cover: "img/cover.png",
        Icon: "img/icon.svg");

    public GameInfo Info => Game;

    public IReadOnlyList<AdminLink> Admin { get; } = [new("Räume", "/Admin/KingBee", "users")];

    public void AddServices(IServiceCollection services, GameEnvironment environment)
    {
        services.AddSignalR();
        services.AddSingleton<RoomManager>();
        services.AddHostedService<FrameLoop>();
    }

    public void MapGame(IEndpointRouteBuilder game, GameEnvironment environment)
    {
        game.MapHub<GameHub>("/hub").RequireAuthorization(GameAccounts.AnyScheme).RequireCors(MatGameProtocol.AppCorsPolicy);

        var api = game.MapGroup("/api").ForGame(Game);
        api.MapGet("/info", (RoomManager rooms) =>
        {
            var (players, playing, count) = Count(rooms);
            return Results.Ok(new { game = Game.Id, version = Version, rooms = count, playing, players });
        }).AllowAnonymous();

        // the web client: "/kingbee" → "/kingbee/" (the build's addresses are absolute below /kingbee/), every page address → index.html
        var basePath = environment.BasePath;
        game.MapGet("/", (HttpContext http, IWebHostEnvironment web) =>
        {
            var path = http.Request.Path.Value ?? string.Empty;
            if (!path.EndsWith('/'))
            {
                return Results.Redirect($"{basePath}/{http.Request.QueryString}");
            }

            return Index(web);
        }).AllowAnonymous();
        game.MapGet("/{**path}", (string? path, IWebHostEnvironment web) =>
            Path.HasExtension(path ?? string.Empty) ? Results.NotFound() : Index(web)).AllowAnonymous();
    }

    public Task StartAsync(IServiceProvider services, CancellationToken ct) => Task.CompletedTask;

    public Task<GameStats> StatsAsync(IServiceProvider services, CancellationToken ct)
    {
        var (players, playing, _) = Count(services.GetRequiredService<RoomManager>());
        return Task.FromResult(new GameStats(players, playing));
    }

    /// <summary>No progression online yet (puzzles and wins are kept in the browser).</summary>
    public Task<GameProfile?> ProfileAsync(IServiceProvider services, long accountId, CancellationToken ct) => Task.FromResult<GameProfile?>(null);

    /// <summary>Nothing is stored per account.</summary>
    public Task AccountDeletedAsync(IServiceProvider services, long accountId, CancellationToken ct) => Task.CompletedTask;

    private static (int Players, int Playing, int Rooms) Count(RoomManager rooms)
    {
        int players = 0, playing = 0, count = 0;
        foreach (var room in rooms.Rooms)
        {
            lock (room.Sync)
            {
                count++;
                players += room.Humans.Count();
                if (room.Playing)
                {
                    playing++;
                }
            }
        }

        return (players, playing, count);
    }

    private static IResult Index(IWebHostEnvironment web)
    {
        var file = web.WebRootFileProvider.GetFileInfo("kingbee/index.html");
        if (!file.Exists)
        {
            return Results.Text("King Bee ist noch nicht gebaut (npm run build).", "text/plain; charset=utf-8", statusCode: StatusCodes.Status503ServiceUnavailable);
        }

        // never cached: a new release must not mix the new page with old assets (the assets themselves carry a hash)
        return new NoCache(Results.Stream(file.CreateReadStream(), "text/html; charset=utf-8"));
    }

    /// <summary>Sends index.html with <c>Cache-Control: no-cache</c>.</summary>
    private sealed class NoCache(IResult inner) : IResult
    {
        public Task ExecuteAsync(HttpContext httpContext)
        {
            httpContext.Response.Headers.CacheControl = "no-cache";
            return inner.ExecuteAsync(httpContext);
        }
    }
}
