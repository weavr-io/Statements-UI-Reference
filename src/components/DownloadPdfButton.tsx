import { useState } from 'react';
import { fetchStatementPdf, type StatementParams } from '../api/statements';

interface Props {
  baseUrl: string;
  authToken: string;
  accountId: string;
  params: StatementParams;
}

export function DownloadPdfButton({ baseUrl, authToken, accountId, params }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function onClick() {
    setBusy(true);
    setError(null);
    try {
      const blob = await fetchStatementPdf(baseUrl, authToken, accountId, params);
      // Blob → object URL → invisible anchor → click → revoke. This dance is the standard
      // browser pattern for triggering a download from a Blob obtained via fetch.
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `statement-${accountId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="download-pdf">
      <button type="button" onClick={onClick} disabled={busy}>
        <svg className="btn-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        {busy ? 'Preparing PDF…' : 'Download PDF'}
      </button>
      {error !== null && (
        <span className="download-error">
          {error instanceof Error ? error.message : String(error)}
        </span>
      )}
    </div>
  );
}
