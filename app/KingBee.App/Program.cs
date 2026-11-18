using System.Reflection;
using MatGame.Shell;

namespace KingBee.App;

internal static class Program
{
    [STAThread]
    private static int Main(string[] args) => ShellApp.Run(args, new ShellOptions
    {
        GameId = "kingbee",
        Title = "King Bee",
        DefaultServer = typeof(Program).Assembly.GetCustomAttributes<AssemblyMetadataAttribute>().FirstOrDefault(a => a.Key == "MatGameDefaultServer")?.Value,
        Repository = "Real-TTX/KingBee",
        Background = Color.FromArgb(0x2b, 0x1d, 0x05),
    });
}
