import { Fragment, useState, type MouseEvent } from 'react';
import type {
  ActivityTransaction,
  CardPaymentActivity,
  FeeActivity,
  OutgoingWireActivity,
} from '../api/activity-types';
import { formatMoney } from '../format';
import { transactionLabel } from '../labels';
import { activityCounterparty } from '../activity-display';

interface Item {
  label: string;
  value: string;
}

function Section({ title, items }: { title: string; items: Item[] }) {
  return (
    <div className="detail-section">
      <h3 className="detail-section-title">{title}</h3>
      <dl className="detail-section-grid">
        {items.map(item => (
          <Fragment key={item.label}>
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
          </Fragment>
        ))}
      </dl>
    </div>
  );
}

function identifierItems(tx: ActivityTransaction): Item[] {
  const items: Item[] = [
    { label: 'ID', value: tx.id },
    { label: 'Type', value: transactionLabel(tx.type) },
    { label: 'Direction', value: tx.direction },
    { label: 'Status', value: tx.status },
  ];
  if (tx.type === 'fees') {
    const p = tx.transaction as FeeActivity;
    if (p.relatedTransactionId) items.push({ label: 'Related transaction', value: p.relatedTransactionId });
  }
  if (tx.type === 'outgoing_wire_transfers') {
    const p = tx.transaction as OutgoingWireActivity;
    if (p.type) items.push({ label: 'Payment rail', value: p.type });
  }
  return items;
}

function timestampItems(tx: ActivityTransaction): Item[] {
  return [
    { label: 'Created', value: new Date(tx.creationTimestamp).toLocaleString() },
    { label: 'Last updated', value: new Date(tx.lastUpdatedTimestamp).toLocaleString() },
    { label: 'Created (epoch ms)', value: String(tx.creationTimestamp) },
  ];
}

function amountItems(tx: ActivityTransaction): Item[] {
  const items: Item[] = [{ label: 'Amount', value: formatMoney(tx.amount) }];
  if (tx.fee) items.push({ label: 'Fee', value: formatMoney(tx.fee.amount) });
  return items;
}

function CardEvents({ payment }: { payment: CardPaymentActivity }) {
  return (
    <div className="detail-section">
      <h3 className="detail-section-title">Card events</h3>
      <ol className="event-timeline">
        {payment.events.map(ev => (
          <li key={ev.id + ev.type} className="event-item">
            <span className="event-type">{ev.type}</span>
            <span className="event-meta">
              {ev.billingAmount && <span>{formatMoney(ev.billingAmount)}</span>}
              {ev.result && <span>{ev.result}</span>}
              {ev.settlementState && <span>{ev.settlementState}</span>}
              {ev.authCode && <span>auth {ev.authCode}</span>}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

interface Props {
  tx: ActivityTransaction;
}

export function ActivityDetailPanel({ tx }: Props) {
  const [jsonOpen, setJsonOpen] = useState(false);
  const cp = activityCounterparty(tx);
  const payment = tx.type === 'card_payments' ? (tx.transaction as CardPaymentActivity) : null;

  function toggleJson(e: MouseEvent) {
    e.stopPropagation(); // don't collapse the parent row
    setJsonOpen(v => !v);
  }

  return (
    <div className="detail-panel" onClick={e => e.stopPropagation()}>
      <div className="detail-sections">
        <Section title="Identifiers" items={identifierItems(tx)} />
        <Section title="Timestamps" items={timestampItems(tx)} />
        <Section title="Amount" items={amountItems(tx)} />
        {cp && (
          <Section
            title="Counterparty"
            items={[
              { label: 'Name', value: cp.primary },
              ...(cp.secondary ? [{ label: 'Detail', value: cp.secondary }] : []),
            ]}
          />
        )}
        {payment && <CardEvents payment={payment} />}
      </div>
      <div className="detail-json">
        <button type="button" className="json-toggle" onClick={toggleJson} aria-expanded={jsonOpen}>
          <span className={`json-caret ${jsonOpen ? 'open' : ''}`}>▸</span>
          Raw JSON
        </button>
        {jsonOpen && <pre className="json-block">{JSON.stringify(tx, null, 2)}</pre>}
      </div>
    </div>
  );
}
