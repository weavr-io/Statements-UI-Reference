import { Fragment, useState, type KeyboardEvent } from 'react';
import type { ActivityTransaction } from '../api/activity-types';
import { formatMoney, formatTimestamp } from '../format';
import { transactionLabel, categoryTone } from '../labels';
import { activityCounterparty, activityStatusTone } from '../activity-display';
import { ActivityDetailPanel } from './ActivityDetailPanel';

interface Props {
  transactions: ActivityTransaction[];
}

function ChevronIcon() {
  return (
    <svg className="chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function ActivityRow({ tx }: { tx: ActivityTransaction }) {
  const [expanded, setExpanded] = useState(false);
  const cp = activityCounterparty(tx);
  const tone = categoryTone(tx.type);
  const credit = tx.direction === 'CREDIT';

  const onRowClick = () => setExpanded(v => !v);
  const onRowKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setExpanded(v => !v);
    }
  };

  return (
    <Fragment>
      <tr
        className={`entry-row expandable${expanded ? ' expanded' : ''}`}
        onClick={onRowClick}
        onKeyDown={onRowKey}
        tabIndex={0}
        role="button"
        aria-expanded={expanded}
      >
        <td className="entry-time">{formatTimestamp(tx.creationTimestamp)}</td>
        <td>
          <span className={`type-badge tone-${tone}`}>
            <span className="type-badge-dot" aria-hidden="true" />
            {transactionLabel(tx.type)}
          </span>
        </td>
        <td className="cp-cell">
          {cp ? (
            <>
              <span className={`cp-avatar tone-${cp.tone}`}>{cp.initial}</span>
              <span className="cp-text">
                <span className="cp-primary">{cp.primary}</span>
                {cp.secondary && <span className="cp-secondary">{cp.secondary}</span>}
              </span>
            </>
          ) : (
            <span className="cp-empty">—</span>
          )}
        </td>
        <td>
          <span className={`status-badge status-${activityStatusTone(tx.status)}`}>{tx.status}</span>
        </td>
        <td className={`num amount ${credit ? 'credit' : 'debit'}`}>
          <span className="amount-value">{credit ? '+' : '−'}{formatMoney(tx.amount)}</span>
          <ChevronIcon />
        </td>
      </tr>
      {expanded && (
        <tr className="entry-detail-row">
          <td colSpan={5}>
            <ActivityDetailPanel tx={tx} />
          </td>
        </tr>
      )}
    </Fragment>
  );
}

export function ActivityTable({ transactions }: Props) {
  if (transactions.length === 0) {
    return <p className="empty">No activity in this period.</p>;
  }
  return (
    <div className="entries-wrapper">
      <table className="entries">
        <thead>
          <tr>
            <th>Posted</th>
            <th>Activity</th>
            <th>Counterparty</th>
            <th>Status</th>
            <th className="num">Amount</th>
          </tr>
        </thead>
        <tbody>
          {/* `id` is not unique across the feed (a fee and its parent share an id),
              so the React key combines id + type + index. */}
          {transactions.map((tx, i) => (
            <ActivityRow key={`${tx.id}-${tx.type}-${i}`} tx={tx} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
