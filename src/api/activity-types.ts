/* TypeScript types for the transaction-activity endpoints:
 *   GET /managed_accounts/{id}/transactions
 *   GET /managed_cards/{id}/transactions
 *
 * Unlike the curated statement (api/types.ts), this is the raw transaction feed:
 * a common envelope per record plus a type-specific `transaction` payload that
 * varies by `type`. Hand-written from captured fixtures so it stays readable. */

import type { CurrencyAmount, TransactionType } from './types';

export type Direction = 'CREDIT' | 'DEBIT';

/* Open string on the wire; these are the values seen in practice. */
export type ActivityStatus =
  | 'COMPLETED'
  | 'PENDING'
  | 'REVERSED'
  | 'DECLINED'
  | 'FAILED'
  | (string & {});

interface InstrumentRef {
  id: string;
  type: 'managed_accounts' | 'managed_cards';
}

/* --- Per-type raw `transaction` payloads ------------------------------- */

export interface SystemTransactionActivity {
  id: string;
  creationTimestamp: number;
  lastUpdatedTimestamp: number;
  status: string;
  instrument: InstrumentRef;
  amount: CurrencyAmount;
  /** Not present on every system transaction; surfaced in the UI when it is. */
  subtype?: string;
  /** Free-text reason for the adjustment, when the wire provides one. */
  reason?: string;
}

export interface FeeActivity {
  id: string;
  creationTimestamp: number;
  lastUpdatedTimestamp: number;
  status: string;
  instrument: InstrumentRef;
  feeType: string;
  amount: CurrencyAmount;
  relatedTransactionId?: string;
}

export interface SendActivity {
  id: string;
  creationTimestamp: number;
  state: string;
  source: InstrumentRef;
  destination: InstrumentRef;
  transactionAmount: CurrencyAmount;
  destinationAmount: CurrencyAmount;
  sourceFee?: CurrencyAmount;
  destinationFee?: CurrencyAmount;
  executionTimestamp?: string;
  profileId?: string;
  tag?: string;
}

export interface TransferActivity {
  id: string;
  creationTimestamp: number;
  state: string;
  source: InstrumentRef;
  destination: InstrumentRef;
  destinationAmount: CurrencyAmount;
  executionTimestamp?: string;
  profileId?: string;
  tag?: string;
}

export interface WireBankDestination {
  name?: string;
  iban?: string;
  bankIdentifierCode?: string;
  bankName?: string;
  bankCountry?: string;
  address?: string;
  bankAddress?: string;
}

export interface OutgoingWireActivity {
  id: string;
  creationTimestamp: number;
  state: string;
  /** Payment rail, e.g. "SEPA". */
  type?: string;
  destination: WireBankDestination;
  sourceInstrument: InstrumentRef;
  transferAmount: CurrencyAmount;
  fee?: CurrencyAmount;
  description?: string;
  executionTimestamp?: string;
  profileId?: string;
  tag?: string;
}

export interface IncomingWireActivity {
  id: string;
  createdAt: number;
  executedAt?: number;
  state: string;
  destinationInstrument: InstrumentRef;
  senderName?: string;
  senderIban?: string;
  senderReference?: string;
  paymentNetwork?: string;
  amount: CurrencyAmount;
  profileId?: string;
}

export interface CardRef {
  id: string;
  type: string;
  nameOnCard?: string;
  friendlyName?: string;
  cardBrand?: string;
  cardNumberFirstSix?: string;
  cardNumberLastFour?: string;
  mode?: string;
}

export interface CardMerchant {
  name: string;
  id?: string;
  categoryCode?: string;
  country?: string;
}

export interface CardPaymentFee {
  type: string;
  amount: CurrencyAmount;
  id?: string;
  subtype?: string;
}

export type CardEventType = 'AUTHORISATION' | 'SETTLEMENT' | (string & {});

export interface CardPaymentEvent {
  type: CardEventType;
  id: string;
  subtype?: string;
  authCode?: string;
  /** APPROVED | DECLINED on an authorisation. */
  result?: string;
  settlementState?: string;
  /** High-level decline reason on a declined authorisation, e.g. AUTH_RULE_CHECKS_FAILED. */
  declineReason?: string;
  /** Which spend-control rule failed. NOT_SPEND_CONTROL_RULE_FAILURE means none did. */
  authRuleFailedReason?: string;
  authorisationCategory?: string;
  cancellationReason?: string;
  billingAmount?: CurrencyAmount;
  transactionAmount?: CurrencyAmount;
  fees?: CardPaymentFee[];
  reversal?: boolean;
  timestamp: number;
  processedTimestamp?: number;
}

export interface CardPaymentActivity {
  id: string;
  /** Card transaction kind, e.g. "PURCHASE". */
  type?: string;
  /** Card-payment lifecycle state, e.g. "SETTLED". */
  status: string;
  card: CardRef;
  merchant: CardMerchant;
  events: CardPaymentEvent[];
  displayAmount: CurrencyAmount;
  creationTimestamp: number;
  lastUpdatedTimestamp: number;
  profileId?: string;
}

/* The payload has no single discriminator field, so consumers switch on the
 * ENVELOPE `type` (see ActivityTransaction) and narrow accordingly. */
export type ActivityPayload =
  | SystemTransactionActivity
  | FeeActivity
  | SendActivity
  | TransferActivity
  | OutgoingWireActivity
  | IncomingWireActivity
  | CardPaymentActivity;

/* --- Envelope ---------------------------------------------------------- */

export interface ActivityFee {
  id: string;
  amount: CurrencyAmount;
}

export interface ActivityTransaction {
  id: string;
  type: TransactionType;
  direction: Direction;
  status: ActivityStatus;
  amount: CurrencyAmount;
  creationTimestamp: number;
  lastUpdatedTimestamp: number;
  fee?: ActivityFee;
  transaction: ActivityPayload;
}

/** JSON response body for GET /managed_{accounts,cards}/{id}/transactions. */
export interface InstrumentTransactions {
  transactions: ActivityTransaction[];
  count: number;
  responseCount: number;
}
