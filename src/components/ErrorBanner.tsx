import { StatementError } from '../api/statements';

interface Props {
  error: unknown;
}

export function ErrorBanner({ error }: Props) {
  const status = error instanceof StatementError ? error.status : undefined;
  const body = error instanceof StatementError ? error.body : (error instanceof Error ? error.message : String(error));
  return (
    <div className="error-banner" role="alert">
      <strong>Request failed{status !== undefined ? ` (${status})` : ''}.</strong>
      {body && <pre>{body}</pre>}
    </div>
  );
}
