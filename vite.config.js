import { defineConfig } from 'vite';

// During development the ASP.NET Core server (dotnet run, port 5080) can run
// next to Vite; API and future SignalR hub calls are proxied to it.
export default defineConfig({
  server: {
    proxy: {
      '/api': 'http://localhost:5080',
      '/hubs': { target: 'http://localhost:5080', ws: true },
    },
  },
});
