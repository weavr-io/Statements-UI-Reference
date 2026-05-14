/* TypeScript types for the InstrumentStatementJsonResponse (StatementV2) schema.
 * Source of truth: support/common-models/src/main/resources/commons.yml in the OPC repo.
 * Hand-written (not generated) so this file stays readable as a reference. */

export type CurrencyCode = string; // ISO 4217, e.g. 'EUR'

export interface CurrencyAmount {
  currency: CurrencyCode;
  /** Amount in the minor unit of the currency (e.g. cents for EUR). */
  amount: number;
}

export type SortOrder = 'ASC' | 'DESC';

export type TransactionType =
  | 'card_payments'
  | 'transfers'
  | 'sends'
  | 'outgoing_wire_transfers'
  | 'incoming_wire_transfers'
  | 'correspondent_bank_transfers'
  | 'fees'
  | 'system_transactions';

export type AccessInstrumentType = 'managed_cards' | 'ibans';

export type FeeSubtype =
  | 'fee_reversals'
  | 'incoming_wire_fees'
  | 'withdrawal_fees'
  | 'purchase_fees'
  | 'refund_fees'
  | 'atm_withdrawal_fees'
  | 'chargeback_fees'
  | 'transfer_fees'
  | 'send_fees'
  | 'outgoing_wire_transfer_fees'
  | 'custom_fees'
  | 'other_fees'
  | 'instrument_delete_fees'
  | 'funds_redemption_fees'
  | 'system_transaction_fees';

export interface TransactionRef {
  id: string;
  type: TransactionType;
  /** Present on transaction types that carry a subtype (card_payments, fees, etc.). */
  subtype?: string;
}

export interface MerchantCounterparty {
  name: string;
  id?: string;
  categoryCode?: string;
  country?: string;
}

export interface InstrumentCounterparty {
  id: string;
  type: 'managed_accounts' | 'managed_cards';
  friendlyName?: string;
  owner?: {
    id: string;
    type: 'consumers' | 'corporates';
    name?: string;
  };
}

export interface BankAccountCounterparty {
  name?: string;
  iban?: string;
  bankCode?: string;
  reference?: string;
}

/* The wire payload's counterparty is a oneOf with no discriminator field. Consumers
 * narrow this union with structural checks at the call site — see EntriesTable. */
export type Counterparty =
  | MerchantCounterparty
  | InstrumentCounterparty
  | BankAccountCounterparty;

export interface FeeSummary {
  id: string;
  type: 'fees';
  amount: CurrencyAmount;
  subtype?: FeeSubtype;
}

export interface TransactionForex {
  originalAmount?: CurrencyAmount;
  /** Rate = value / 10^scale (e.g. value=8673, scale=4 → 0.8673). */
  exchangeRate?: { value: number; scale: number };
  paddingAmount?: CurrencyAmount;
  feeAmount?: CurrencyAmount;
}

export interface ExecutingAccessInstrument {
  id: string;
  type: AccessInstrumentType;
  friendlyName?: string;
  cardBrand?: string;
  cardNumberFirstSix?: string;
  cardNumberLastFour?: string;
}

export interface StatementEntry {
  entryId: string;
  transaction: TransactionRef;
  description?: string;
  /** Epoch timestamp, milliseconds. */
  timestamp: number;
  balanceAdjustment: CurrencyAmount;
  balanceAfter: CurrencyAmount;
  counterparty?: Counterparty;
  fee?: FeeSummary;
  forex?: TransactionForex;
  relatedEntryId?: string;
  executingAccessInstrument?: ExecutingAccessInstrument;
}

/** The JSON response body for GET /managed_accounts/{id}/statement. */
export interface InstrumentStatement {
  openingBalance?: CurrencyAmount;
  closingBalance?: CurrencyAmount;
  entries?: StatementEntry[];
  /** Total number of entries matching the filter criteria across all pages. */
  count?: number;
  /** Number of entries returned in this response. */
  responseCount?: number;
  /** Regulatory and card scheme footer text. */
  footer?: string;
}
