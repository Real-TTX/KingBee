using System.Collections.Concurrent;
using System.Security.Cryptography;

namespace KingBee.Server.Multiplayer;

/// <summary>Seat state of one of the four hives in a room.</summary>
public static class SeatType
{
    public const string Human = "human";
    public const string Ai = "ai";
    public const string Open = "open";     // free for a joining player (wild bees if nobody joins)
    public const string Closed = "closed"; // nobody joins, wild bees
}

public sealed record RoomSettings(string Map, string Difficulty, int TimeLimit, int Target, string? Events = "normal")
{
    public static RoomSettings Default { get; } = new("wiese", "normal", 180, 150, "normal");

    public RoomSettings Sanitize() => new(
        string.IsNullOrWhiteSpace(Map) ? "wiese" : Map.Trim()[..Math.Min(Map.Trim().Length, 32)],
        Difficulty is "easy" or "normal" or "hard" ? Difficulty : "normal",
        Math.Clamp(TimeLimit, 60, 600),
        Math.Clamp(Target, 50, 500),
        Events is "off" or "rare" or "normal" or "often" or "chaos" ? Events : "normal");
}

public sealed class Seat
{
    public string Type { get; set; } = SeatType.Open;
    public string? ConnectionId { get; set; }
    public string? Name { get; set; }
    public bool Left { get; set; } // player disconnected during a running game
}

public sealed record SeatView(string Type, string? Name, string? Id, bool IsHost, bool Left);

public sealed record RoomView(string Code, string State, RoomSettings Settings, SeatView[] Seats);

public sealed record RoomSummary(string Code, string Host, int Players, int FreeSeats, string Map);

public sealed record GameStart(int Seed, RoomSettings Settings, string[] Slots, string[] Names);

/// <summary>One lobby / running match. All mutation happens under <see cref="Sync"/>.</summary>
public sealed class Room
{
    public const int MaxInputsPerFrame = 16;

    public object Sync { get; } = new();
    public required string Code { get; init; }
    public Seat[] Seats { get; } = Enumerable.Range(0, 4).Select(_ => new Seat()).ToArray();
    public RoomSettings Settings { get; set; } = RoomSettings.Default;
    public string? HostId { get; set; }
    public bool Playing { get; set; }
    public int Frame { get; set; }
    public int MaxFrames { get; set; }
    public List<int[]> PendingInputs { get; } = [];
    public Dictionary<int, int> InputsThisFrame { get; } = [];
    public Dictionary<int, int> Hashes { get; } = [];
    public DateTime CreatedUtc { get; } = DateTime.UtcNow;

    public string GroupName => $"room:{Code}";

    public int SeatOf(string connectionId) =>
        Array.FindIndex(Seats, s => s.Type == SeatType.Human && s.ConnectionId == connectionId);

    public IEnumerable<Seat> Humans => Seats.Where(s => s.Type == SeatType.Human && !s.Left);

    public RoomView ToView() => new(
        Code,
        Playing ? "playing" : "lobby",
        Settings,
        Seats.Select(s => new SeatView(s.Type, s.Name, s.ConnectionId, s.ConnectionId != null && s.ConnectionId == HostId, s.Left)).ToArray());

    public RoomSummary ToSummary() => new(
        Code,
        Seats.FirstOrDefault(s => s.ConnectionId == HostId)?.Name ?? "?",
        Humans.Count(),
        Seats.Count(s => s.Type == SeatType.Open),
        Settings.Map);
}

/// <summary>Keeps track of all rooms and which connection sits in which room.</summary>
public sealed class RoomManager
{
    private const string CodeChars = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    private readonly ConcurrentDictionary<string, Room> _rooms = new();
    private readonly ConcurrentDictionary<string, string> _roomOfConnection = new();

    public IEnumerable<Room> Rooms => _rooms.Values;

    public Room? Get(string code) => _rooms.TryGetValue(code.Trim().ToUpperInvariant(), out var r) ? r : null;

    public Room? RoomOf(string connectionId) =>
        _roomOfConnection.TryGetValue(connectionId, out var code) ? Get(code) : null;

    public Room Create()
    {
        while (true)
        {
            var code = string.Concat(Enumerable.Range(0, 4).Select(_ => CodeChars[RandomNumberGenerator.GetInt32(CodeChars.Length)]));
            var room = new Room { Code = code };
            if (_rooms.TryAdd(code, room)) return room;
        }
    }

    public void Bind(string connectionId, Room room) => _roomOfConnection[connectionId] = room.Code;

    public void Unbind(string connectionId) => _roomOfConnection.TryRemove(connectionId, out _);

    public void RemoveIfEmpty(Room room)
    {
        lock (room.Sync)
        {
            if (room.Humans.Any()) return;
        }
        _rooms.TryRemove(room.Code, out _);
    }

    public static string CleanName(string? name)
    {
        var n = (name ?? "").Trim();
        if (n.Length == 0) n = "Biene";
        return n.Length > 16 ? n[..16] : n;
    }
}
