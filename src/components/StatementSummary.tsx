import type {
  InstrumentStatement,
  StatementEntry,
  TransactionType,
  CurrencyAmount,
} from '../api/types';
import { formatMoney } from '../format';
import { TRANSACTION_TYPE_LABEL, categoryTone } from '../labels';

interface Props {
  statement: InstrumentStatement;
  accountId: string;
  period: { startPeriod?: number; endPeriod?: number };
}

interface Totals {
  in: CurrencyAmount;
  out: CurrencyAmount;
  fees: CurrencyAmount;
}

function totals(entries: StatementEntry[], currency: string): Totals {
  let inAmount = 0;
  let outAmount = 0;
  let feeAmount = 0;
  for (const e of entries) {
    const a = e.balanceAdjustment.amount;
    if (a > 0) inAmount += a;
    else if (a < 0) outAmount += -a;
    if (e.fee) feeAmount += e.fee.amount.amount;
  }
  return {
    in: { currency, amount: inAmount },
    out: { currency, amount: outAmount },
    fees: { currency, amount: feeAmount },
  };
}

function typeBreakdown(entries: StatementEntry[]): Array<{ type: TransactionType; count: number }> {
  const counts = new Map<TransactionType, number>();
  for (const e of entries) counts.set(e.transaction.type, (counts.get(e.transaction.type) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => ({ type, count }));
}

function formatPeriod(period: { startPeriod?: number; endPeriod?: number }): string {
  if (period.startPeriod === undefined || period.endPeriod === undefined) return '—';
  const fmt = (ms: number) => new Date(ms).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  return `${fmt(period.startPeriod)} – ${fmt(period.endPeriod)}`;
}

export function StatementSummary({ statement, accountId, period }: Props) {
  const entries = statement.entries ?? [];
  const currency = statement.closingBalance?.currency
    ?? statement.openingBalance?.currency
    ?? 'EUR';
  const t = totals(entries, currency);
  const breakdown = typeBreakdown(entries);

  return (
    <section className="summary">
      <div className="hero">
        <div className="hero-label">Closing balance</div>
        <div className="hero-value">
          {statement.closingBalance ? formatMoney(statement.closingBalance) : '—'}
        </div>
        <div className="hero-period">{formatPeriod(period)}</div>
      </div>

      <div className="stat-strip">
        <div className="stat stat-credit">
          <div className="stat-label">Money in</div>
          <div className="stat-value">{formatMoney(t.in)}</div>
        </div>
        <div className="stat stat-debit">
          <div className="stat-label">Money out</div>
          <div className="stat-value">{formatMoney(t.out)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Total fees</div>
          <div className="stat-value">{formatMoney(t.fees)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Opening balance</div>
          <div className="stat-value">
            {statement.openingBalance ? formatMoney(statement.openingBalance) : '—'}
          </div>
        </div>
      </div>

      <div className="meta-row">
        <span>
          <span className="meta-label">Account</span>
          <span className="meta-value">{accountId}</span>
        </span>
        <span>
          <span className="meta-label">Entries</span>
          <span className="meta-value">
            {statement.responseCount ?? entries.length} of {statement.count ?? '?'}
          </span>
        </span>
      </div>

      {breakdown.length > 0 && (
        <div className="breakdown">
          {breakdown.map(({ type, count }) => (
            <span key={type} className={`breakdown-chip tone-${categoryTone(type)}`}>
              <span className="breakdown-count">{count}</span>
              <span className="breakdown-label">{TRANSACTION_TYPE_LABEL[type] ?? type}</span>
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
