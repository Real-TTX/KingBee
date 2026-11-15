using System.Security.Cryptography;
using Microsoft.AspNetCore.SignalR;

namespace KingBee.Server.Multiplayer;

/// <summary>
/// Lobby + lockstep relay. The server does not simulate the game: it collects
/// arrow inputs and broadcasts them in fixed frames (see <see cref="FrameLoop"/>).
/// All clients run the same deterministic simulation from the same seed.
///
/// Server -> client messages: "Room" (RoomView), "GameStart" (GameStart),
/// "Frame" (frame, inputs), "Desync" (frame), "PlayerLeft" (seat, name).
/// </summary>
public sealed class GameHub(RoomManager rooms, ILogger<GameHub> log) : Hub
{
    private string Me => Context.ConnectionId;

    public RoomSummary[] ListRooms() =>
        rooms.Rooms
            .Select(r => { lock (r.Sync) return r.Playing ? null : r.ToSummary(); })
            .Where(s => s is { FreeSeats: > 0 })
            .Select(s => s!)
            .OrderBy(s => s.Code)
            .ToArray();

    public async Task<RoomView> CreateRoom(string name)
    {
        await LeaveRoom();
        var room = rooms.Create();
        RoomView view;
        lock (room.Sync)
        {
            var seat = room.Seats[0];
            seat.Type = SeatType.Human;
            seat.ConnectionId = Me;
            seat.Name = RoomManager.CleanName(name);
            room.HostId = Me;
            view = room.ToView();
        }
        rooms.Bind(Me, room);
        await Groups.AddToGroupAsync(Me, room.GroupName);
        log.LogInformation("Room {Code} created by {Name}", room.Code, name);
        return view;
    }

    public async Task<RoomView> JoinRoom(string code, string name)
    {
        var room = rooms.Get(code ?? "") ?? throw new HubException("Diesen Raum gibt es nicht.");
        if (rooms.RoomOf(Me) is { } current && current.Code != room.Code) await LeaveRoom();
        RoomView view;
        lock (room.Sync)
        {
            if (room.Playing) throw new HubException("In diesem Raum läuft gerade ein Spiel.");
            if (room.SeatOf(Me) < 0)
            {
                var seat = room.Seats.FirstOrDefault(s => s.Type == SeatType.Open)
                    ?? throw new HubException("Der Raum ist voll.");
                seat.Type = SeatType.Human;
                seat.ConnectionId = Me;
                seat.Name = RoomManager.CleanName(name);
            }
            view = room.ToView();
        }
        rooms.Bind(Me, room);
        await Groups.AddToGroupAsync(Me, room.GroupName);
        await Clients.Group(room.GroupName).SendAsync("Room", view);
        return view;
    }

    public async Task LeaveRoom()
    {
        var room = rooms.RoomOf(Me);
        if (room is null) return;
        rooms.Unbind(Me);
        await Groups.RemoveFromGroupAsync(Me, room.GroupName);
        await RemoveFromRoom(room, Me);
    }

    public async Task UpdateRoom(RoomSettings settings)
    {
        var room = HostRoom();
        RoomView view;
        lock (room.Sync)
        {
            if (room.Playing) return;
            room.Settings = settings.Sanitize();
            view = room.ToView();
        }
        await Clients.Group(room.GroupName).SendAsync("Room", view);
    }

    /// <summary>Host sets an empty seat to open / ai / closed.</summary>
    public async Task SetSeat(int seat, string type)
    {
        var room = HostRoom();
        if (seat is < 0 or > 3 || type is not (SeatType.Open or SeatType.Ai or SeatType.Closed)) return;
        RoomView view;
        lock (room.Sync)
        {
            var s = room.Seats[seat];
            if (room.Playing || s.Type == SeatType.Human) return;
            s.Type = type;
            view = room.ToView();
        }
        await Clients.Group(room.GroupName).SendAsync("Room", view);
    }

    /// <summary>A player moves to another free seat (= other hive / colour).</summary>
    public async Task MoveToSeat(int seat)
    {
        var room = rooms.RoomOf(Me) ?? throw new HubException("Du bist in keinem Raum.");
        if (seat is < 0 or > 3) return;
        RoomView view;
        lock (room.Sync)
        {
            var from = room.SeatOf(Me);
            var target = room.Seats[seat];
            if (room.Playing || from < 0 || target.Type == SeatType.Human) return;
            var old = room.Seats[from];
            (target.Type, target.ConnectionId, target.Name) = (SeatType.Human, old.ConnectionId, old.Name);
            (old.Type, old.ConnectionId, old.Name) = (SeatType.Open, null, null);
            view = room.ToView();
        }
        await Clients.Group(room.GroupName).SendAsync("Room", view);
    }

