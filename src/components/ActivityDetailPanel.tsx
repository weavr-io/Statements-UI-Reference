import { Fragment, useState, type MouseEvent } from 'react';
import type {
  ActivityTransaction,
  CardPaymentActivity,
  FeeActivity,
  IncomingWireActivity,
  OutgoingWireActivity,
  SendActivity,
  SystemTransactionActivity,
  TransferActivity,
} from '../api/activity-types';
import { formatMoney } from '../format';
import { transactionLabel, SUBTYPE_LABEL } from '../labels';
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

/* The type-specific free-text and reference fields — the "why" of each transaction.
 * Each `type` carries these differently (a wire's description, a card's merchant, a
 * transfer's tag), so we read the narrowed payload per type. */
function detailItems(tx: ActivityTransaction): Item[] {
  const items: Item[] = [];
  switch (tx.type) {
    case 'outgoing_wire_transfers': {
      const p = tx.transaction as OutgoingWireActivity;
      if (p.description) items.push({ label: 'Description', value: p.description });
      if (p.tag) items.push({ label: 'Tag', value: p.tag });
      if (p.destination?.iban) items.push({ label: 'IBAN', value: p.destination.iban });
      if (p.destination?.bankName) items.push({ label: 'Bank', value: p.destination.bankName });
      if (p.destination?.bankCountry) items.push({ label: 'Bank country', value: p.destination.bankCountry });
      break;
    }
    case 'incoming_wire_transfers': {
      const p = tx.transaction as IncomingWireActivity;
      if (p.senderReference) items.push({ label: 'Sender reference', value: p.senderReference });
      if (p.senderName) items.push({ label: 'Sender', value: p.senderName });
      if (p.senderIban) items.push({ label: 'Sender IBAN', value: p.senderIban });
      if (p.paymentNetwork) items.push({ label: 'Network', value: p.paymentNetwork });
      break;
    }
    case 'sends': {
      const p = tx.transaction as SendActivity;
      if (p.tag) items.push({ label: 'Tag', value: p.tag });
      break;
    }
    case 'transfers': {
      const p = tx.transaction as TransferActivity;
      if (p.tag) items.push({ label: 'Tag', value: p.tag });
      break;
    }
    case 'card_payments': {
      const p = tx.transaction as CardPaymentActivity;
      if (p.merchant?.name) items.push({ label: 'Merchant', value: p.merchant.name });
      if (p.merchant?.categoryCode) items.push({ label: 'MCC', value: p.merchant.categoryCode });
      if (p.merchant?.country) items.push({ label: 'Country', value: p.merchant.country });
      if (p.card?.friendlyName) items.push({ label: 'Card', value: p.card.friendlyName });
      if (p.card?.cardNumberLastFour) items.push({ label: 'Card number', value: `•••• ${p.card.cardNumberLastFour}` });
      break;
    }
    case 'system_transactions': {
      const p = tx.transaction as SystemTransactionActivity;
      if (p.subtype) items.push({ label: 'Subtype', value: SUBTYPE_LABEL[p.subtype] ?? p.subtype });
      if (p.reason) items.push({ label: 'Reason', value: p.reason });
      break;
    }
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
  const details = detailItems(tx);
  const payment = tx.type === 'card_payments' ? (tx.transaction as CardPaymentActivity) : null;

  function toggleJson(e: MouseEvent) {
    e.stopPropagation(); // don't collapse the parent row
    setJsonOpen(v => !v);
  }

  return (
    <div className="detail-panel" onClick={e => e.stopPropagation()}>
      <div className="detail-sections">
        <Section title="Identifiers" items={identifierItems(tx)} />
        {details.length > 0 && <Section title="Details" items={details} />}
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
