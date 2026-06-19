/* Deriving UI from the raw activity feed.
 *
 * Each transaction `type` stores its counterparty differently, so we switch on
 * the envelope `type` and read the type-specific payload. This is the core of
 * consuming the /transactions endpoints — the statement endpoint pre-normalizes
 * this for you; the activity feed does not. */

import type {
  ActivityTransaction,
  CardPaymentActivity,
  FeeActivity,
  IncomingWireActivity,
  OutgoingWireActivity,
  SendActivity,
  SystemTransactionActivity,
  TransferActivity,
} from './api/activity-types';
import { SUBTYPE_LABEL, feeLabel } from './labels';

export type InstrumentType = 'managed_accounts' | 'managed_cards';

export type CpTone = 'merchant' | 'bank' | 'instrument';

export interface CounterpartyDisplay {
  primary: string;
  secondary?: string;
  tone: CpTone;
  initial: string;
}

function firstAlphaChar(s: string): string {
  const m = s.match(/[A-Za-z0-9]/);
  return m ? m[0].toUpperCase() : '·';
}

function humanise(raw: string): string {
  return raw.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function instrumentLabel(type?: string): string | undefined {
  if (!type) return undefined;
  if (type === 'managed_cards') return 'Card';
  if (type === 'managed_accounts') return 'Account';
  return humanise(type);
}

function display(primary: string, tone: CpTone, secondary?: string): CounterpartyDisplay {
  return { primary, secondary, tone, initial: firstAlphaChar(primary) };
}

export function activityCounterparty(tx: ActivityTransaction): CounterpartyDisplay | null {
  switch (tx.type) {
    case 'card_payments': {
      const p = tx.transaction as CardPaymentActivity;
      const meta: string[] = [];
      if (p.merchant?.categoryCode) meta.push(`MCC ${p.merchant.categoryCode}`);
      if (p.merchant?.country) meta.push(p.merchant.country);
      return display(p.merchant?.name ?? 'Merchant', 'merchant', meta.join(' · ') || undefined);
    }
    case 'outgoing_wire_transfers': {
      const p = tx.transaction as OutgoingWireActivity;
      return display(p.destination?.name ?? 'Bank account', 'bank', p.destination?.iban ?? p.destination?.bankName);
    }
    case 'incoming_wire_transfers': {
      const p = tx.transaction as IncomingWireActivity;
      return display(p.senderName ?? 'Sender', 'bank', p.senderReference ?? p.senderIban);
    }
    case 'sends': {
      // A send is outgoing: the counterparty is the recipient (destination), never
      // this instrument's own id. The tag (e.g. "Partner-payout") is the useful detail.
      const p = tx.transaction as SendActivity;
      const label = instrumentLabel(p.destination?.type) ?? 'Account';
      return display(`${label} ${p.destination?.id ?? '—'}`, 'instrument', p.tag);
    }
    case 'transfers': {
      const p = tx.transaction as TransferActivity;
      // The counterparty is whichever leg isn't this instrument; direction tells us which.
      const other = tx.direction === 'DEBIT' ? p.destination : p.source;
      const label = instrumentLabel(other?.type) ?? 'Instrument';
      return display(`${label} ${other?.id ?? '—'}`, 'instrument', p.tag);
    }
    case 'fees': {
      const p = tx.transaction as FeeActivity;
      return display(feeLabel(p.feeType), 'instrument', p.relatedTransactionId ? `re ${p.relatedTransactionId}` : undefined);
    }
    case 'system_transactions': {
      const p = tx.transaction as SystemTransactionActivity;
      const label = p.subtype ? (SUBTYPE_LABEL[p.subtype] ?? humanise(p.subtype)) : 'System';
      return display(label, 'instrument', p.reason);
    }
    default:
      return null;
  }
}

/* The activity feed never labels which instrument the feed belongs to — but the
 * holding instrument's id appears inside the payloads (as the fee/system
 * `instrument`, the card, the send/wire source, etc.). Recover it from the data
 * so the UI can show the real id rather than a configured placeholder. */
export function deriveSelfInstrumentId(
  txs: ActivityTransaction[],
  instrumentType: InstrumentType,
): string | null {
  for (const tx of txs) {
    const id = selfIdFromTransaction(tx, instrumentType);
    if (id) return id;
  }
  return null;
}

function selfIdFromTransaction(tx: ActivityTransaction, instrumentType: InstrumentType): string | null {
  const p = tx.transaction;
  switch (tx.type) {
    case 'fees':
    case 'system_transactions': {
      const inst = (p as FeeActivity).instrument;
      return inst?.type === instrumentType ? inst.id : null;
    }
    case 'card_payments': {
      const card = (p as CardPaymentActivity).card;
      return instrumentType === 'managed_cards' && card?.id ? card.id : null;
    }
    case 'sends': {
      const s = (p as SendActivity).source;
      return s?.type === instrumentType ? s.id : null;
    }
    case 'outgoing_wire_transfers': {
      const s = (p as OutgoingWireActivity).sourceInstrument;
      return s?.type === instrumentType ? s.id : null;
    }
    case 'incoming_wire_transfers': {
      const d = (p as IncomingWireActivity).destinationInstrument;
      return d?.type === instrumentType ? d.id : null;
    }
    case 'transfers': {
      const t = p as TransferActivity;
      if (t.source?.type === instrumentType) return t.source.id;
      if (t.destination?.type === instrumentType) return t.destination.id;
      return null;
    }
    default:
      return null;
  }
}

/* A card payment whose REFUND events fully cover its amount has been reversed — the
 * original debit no longer stands, which the UI signals by striking the amount through. */
export function isFullyRefunded(tx: ActivityTransaction): boolean {
  if (tx.type !== 'card_payments') return false;
  const p = tx.transaction as CardPaymentActivity;
  const refunded = (p.events ?? [])
    .filter(e => e.type === 'REFUND')
    .reduce((sum, e) => sum + (e.billingAmount?.amount ?? 0), 0);
  const charged = p.displayAmount?.amount ?? tx.amount.amount;
  return refunded > 0 && refunded >= charged;
}

export type StatusTone = 'ok' | 'pending' | 'warn' | 'neutral';

export function activityStatusTone(status: string): StatusTone {
  switch (status) {
    case 'COMPLETED':
      return 'ok';
    case 'PENDING':
      return 'pending';
    case 'REVERSED':
    case 'DECLINED':
    case 'FAILED':
      return 'warn';
    default:
      return 'neutral';
  }
}
