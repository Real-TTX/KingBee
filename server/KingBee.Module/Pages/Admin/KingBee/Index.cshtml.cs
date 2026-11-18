using KingBee.Module.Multiplayer;
using MatGame.Sdk;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace KingBee.Module.Pages.Admin.KingBee;

/// <summary>The online rooms of King Bee right now (read only: they live in memory and end with their players).</summary>
[Authorize(Policy = GameAccounts.AdminPolicy)]
public sealed class IndexModel(RoomManager rooms) : PageModel
{
    public sealed record RoomRow(string Code, bool Playing, string Map, IReadOnlyList<SeatView> Seats, int Players, DateTime CreatedUtc);

    public IReadOnlyList<RoomRow> Rooms { get; private set; } = [];

    public void OnGet()
    {
        Rooms = rooms.Rooms
            .Select(r =>
            {
                lock (r.Sync)
                {
                    return new RoomRow(r.Code, r.Playing, r.Settings.Map, r.ToView().Seats, r.Humans.Count(), r.CreatedUtc);
                }
            })
            .OrderByDescending(r => r.Playing)
            .ThenBy(r => r.Code)
            .ToList();
    }

    /// <summary>German name of a seat for the table.</summary>
    public string SeatText(SeatView seat) => seat.Type switch
    {
        SeatType.Human => (seat.Name ?? "Biene") + (seat.IsHost ? " (Gastgeber)" : string.Empty) + (seat.Left ? " · getrennt" : string.Empty),
        SeatType.Ai => "KI",
        SeatType.Open => "frei",
        _ => "Wildbienen",
    };
}
