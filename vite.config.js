import { defineConfig } from 'vite';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

/** Commit of this build: GIT_SHA (CI / Docker build-arg) or the local checkout. */
function gitSha() {
  if (process.env.GIT_SHA) return process.env.GIT_SHA.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return 'dev';
  }
}

// King Bee is a MatGame plugin: the client lives at /kingbee/ on the master and at the same path in the app shell
// (https://kingbee.matgame.app/kingbee/). The build goes into the plugin's wwwroot (static web assets, base path "kingbee").
// During development the MatGame local stack (http://localhost:2770, ../MatGame/scripts/redeploy.ps1) answers the hub and the host API.
const MASTER = process.env.MATGAME_DEV_SERVER || 'http://localhost:2770';

export default defineConfig({
  base: '/kingbee/',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_SHA__: JSON.stringify(gitSha()),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
  },
  plugins: [
    {
      // the MatGame SDK reads the game and its version from these meta tags in the browser (sdk/js/host.js)
      name: 'kingbee-version-meta',
      transformIndexHtml: (html) => html.replace('%KINGBEE_VERSION%', pkg.version),
    },
  ],
  build: {
    outDir: 'server/KingBee.Module/wwwroot',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/kingbee/hub': { target: MASTER, ws: true, changeOrigin: true },
      '/kingbee/api': { target: MASTER, changeOrigin: true },
      '/api/matgame': { target: MASTER, changeOrigin: true },
    },
  },
});