    public async Task StartGame()
    {
        var room = HostRoom();
        GameStart start;
        RoomView view;
        lock (room.Sync)
        {
            if (room.Playing) return;
            var slots = room.Seats.Select(s => s.Type switch
            {
                SeatType.Human => "human",
                SeatType.Ai => "ai",
                _ => "wild",
            }).ToArray();
            var names = room.Seats.Select(s => s.Type == SeatType.Human ? s.Name ?? "Biene" : "").ToArray();
            start = new GameStart(RandomNumberGenerator.GetInt32(1, int.MaxValue), room.Settings, slots, names);
            room.Playing = true;
            room.Frame = 0;
            // countdown (3 s) + time limit + generous margin, 20 frames per second
            room.MaxFrames = (room.Settings.TimeLimit + 3) * 20 + 400;
            room.PendingInputs.Clear();
            room.Hashes.Clear();
            view = room.ToView();
        }
        log.LogInformation("Room {Code} starts a game on {Map}", room.Code, start.Settings.Map);
        await Clients.Group(room.GroupName).SendAsync("Room", view);
        await Clients.Group(room.GroupName).SendAsync("GameStart", start);
    }

    /// <summary>Arrow input [kind, x, y, dir]; the server adds the seat and queues it for the next frame.</summary>
    public void Input(int[] input)
    {
        if (input is not { Length: 4 }) return;
        var room = rooms.RoomOf(Me);
        if (room is null) return;
        lock (room.Sync)
        {
            if (!room.Playing) return;
            var seat = room.SeatOf(Me);
            if (seat < 0) return;
            room.InputsThisFrame.TryGetValue(seat, out var n);
            if (n >= Room.MaxInputsPerFrame) return;
            room.InputsThisFrame[seat] = n + 1;
            room.PendingInputs.Add([seat, input[0], input[1], input[2], input[3]]);
        }
    }

    /// <summary>Clients report a checksum every few frames; mismatches are broadcast.</summary>
    public async Task ReportHash(int frame, int hash)
    {
        var room = rooms.RoomOf(Me);
        if (room is null) return;
        bool desync;
        lock (room.Sync)
        {
            if (!room.Playing) return;
            if (!room.Hashes.TryGetValue(frame, out var known))
            {
                room.Hashes[frame] = hash;
                if (room.Hashes.Count > 64) room.Hashes.Remove(room.Hashes.Keys.Min());
                return;
            }
            desync = known != hash;
        }
        if (desync)
        {
            log.LogWarning("Desync in room {Code} at frame {Frame}", room.Code, frame);
            await Clients.Group(room.GroupName).SendAsync("Desync", frame);
        }
    }

    /// <summary>The deterministic game ended on the clients; room goes back to the lobby.</summary>
    public async Task ReportGameOver()
    {
        var room = rooms.RoomOf(Me);
        if (room is null) return;
        if (EndGame(room)) await Clients.Group(room.GroupName).SendAsync("Room", room.ToView());
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        await LeaveRoom();
        await base.OnDisconnectedAsync(exception);
    }

    // ------------------------------------------------------------------ helpers

    internal static bool EndGame(Room room)
    {
        lock (room.Sync)
        {
            if (!room.Playing) return false;
            room.Playing = false;
            foreach (var s in room.Seats.Where(s => s.Left))
            {
                (s.Type, s.ConnectionId, s.Name, s.Left) = (SeatType.Open, null, null, false);
            }
            return true;
        }
    }

    private Room HostRoom()
    {
        var room = rooms.RoomOf(Me) ?? throw new HubException("Du bist in keinem Raum.");
        lock (room.Sync)
        {
            if (room.HostId != Me) throw new HubException("Nur der Gastgeber kann das ändern.");
        }
        return room;
    }

    private async Task RemoveFromRoom(Room room, string connectionId)
    {
        RoomView view;
        int seatIndex;
        string? name;
        lock (room.Sync)
        {
            seatIndex = room.SeatOf(connectionId);
            if (seatIndex < 0) return;
            var seat = room.Seats[seatIndex];
            name = seat.Name;
            if (room.Playing)
            {
                seat.Left = true; // keep the hive in the running game
            }
            else
            {
                (seat.Type, seat.ConnectionId, seat.Name) = (SeatType.Open, null, null);
            }
            if (room.HostId == connectionId)
            {
                room.HostId = room.Humans.FirstOrDefault(s => s.ConnectionId != connectionId)?.ConnectionId;
            }
            view = room.ToView();
        }
        if (view.State == "playing")
        {
            await Clients.Group(room.GroupName).SendAsync("PlayerLeft", seatIndex, name);
        }
        await Clients.Group(room.GroupName).SendAsync("Room", view);
        rooms.RemoveIfEmpty(room);
    }
}
