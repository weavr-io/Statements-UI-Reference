import { Fragment, useState, type KeyboardEvent } from 'react';
import type {
  StatementEntry,
  Counterparty,
  InstrumentCounterparty,
  BankAccountCounterparty,
  MerchantCounterparty,
} from '../api/types';
import { formatMoney, formatTimestamp } from '../format';
import { transactionLabel, categoryTone, feeLabel } from '../labels';
import { EntryDetailPanel } from './EntryDetailPanel';

interface Props {
  entries: StatementEntry[];
}

// Counterparty narrowing: wire payload has no discriminator field.
//   - InstrumentCounterparty is the only variant with required `type`
//   - BankAccountCounterparty is the only variant carrying iban/bankCode/reference
//   - everything else is a MerchantCounterparty
function isInstrumentCounterparty(cp: Counterparty): cp is InstrumentCounterparty {
  return 'type' in cp;
}
function isBankAccountCounterparty(cp: Counterparty): cp is BankAccountCounterparty {
  return 'iban' in cp || 'bankCode' in cp || 'reference' in cp;
}

type CpTone = 'merchant' | 'bank' | 'instrument';

interface CounterpartyDisplay {
  primary: string;
  secondary?: string;
  tone: CpTone;
  initial: string;
}

function firstAlphaChar(s: string): string {
  const m = s.match(/[A-Za-z0-9]/);
  return m ? m[0].toUpperCase() : '·';
}

function counterpartyDisplay(cp: Counterparty | undefined): CounterpartyDisplay | null {
  if (!cp) return null;
  if (isInstrumentCounterparty(cp)) {
    const primary = cp.friendlyName ?? `Instrument ${cp.id}`;
    return {
      primary,
      secondary: cp.owner?.name ?? `ID ${cp.id}`,
      tone: 'instrument',
      initial: firstAlphaChar(primary),
    };
  }
  if (isBankAccountCounterparty(cp)) {
    const primary = cp.name ?? 'Bank account';
    return {
      primary,
      secondary: cp.iban ?? cp.bankCode ?? cp.reference,
      tone: 'bank',
      initial: firstAlphaChar(primary),
    };
  }
  const m: MerchantCounterparty = cp;
  const meta: string[] = [];
  if (m.categoryCode) meta.push(`MCC ${m.categoryCode}`);
  if (m.country) meta.push(m.country);
  return {
    primary: m.name,
    secondary: meta.length ? meta.join(' · ') : undefined,
    tone: 'merchant',
    initial: firstAlphaChar(m.name),
  };
}

// Fees carry no counterparty on the wire, but the fee type + the transaction they
// relate to are the meaningful identity. Render them the same way the activity view
// does (subtype label + "re <related>") so fees look identical across both views.
function feeCounterparty(subtype: string | undefined, relatedEntryId: string | undefined): CounterpartyDisplay {
  const primary = feeLabel(subtype);
  return {
    primary,
    secondary: relatedEntryId ? `re ${relatedEntryId}` : undefined,
    tone: 'instrument',
    initial: firstAlphaChar(primary),
  };
}

function ChevronIcon() {
  return (
    <svg className="chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function EntryRow({ entry }: { entry: StatementEntry }) {
  const [expanded, setExpanded] = useState(false);
  const isFee = entry.transaction.type === 'fees';
  const cp = isFee
    ? feeCounterparty(entry.transaction.subtype, entry.relatedEntryId)
    : counterpartyDisplay(entry.counterparty);
  const tone = categoryTone(entry.transaction.type);
  const credit = entry.balanceAdjustment.amount >= 0;

  // All entries are expandable in this demo — the detail panel always has something useful
  // to show (identifiers, timestamp breakdown, balance flow, raw JSON, etc.).
  const onRowClick = () => setExpanded(v => !v);
  const onRowKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setExpanded(v => !v);
    }
  };

  const rowClass = `entry-row expandable${expanded ? ' expanded' : ''}`;

  return (
    <Fragment>
      <tr
        className={rowClass}
        onClick={onRowClick}
        onKeyDown={onRowKey}
        tabIndex={0}
        role="button"
        aria-expanded={expanded}
      >
        <td className="entry-time">{formatTimestamp(entry.timestamp)}</td>
        <td>
          <span className={`type-badge tone-${tone}`}>
            <span className="type-badge-dot" aria-hidden="true" />
            {isFee
              ? transactionLabel(entry.transaction.type)
              : transactionLabel(entry.transaction.type, entry.transaction.subtype)}
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
        <td className={`num amount ${credit ? 'credit' : 'debit'}`}>
          {formatMoney(entry.balanceAdjustment)}
        </td>
        <td className="num balance-after">
          <span className="balance-after-value">{formatMoney(entry.balanceAfter)}</span>
          <ChevronIcon />
        </td>
      </tr>
      {expanded && (
        <tr className="entry-detail-row">
          <td colSpan={5}>
            <EntryDetailPanel entry={entry} />
          </td>
        </tr>
      )}
    </Fragment>
  );
}

export function EntriesTable({ entries }: Props) {
  if (entries.length === 0) {
    return <p className="empty">No entries in this period.</p>;
  }
  return (
    <div className="entries-wrapper">
      <table className="entries">
        <thead>
          <tr>
            <th>Posted</th>
            <th>Activity</th>
            <th>Counterparty</th>
            <th className="num">Amount</th>
            <th className="num">Balance after</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(entry => <EntryRow key={entry.entryId} entry={entry} />)}
        </tbody>
      </table>
    </div>
  );
}
