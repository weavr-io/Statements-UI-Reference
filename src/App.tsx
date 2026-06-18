import { useState } from 'react';
import { config } from './config';
import { StatementView } from './components/StatementView';
import { ActivityView } from './components/ActivityView';
import { ViewSwitcher, type ViewMode, type ActivityInstrument } from './components/ViewSwitcher';

export function App() {
  const [mode, setMode] = useState<ViewMode>('statement');
  const [instrument, setInstrument] = useState<ActivityInstrument>('account');

  return (
    <div className="app-shell">
      <header className="page-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">W</span>
          <span className="brand-name">Weavr</span>
          <span className="brand-divider" aria-hidden="true" />
          <span className="brand-tag">Statements API · Embedder reference</span>
        </div>
      </header>
      <main className="app">
        <ViewSwitcher
          mode={mode}
          instrument={instrument}
          onModeChange={setMode}
          onInstrumentChange={setInstrument}
        />
        {mode === 'statement' ? (
          <StatementView
            baseUrl={config.baseUrl}
            authToken={config.authToken}
            accountId={config.accountId}
            params={config.params}
          />
        ) : (
          <ActivityView
            baseUrl={config.baseUrl}
            authToken={config.authToken}
            instrument={instrument}
            accountId={config.accountId}
            cardId={config.cardId}
            params={config.activityParams}
          />
        )}
      </main>
    </div>
  );
}
