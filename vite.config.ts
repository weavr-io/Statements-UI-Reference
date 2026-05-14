import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/* Dev-only. Delete this plugin and its registration when adopting in your own app.
 * Intercepts GET /managed_accounts/{id}/statement and serves the captured fixture
 * (JSON or PDF based on the Accept header) so the demo runs zero-setup. */
function statementMockPlugin(): Plugin {
  const fixturesDir = resolve(__dirname, 'public/fixtures');
  return {
    name: 'statement-mock',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.method !== 'GET' || !req.url) return next();
        // Strip query string before matching the path.
        const path = req.url.split('?')[0];
        if (!/^\/managed_accounts\/\d+\/statement$/.test(path)) return next();

        const accept = String(req.headers.accept ?? '');
        const isPdf = accept.includes('application/pdf');
        const fileName = isPdf ? 'statement.pdf' : 'statement.json';
        try {
          const body = readFileSync(resolve(fixturesDir, fileName));
          res.setHeader('Content-Type', isPdf ? 'application/pdf' : 'application/json');
          res.statusCode = 200;
          res.end(body);
        } catch (e) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'text/plain');
          res.end(`statement-mock: failed to read ${fileName}: ${(e as Error).message}`);
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), statementMockPlugin()],
});
