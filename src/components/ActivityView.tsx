import { useEffect, useState } from 'react';
import { fetchAccountActivity, fetchCardActivity, type ActivityParams } from '../api/activity';
import type { InstrumentTransactions } from '../api/activity-types';
import { ActivitySummary } from './ActivitySummary';
import { ActivityTable } from './ActivityTable';
import { ErrorBanner } from './ErrorBanner';
import { deriveSelfInstrumentId } from '../activity-display';

export type ActivityInstrument = 'account' | 'card';

interface Props {
  baseUrl: string;
  authToken: string;
  instrument: ActivityInstrument;
  accountId: string;
  cardId: string;
  params: ActivityParams;
}

type ViewState =
  | { kind: 'loading' }
  | { kind: 'ready'; data: InstrumentTransactions }
  | { kind: 'error'; error: Error };

export function ActivityView({ baseUrl, authToken, instrument, accountId, cardId, params }: Props) {
  const [state, setState] = useState<ViewState>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setState({ kind: 'loading' });
    const request = instrument === 'card'
      ? fetchCardActivity(baseUrl, authToken, cardId, params)
      : fetchAccountActivity(baseUrl, authToken, accountId, params);
    request
      .then(data => { if (!cancelled) setState({ kind: 'ready', data }); })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({ kind: 'error', error: error instanceof Error ? error : new Error(String(error)) });
      });
    return () => { cancelled = true; };
  }, [baseUrl, authToken, instrument, accountId, cardId, params]);

  if (state.kind === 'loading') return <p className="loading">Loading activity…</p>;
  if (state.kind === 'error') return <ErrorBanner error={state.error} />;

  const { data } = state;
  const instrumentLabel = instrument === 'card' ? 'Card' : 'Account';
  const instrumentType = instrument === 'card' ? 'managed_cards' : 'managed_accounts';
  // Prefer the real instrument id recovered from the response; fall back to config.
  const instrumentId = deriveSelfInstrumentId(data.transactions, instrumentType)
    ?? (instrument === 'card' ? cardId : accountId);

  return (
    <article className="statement">
      <header className="statement-header">
        <div className="statement-eyebrow">
          <span className="eyebrow-dot" aria-hidden="true" />
          {instrumentLabel} activity
        </div>
      </header>
      <ActivitySummary
        transactions={data.transactions}
        count={data.count}
        responseCount={data.responseCount}
        instrumentLabel={instrumentLabel}
        instrumentId={instrumentId}
      />
      <ActivityTable transactions={data.transactions} />
    </article>
  );
}
