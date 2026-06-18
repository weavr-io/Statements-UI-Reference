interface Props {
  error: unknown;
}

/* Both StatementError and ActivityError carry { status: number, body: string }.
 * Recognize that shape structurally rather than coupling to one class. */
function statusAndBody(error: unknown): { status?: number; body: string } {
  if (
    error !== null &&
    typeof error === 'object' &&
    'status' in error &&
    typeof (error as { status: unknown }).status === 'number' &&
    'body' in error &&
    typeof (error as { body: unknown }).body === 'string'
  ) {
    const e = error as { status: number; body: string };
    return { status: e.status, body: e.body };
  }
  if (error instanceof Error) return { body: error.message };
  return { body: String(error) };
}

export function ErrorBanner({ error }: Props) {
  const { status, body } = statusAndBody(error);
  return (
    <div className="error-banner" role="alert">
      <strong>Request failed{status !== undefined ? ` (${status})` : ''}.</strong>
      {body && <pre>{body}</pre>}
    </div>
  );
}
