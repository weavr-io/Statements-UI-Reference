import { config } from './config';
import { StatementView } from './components/StatementView';

export function App() {
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
        <StatementView
          baseUrl={config.baseUrl}
          authToken={config.authToken}
          accountId={config.accountId}
          params={config.params}
        />
      </main>
    </div>
  );
}
