import type { StatementParams } from './api/statements';

/* 👉 Replace baseUrl with your OPC base URL (e.g. 'https://api.weavr.io/multi') when wiring
 * this demo to your own backend. The empty default routes the request through the dev-only
 * mock middleware in vite.config.ts.
 *
 * 👉 Replace authToken with a real Authorization bearer token.
 * 👉 Replace accountId with a real managed account id from your environment. */
export interface DemoConfig {
  baseUrl: string;
  authToken: string;
  accountId: string;
  params: StatementParams;
}

export const config: DemoConfig = {
  baseUrl: '',
  authToken: 'demo-token',
  accountId: '123456',
  params: {
    startPeriod: Date.UTC(2026, 4, 1),  // 2026-05-01 UTC
    endPeriod:   Date.UTC(2026, 4, 31), // 2026-05-31 UTC
    limit: 50,
    sortOrder: 'DESC',
  },
};
