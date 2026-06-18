/* Canonical reference for the transaction-activity endpoints.
 *
 *   GET /managed_accounts/{id}/transactions   (account feed)
 *   GET /managed_cards/{id}/transactions       (card feed)
 *
 * Both share the same envelope shape; only the URL and which transaction
 * `type`s appear differ. Copy this file together with api/activity-types.ts. */

import type { InstrumentTransactions } from './activity-types';
import type { SortOrder } from './types';

const API_VERSION = '2';

export interface ActivityParams {
  offset?: number;
  limit?: number;
  sortOrder?: SortOrder;
}

export class ActivityError extends Error {
  constructor(public readonly status: number, public readonly body: string) {
    super(`Activity request failed with status ${status}`);
    this.name = 'ActivityError';
  }
}

type InstrumentKind = 'managed_accounts' | 'managed_cards';

function buildQueryString(params: ActivityParams): string {
  const qs = new URLSearchParams();
  if (params.offset !== undefined) qs.set('offset', String(params.offset));
  if (params.limit !== undefined) qs.set('limit', String(params.limit));
  if (params.sortOrder) qs.set('sortOrder', params.sortOrder);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

async function fetchTransactions(
  baseUrl: string,
  authToken: string,
  instrument: InstrumentKind,
  instrumentId: string,
  params: ActivityParams,
): Promise<InstrumentTransactions> {
  const url = `${baseUrl}/${instrument}/${instrumentId}/transactions${buildQueryString(params)}`;
  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Accept': 'application/json',
      'api-version': API_VERSION,
    },
  });
  if (!res.ok) throw new ActivityError(res.status, await res.text());
  return (await res.json()) as InstrumentTransactions;
}

export function fetchAccountActivity(
  baseUrl: string,
  authToken: string,
  accountId: string,
  params: ActivityParams,
): Promise<InstrumentTransactions> {
  return fetchTransactions(baseUrl, authToken, 'managed_accounts', accountId, params);
}

export function fetchCardActivity(
  baseUrl: string,
  authToken: string,
  cardId: string,
  params: ActivityParams,
): Promise<InstrumentTransactions> {
  return fetchTransactions(baseUrl, authToken, 'managed_cards', cardId, params);
}
