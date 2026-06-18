import type { ActivityTransaction } from '../api/activity-types';
import type { TransactionType, CurrencyAmount } from '../api/types';
import { formatMoney } from '../format';
import { TRANSACTION_TYPE_LABEL, categoryTone } from '../labels';

interface Props {
  transactions: ActivityTransaction[];
  count: number;
  responseCount: number;
  instrumentLabel: string;
  instrumentId: string;
}

interface Totals {
  in: CurrencyAmount;
  out: CurrencyAmount;
  fees: CurrencyAmount;
  net: CurrencyAmount;
}

function totals(txs: ActivityTransaction[], currency: string): Totals {
  let inAmount = 0;
  let outAmount = 0;
  let feeAmount = 0;
  for (const tx of txs) {
    const a = tx.amount.amount;
    if (tx.direction === 'CREDIT') inAmount += a;
    else outAmount += a;
    if (tx.type === 'fees') feeAmount += a;
  }
  return {
    in: { currency, amount: inAmount },
    out: { currency, amount: outAmount },
    fees: { currency, amount: feeAmount },
    net: { currency, amount: inAmount - outAmount },
  };
}

function typeBreakdown(txs: ActivityTransaction[]): Array<{ type: TransactionType; count: number }> {
  const counts = new Map<TransactionType, number>();
  for (const tx of txs) counts.set(tx.type, (counts.get(tx.type) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => ({ type, count }));
}

export function ActivitySummary({ transactions, count, responseCount, instrumentLabel, instrumentId }: Props) {
  const currency = transactions[0]?.amount.currency ?? 'EUR';
  const t = totals(transactions, currency);
  const breakdown = typeBreakdown(transactions);

  return (
    <section className="summary">
      <div className="hero">
        <div className="hero-label">Net flow</div>
        <div className="hero-value">{formatMoney(t.net)}</div>
        <div className="hero-period">{responseCount} of {count} transactions</div>
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
          <div className="stat-label">{instrumentLabel}</div>
          <div className="stat-value">{instrumentId}</div>
        </div>
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
