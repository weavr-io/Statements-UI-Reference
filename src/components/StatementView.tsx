import { useEffect, useState } from 'react';
import { fetchStatementJson, StatementError, type StatementParams } from '../api/statements';
import type { InstrumentStatement } from '../api/types';
import { StatementSummary } from './StatementSummary';
import { EntriesTable } from './EntriesTable';
import { DownloadPdfButton } from './DownloadPdfButton';
import { ErrorBanner } from './ErrorBanner';

interface Props {
  baseUrl: string;
  authToken: string;
  accountId: string;
  params: StatementParams;
}

type ViewState =
  | { kind: 'loading' }
  | { kind: 'ready'; statement: InstrumentStatement }
  | { kind: 'error'; error: StatementError | Error };

export function StatementView({ baseUrl, authToken, accountId, params }: Props) {
  const [state, setState] = useState<ViewState>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setState({ kind: 'loading' });
    fetchStatementJson(baseUrl, authToken, accountId, params)
      .then(statement => { if (!cancelled) setState({ kind: 'ready', statement }); })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof Error) setState({ kind: 'error', error });
        else setState({ kind: 'error', error: new Error(String(error)) });
      });
    return () => { cancelled = true; };
  }, [baseUrl, authToken, accountId, params]);

  if (state.kind === 'loading') return <p className="loading">Loading statement…</p>;
  if (state.kind === 'error') return <ErrorBanner error={state.error} />;

  return (
    <article className="statement">
      <header className="statement-header">
        <div className="statement-eyebrow">
          <span className="eyebrow-dot" aria-hidden="true" />
          Statement
        </div>
        <DownloadPdfButton
          baseUrl={baseUrl}
          authToken={authToken}
          accountId={accountId}
          params={params}
        />
      </header>
      <StatementSummary
        statement={state.statement}
        accountId={accountId}
        period={{ startPeriod: params.startPeriod, endPeriod: params.endPeriod }}
      />
      <EntriesTable entries={state.statement.entries ?? []} />
      {state.statement.footer && (
        <footer className="statement-footer">{state.statement.footer}</footer>
      )}
    </article>
  );
}
