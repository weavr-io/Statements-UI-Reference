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
import { activityCounterparty, type CounterpartyDisplay } from '../activity-display';

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

/* The transaction's own lifecycle status, distinct from the envelope `status`
 * (which is the ledger-entry status). Card payments expose `status` (e.g. SETTLED),
 * money movements expose `state` (e.g. COMPLETED), and fees/system expose `status`
 * (e.g. REVERSED for a fee reversal — which the envelope reports as COMPLETED). */
function lifecycleStatusItem(tx: ActivityTransaction): Item | null {
  switch (tx.type) {
    case 'card_payments': {
      const p = tx.transaction as CardPaymentActivity;
      return p.status ? { label: 'Card status', value: p.status } : null;
    }
    case 'sends':
      return stateItem((tx.transaction as SendActivity).state);
    case 'transfers':
      return stateItem((tx.transaction as TransferActivity).state);
    case 'outgoing_wire_transfers':
      return stateItem((tx.transaction as OutgoingWireActivity).state);
    case 'incoming_wire_transfers':
      return stateItem((tx.transaction as IncomingWireActivity).state);
    case 'fees':
      return stateItem((tx.transaction as FeeActivity).status);
    case 'system_transactions':
      return stateItem((tx.transaction as SystemTransactionActivity).status);
    default:
      return null;
  }
}

function stateItem(state: string | undefined): Item | null {
  return state ? { label: 'State', value: state } : null;
}

/* The Counterparty section: the derived name, plus type-specific identity fields.
 * Incoming wires identify the counterparty by the sender's IBAN, so it belongs here
 * rather than in the generic "Detail" line. */
function counterpartyItems(tx: ActivityTransaction, cp: CounterpartyDisplay): Item[] {
  const items: Item[] = [{ label: 'Name', value: cp.primary }];
  if (tx.type === 'incoming_wire_transfers') {
    const p = tx.transaction as IncomingWireActivity;
    if (p.senderIban) items.push({ label: 'Sender IBAN', value: p.senderIban });
    return items;
  }
  if (cp.secondary) items.push({ label: 'Detail', value: cp.secondary });
  return items;
}

/* The type-specific free-text and reference fields — the "why" of each transaction.
 * Each `type` carries these differently (a wire's description, a card's merchant, a
 * transfer's tag), so we read the narrowed payload per type. The transaction's own
 * lifecycle status leads the section. */
function detailItems(tx: ActivityTransaction): Item[] {
  const items: Item[] = [];
  const state = lifecycleStatusItem(tx);
  if (state) items.push(state);
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
      // Sender name + IBAN identify the counterparty (Counterparty section);
      // the reference and network are the "how", shown here.
      const p = tx.transaction as IncomingWireActivity;
      if (p.senderReference) items.push({ label: 'Sender reference', value: p.senderReference });
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
        {cp && <Section title="Counterparty" items={counterpartyItems(tx, cp)} />}
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
