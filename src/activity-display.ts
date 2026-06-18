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
  TransferActivity,
} from './api/activity-types';
import { SUBTYPE_LABEL } from './labels';

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
      const p = tx.transaction as SendActivity;
      return display(`Account ${p.destination?.id ?? '—'}`, 'instrument', p.source?.id ? `from ${p.source.id}` : undefined);
    }
    case 'transfers': {
      const p = tx.transaction as TransferActivity;
      // The counterparty is whichever leg isn't this instrument; direction tells us which.
      const other = tx.direction === 'DEBIT' ? p.destination : p.source;
      return display(`Instrument ${other?.id ?? '—'}`, 'instrument', instrumentLabel(other?.type));
    }
    case 'fees': {
      const p = tx.transaction as FeeActivity;
      const label = SUBTYPE_LABEL[p.feeType] ?? humanise(p.feeType ?? 'Fee');
      return display(label, 'instrument', p.relatedTransactionId ? `re ${p.relatedTransactionId}` : undefined);
    }
    case 'system_transactions':
    default:
      return null;
  }
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
