/* Canonical reference for calling the managed-account statement endpoint.
 *
 * Both functions hit the same URL — only the Accept header differs (application/json
 * vs application/pdf). Copy this file (and src/api/types.ts) into your app, point
 * baseUrl at your OPC base URL, and supply a real Authorization token. */

import type { InstrumentStatement, SortOrder, TransactionType, AccessInstrumentType } from './types';

const API_VERSION = '2';

export interface StatementParams {
  /** Epoch timestamp in milliseconds. */
  startPeriod?: number;
  /** Epoch timestamp in milliseconds. */
  endPeriod?: number;
  offset?: number;
  limit?: number;
  sortOrder?: SortOrder;
  /** Filter by transaction type. Repeatable on the wire (transaction.type=card_payments&transaction.type=fees). */
  transactionType?: TransactionType[];
  executingAccessInstrumentId?: string;
  executingAccessInstrumentType?: AccessInstrumentType[];
}

export class StatementError extends Error {
  constructor(public readonly status: number, public readonly body: string) {
    super(`Statement request failed with status ${status}`);
    this.name = 'StatementError';
  }
}

function buildQueryString(params: StatementParams): string {
  const qs = new URLSearchParams();
  if (params.startPeriod !== undefined) qs.set('startPeriod', String(params.startPeriod));
  if (params.endPeriod !== undefined) qs.set('endPeriod', String(params.endPeriod));
  if (params.offset !== undefined) qs.set('offset', String(params.offset));
  if (params.limit !== undefined) qs.set('limit', String(params.limit));
  if (params.sortOrder) qs.set('sortOrder', params.sortOrder);
  if (params.transactionType) {
    for (const t of params.transactionType) qs.append('transaction.type', t);
  }
  if (params.executingAccessInstrumentId) {
    qs.set('executingAccessInstrument.id', params.executingAccessInstrumentId);
  }
  if (params.executingAccessInstrumentType) {
    for (const t of params.executingAccessInstrumentType) {
      qs.append('executingAccessInstrument.type', t);
    }
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}

function buildUrl(baseUrl: string, managedAccountId: string, params: StatementParams): string {
  return `${baseUrl}/managed_accounts/${managedAccountId}/statement${buildQueryString(params)}`;
}

function commonHeaders(authToken: string, accept: string): HeadersInit {
  return {
    'Authorization': `Bearer ${authToken}`,
    'Accept': accept,
    'api-version': API_VERSION,
  };
}

export async function fetchStatementJson(
  baseUrl: string,
  authToken: string,
  managedAccountId: string,
  params: StatementParams,
): Promise<InstrumentStatement> {
  const res = await fetch(buildUrl(baseUrl, managedAccountId, params), {
    headers: commonHeaders(authToken, 'application/json'),
  });
  if (!res.ok) throw new StatementError(res.status, await res.text());
  return (await res.json()) as InstrumentStatement;
}

export async function fetchStatementPdf(
  baseUrl: string,
  authToken: string,
  managedAccountId: string,
  params: StatementParams,
): Promise<Blob> {
  const res = await fetch(buildUrl(baseUrl, managedAccountId, params), {
    headers: commonHeaders(authToken, 'application/pdf'),
  });
  if (!res.ok) throw new StatementError(res.status, await res.text());
  return res.blob();
}
