import { Fragment, useState, type MouseEvent } from 'react';
import type {
  StatementEntry,
  Counterparty,
  InstrumentCounterparty,
  BankAccountCounterparty,
  MerchantCounterparty,
  TransactionForex,
  FeeSummary,
  ExecutingAccessInstrument,
} from '../api/types';
import { formatMoney } from '../format';
import {
  ACCESS_INSTRUMENT_LABEL,
  SUBTYPE_LABEL,
  TRANSACTION_TYPE_LABEL,
} from '../labels';

interface Item {
  label: string;
  value: string;
}

function isInstrumentCounterparty(cp: Counterparty): cp is InstrumentCounterparty {
  return 'type' in cp;
}
function isBankAccountCounterparty(cp: Counterparty): cp is BankAccountCounterparty {
  return 'iban' in cp || 'bankCode' in cp || 'reference' in cp;
}

function humaniseEnum(raw: string): string {
  return SUBTYPE_LABEL[raw] ?? raw.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function identifierItems(entry: StatementEntry): Item[] {
  const items: Item[] = [
    { label: 'Entry ID', value: entry.entryId },
    { label: 'Transaction ID', value: entry.transaction.id },
    { label: 'Type', value: TRANSACTION_TYPE_LABEL[entry.transaction.type] ?? entry.transaction.type },
  ];
  if (entry.transaction.subtype) {
    items.push({ label: 'Subtype', value: humaniseEnum(entry.transaction.subtype) });
  }
  if (entry.relatedEntryId) {
    items.push({ label: 'Related entry', value: entry.relatedEntryId });
  }
  return items;
}

function timestampItems(epochMillis: number): Item[] {
  const d = new Date(epochMillis);
  return [
    { label: 'Local', value: d.toLocaleString() },
    { label: 'UTC', value: d.toISOString() },
    { label: 'Epoch (ms)', value: String(epochMillis) },
  ];
}

function balanceItems(entry: StatementEntry): Item[] {
  return [
    { label: 'Adjustment', value: formatMoney(entry.balanceAdjustment) },
    { label: 'Balance after', value: formatMoney(entry.balanceAfter) },
  ];
}

function counterpartyItems(cp: Counterparty | undefined): { title: string; items: Item[] } | null {
  if (!cp) return null;
  if (isInstrumentCounterparty(cp)) {
    const items: Item[] = [
      { label: 'Type', value: 'Internal instrument' },
      { label: 'Instrument type', value: humaniseEnum(cp.type) },
      { label: 'ID', value: cp.id },
    ];
    if (cp.friendlyName) items.push({ label: 'Friendly name', value: cp.friendlyName });
    if (cp.owner) {
      items.push({ label: 'Owner ID', value: cp.owner.id });
      items.push({ label: 'Owner type', value: humaniseEnum(cp.owner.type) });
      if (cp.owner.name) items.push({ label: 'Owner name', value: cp.owner.name });
    }
    return { title: 'Counterparty · Instrument', items };
  }
  if (isBankAccountCounterparty(cp)) {
    const items: Item[] = [{ label: 'Type', value: 'External bank account' }];
    if (cp.name) items.push({ label: 'Name', value: cp.name });
    if (cp.iban) items.push({ label: 'IBAN', value: cp.iban });
    if (cp.bankCode) items.push({ label: 'Bank code', value: cp.bankCode });
    if (cp.reference) items.push({ label: 'Reference', value: cp.reference });
    return { title: 'Counterparty · Bank account', items };
  }
  const m: MerchantCounterparty = cp;
  const items: Item[] = [
    { label: 'Type', value: 'Merchant' },
    { label: 'Name', value: m.name },
  ];
  if (m.id) items.push({ label: 'Merchant ID', value: m.id });
  if (m.categoryCode) items.push({ label: 'Category (MCC)', value: m.categoryCode });
  if (m.country) items.push({ label: 'Country', value: m.country });
  return { title: 'Counterparty · Merchant', items };
}

function feeItems(fee: FeeSummary | undefined): Item[] | null {
  if (!fee) return null;
  const items: Item[] = [
    { label: 'Amount', value: formatMoney(fee.amount) },
    { label: 'Fee ID', value: fee.id },
  ];
  if (fee.subtype) items.push({ label: 'Subtype', value: humaniseEnum(fee.subtype) });
  return items;
}

function forexItems(fx: TransactionForex | undefined): Item[] | null {
  if (!fx) return null;
  const items: Item[] = [];
  if (fx.originalAmount) items.push({ label: 'Original amount', value: formatMoney(fx.originalAmount) });
  if (fx.exchangeRate) {
    const rate = fx.exchangeRate.value / 10 ** fx.exchangeRate.scale;
    items.push({ label: 'Exchange rate', value: rate.toFixed(Math.min(fx.exchangeRate.scale, 6)) });
  }
  if (fx.feeAmount) items.push({ label: 'FX fee', value: formatMoney(fx.feeAmount) });
  if (fx.paddingAmount) items.push({ label: 'Padding amount', value: formatMoney(fx.paddingAmount) });
  return items.length ? items : null;
}

function accessInstrumentItems(ai: ExecutingAccessInstrument | undefined): Item[] | null {
  if (!ai) return null;
  const items: Item[] = [
    { label: 'Type', value: ACCESS_INSTRUMENT_LABEL[ai.type] ?? ai.type },
    { label: 'ID', value: ai.id },
  ];
  if (ai.friendlyName) items.push({ label: 'Friendly name', value: ai.friendlyName });
  if (ai.cardBrand) items.push({ label: 'Card brand', value: ai.cardBrand });
  if (ai.cardNumberFirstSix || ai.cardNumberLastFour) {
    const first = ai.cardNumberFirstSix ?? '••••••';
    const last = ai.cardNumberLastFour ?? '••••';
    items.push({ label: 'Card number', value: `${first} •••• •••• ${last}` });
  }
  return items;
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

interface Props {
  entry: StatementEntry;
}

export function EntryDetailPanel({ entry }: Props) {
  const [jsonOpen, setJsonOpen] = useState(false);

  const cp = counterpartyItems(entry.counterparty);
  const fees = feeItems(entry.fee);
  const fx = forexItems(entry.forex);
  const ai = accessInstrumentItems(entry.executingAccessInstrument);

  function toggleJson(e: MouseEvent) {
    e.stopPropagation(); // don't collapse the parent row
    setJsonOpen(v => !v);
  }

  return (
    <div className="detail-panel" onClick={e => e.stopPropagation()}>
      {entry.description && (
        <div className="detail-note">
          <span className="detail-note-label">Note</span>
          <p>{entry.description}</p>
        </div>
      )}
      <div className="detail-sections">
        <Section title="Identifiers" items={identifierItems(entry)} />
        <Section title="Timestamp" items={timestampItems(entry.timestamp)} />
        <Section title="Balance" items={balanceItems(entry)} />
        {cp && <Section title={cp.title} items={cp.items} />}
        {fees && <Section title="Fee" items={fees} />}
        {fx && <Section title="Foreign exchange" items={fx} />}
        {ai && <Section title="Initiated by" items={ai} />}
      </div>
      <div className="detail-json">
        <button type="button" className="json-toggle" onClick={toggleJson} aria-expanded={jsonOpen}>
          <span className={`json-caret ${jsonOpen ? 'open' : ''}`}>▸</span>
          Raw JSON
        </button>
        {jsonOpen && (
          <pre className="json-block">{JSON.stringify(entry, null, 2)}</pre>
        )}
      </div>
    </div>
  );
}
