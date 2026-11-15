// KingBee game server.
// - serves the built browser game (wwwroot)
// - /hubs/game: SignalR hub for online lobbies + lockstep multiplayer
// - /api/health: health check

using KingBee.Server.Multiplayer;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSignalR();
builder.Services.AddSingleton<RoomManager>();
builder.Services.AddHostedService<FrameLoop>();

var app = builder.Build();

app.UseDefaultFiles();
app.UseStaticFiles(new StaticFileOptions
{
    OnPrepareResponse = ctx =>
    {
        // Vite emits content-hashed files under /assets -> cache forever.
        if (ctx.Context.Request.Path.StartsWithSegments("/assets"))
        {
            ctx.Context.Response.Headers.CacheControl = "public, max-age=31536000, immutable";
        }
    },
});

app.MapGet("/api/health", (RoomManager rooms) => Results.Ok(new
{
    status = "ok",
    game = "KingBee",
    rooms = rooms.Rooms.Count(),
}));

app.MapHub<GameHub>("/hubs/game");

// Single-page app: unknown non-API routes fall back to the game.
app.MapFallbackToFile("index.html");

app.Run();
