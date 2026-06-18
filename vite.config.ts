import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/* Dev-only. Delete this plugin and its registration when adopting in your own app.
 * Serves captured fixtures for the statement and transaction-activity endpoints so
 * the demo runs zero-setup. Statement supports content negotiation (JSON or PDF);
 * the activity endpoints are JSON only. */
function statementMockPlugin(): Plugin {
  const fixturesDir = resolve(__dirname, 'public/fixtures');

  // First matching pattern wins. `pdf` is only set for routes that content-negotiate.
  const routes: Array<{ pattern: RegExp; json: string; pdf?: string }> = [
    { pattern: /^\/managed_accounts\/\d+\/statement$/, json: 'statement.json', pdf: 'statement.pdf' },
    { pattern: /^\/managed_accounts\/\d+\/transactions$/, json: 'activity_account.json' },
    { pattern: /^\/managed_cards\/\d+\/transactions$/, json: 'activity_card.json' },
  ];

  return {
    name: 'statement-mock',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.method !== 'GET' || !req.url) return next();
        // Strip query string before matching the path.
        const path = req.url.split('?')[0];
        const route = routes.find(r => r.pattern.test(path));
        if (!route) return next();

        const accept = String(req.headers.accept ?? '');
        const wantsPdf = accept.includes('application/pdf') && Boolean(route.pdf);
        const fileName = wantsPdf ? route.pdf! : route.json;
        try {
          const body = readFileSync(resolve(fixturesDir, fileName));
          res.setHeader('Content-Type', wantsPdf ? 'application/pdf' : 'application/json');
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
