using Microsoft.AspNetCore.SignalR;

namespace KingBee.Server.Multiplayer;

/// <summary>
/// The lockstep clock: every 50 ms each running room gets a "Frame" message
/// with the inputs collected since the previous frame.
/// </summary>
public sealed class FrameLoop(RoomManager rooms, IHubContext<GameHub> hub, ILogger<FrameLoop> log) : BackgroundService
{
    public static readonly TimeSpan Interval = TimeSpan.FromMilliseconds(50);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(Interval);
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            foreach (var room in rooms.Rooms)
            {
                int frame;
                int[][] inputs;
                bool timeUp;
                lock (room.Sync)
                {
                    if (!room.Playing) continue;
                    frame = room.Frame++;
                    inputs = room.PendingInputs.ToArray();
                    room.PendingInputs.Clear();
                    room.InputsThisFrame.Clear();
                    timeUp = room.Frame > room.MaxFrames || !room.Humans.Any();
                }
                try
                {
                    await hub.Clients.Group(room.GroupName).SendAsync("Frame", frame, inputs, stoppingToken);
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    log.LogWarning(ex, "Sending frame to room {Code} failed", room.Code);
                }
                if (timeUp && GameHub.EndGame(room))
                {
                    await hub.Clients.Group(room.GroupName).SendAsync("Room", room.ToView(), stoppingToken);
                    rooms.RemoveIfEmpty(room);
                }
            }
        }
    }
}
