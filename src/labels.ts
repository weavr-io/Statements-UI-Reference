import type { TransactionType, AccessInstrumentType } from './api/types';

/* Human-friendly labels for the proto enum values surfaced in statement entries.
 * Embedders typically replace this file with i18n keys for production use. */

export const TRANSACTION_TYPE_LABEL: Record<TransactionType, string> = {
  card_payments: 'Card payment',
  transfers: 'Transfer',
  sends: 'Send',
  outgoing_wire_transfers: 'Outgoing wire',
  incoming_wire_transfers: 'Incoming wire',
  correspondent_bank_transfers: 'Correspondent bank',
  fees: 'Fee',
  system_transactions: 'System',
};

/* Subtypes are open strings on the wire but the schema enumerates the known values.
 * Unknown subtypes fall through to a humanised version of the raw value. */
export const SUBTYPE_LABEL: Record<string, string> = {
  sale_purchases: 'Sale',
  cash_withdrawals: 'Cash withdrawal',
  sales_with_cashback: 'Sale with cashback',
  mail_or_telephone_orders: 'MoTo',
  purchase_refund_reversals: 'Refund reversal',
  original_credit_transaction_reversals: 'OCT reversal',
  cash_withdrawal_reversals: 'Cash withdrawal reversal',
  purchase_refunds: 'Refund',
  purchase_reversals: 'Purchase reversal',
  original_credit_transactions: 'Original credit',
  first_chargebacks: 'Chargeback',
  first_chargeback_reversals: 'Chargeback reversal',
  first_representments: 'Representment',
  first_representment_reversals: 'Representment reversal',
  second_chargebacks: '2nd chargeback',
  second_chargeback_reversals: '2nd chargeback reversal',
  second_representments: '2nd representment',
  arbitration_chargebacks: 'Arbitration chargeback',
  fee_reversals: 'Fee reversal',
  incoming_wire_fees: 'Incoming wire fee',
  withdrawal_fees: 'Withdrawal fee',
  purchase_fees: 'Purchase fee',
  refund_fees: 'Refund fee',
  atm_withdrawal_fees: 'ATM withdrawal fee',
  chargeback_fees: 'Chargeback fee',
  transfer_fees: 'Transfer fee',
  send_fees: 'Send fee',
  outgoing_wire_transfer_fees: 'Outgoing wire fee',
  custom_fees: 'Custom fee',
  other_fees: 'Other fee',
  instrument_delete_fees: 'Instrument delete fee',
  funds_redemption_fees: 'Funds redemption fee',
  system_transaction_fees: 'System transaction fee',
  fundings: 'Funding',
  redemptions: 'Redemption',
  returns: 'Return',
  account_closures: 'Account closure',
  chargebacks_represented: 'Chargeback represented',
  chargebacks_won: 'Chargeback won',
  manual_auth_expiries: 'Manual auth expiry',
  negative_card_balances: 'Negative card balance',
  balance_adjustments: 'Balance adjustment',
  lost_stolen_replacement_balance_transfers: 'Lost/stolen replacement',
};

export const ACCESS_INSTRUMENT_LABEL: Record<AccessInstrumentType, string> = {
  managed_cards: 'Card',
  ibans: 'IBAN',
};

export type CategoryTone = 'indigo' | 'amber' | 'violet' | 'cyan' | 'slate';

/** Visual grouping of transaction types for color-toned badges in the UI. */
export function categoryTone(type: TransactionType): CategoryTone {
  switch (type) {
    case 'card_payments': return 'indigo';
    case 'fees': return 'amber';
    case 'sends':
    case 'transfers': return 'cyan';
    case 'incoming_wire_transfers':
    case 'outgoing_wire_transfers':
    case 'correspondent_bank_transfers': return 'violet';
    case 'system_transactions': return 'slate';
  }
}

function humanise(raw: string): string {
  return raw.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function transactionLabel(type: TransactionType, subtype?: string): string {
  const main = TRANSACTION_TYPE_LABEL[type] ?? humanise(type);
  if (!subtype) return main;
  const sub = SUBTYPE_LABEL[subtype] ?? humanise(subtype);
  return `${main} · ${sub}`;
}

/** Label for a fee, derived from its subtype (e.g. "Transfer fee"). Falls back to a
 * humanised subtype, or "Fee" when no subtype is present. Shared by the statement
 * and activity views so the two render fees identically. */
export function feeLabel(subtype?: string): string {
  if (!subtype) return 'Fee';
  return SUBTYPE_LABEL[subtype] ?? humanise(subtype);
}
