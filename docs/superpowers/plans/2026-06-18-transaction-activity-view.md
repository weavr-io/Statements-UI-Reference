# Transaction Activity View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a transaction-activity view (account + card) alongside the existing statement view, with a switch to move between them, as a reference for embedders consuming the `/transactions` endpoints.

**Architecture:** Type the raw transactions response faithfully (a common envelope + a per-type `transaction` union), provide a pure extraction module that derives a display model from each raw type, and add Activity components that mirror the existing Statement components and reuse the same CSS. A `ViewSwitcher` in `App` selects mode (Statement/Activity) and instrument (Account/Card).

**Tech Stack:** React 18 + TypeScript + Vite. No test runner exists and none is added (the project is intentionally React-only). **Per-task verification is `npm run typecheck`; final UI verification is a manual dev-server pass.** This replaces the usual write-failing-test step.

---

## File Structure

**Create:**
- `src/api/activity-types.ts` — types for the transactions response (envelope + per-type union).
- `src/api/activity.ts` — fetch functions for account/card transactions (+ `ActivityError`, `ActivityParams`).
- `src/activity-display.ts` — pure helpers mapping raw transactions to display models.
- `src/components/ActivityView.tsx` — fetch + state container for activity.
- `src/components/ActivitySummary.tsx` — hero/stat-strip/breakdown for activity.
- `src/components/ActivityTable.tsx` — activity table with expandable rows.
- `src/components/ActivityDetailPanel.tsx` — expanded per-transaction detail.
- `src/components/ViewSwitcher.tsx` — segmented controls for mode + instrument.

**Modify:**
- `src/config.ts` — add `cardId`, `activityParams`.
- `vite.config.ts` — add mock routes for the two `/transactions` endpoints.
- `src/components/ErrorBanner.tsx` — recognize any error with `status`+`body`, not just `StatementError`.
- `src/App.tsx` — hold mode/instrument state; render `ViewSwitcher` + the selected view.
- `src/styles.css` — segmented-switch, status-badge, card-events styles.
- `README.md` — document the activity endpoints + new files.

---

### Task 1: Activity response types

**Files:**
- Create: `src/api/activity-types.ts`

- [ ] **Step 1: Write the types file**

```typescript
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
  result?: string;
  settlementState?: string;
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
```

- [ ] **Step 2: Verify it typechecks**

Run: `npm run typecheck`
Expected: PASS (no errors).

- [ ] **Step 3: Commit**

```bash
git add src/api/activity-types.ts
git commit -m "feat: add transaction activity response types"
```

---

### Task 2: Activity fetch module

**Files:**
- Create: `src/api/activity.ts`

- [ ] **Step 1: Write the fetch module**

```typescript
/* Canonical reference for the transaction-activity endpoints.
 *
 *   GET /managed_accounts/{id}/transactions   (account feed)
 *   GET /managed_cards/{id}/transactions       (card feed)
 *
 * Both share the same envelope shape; only the URL and which transaction
 * `type`s appear differ. Copy this file together with api/activity-types.ts. */

import type { InstrumentTransactions } from './activity-types';
import type { SortOrder } from './types';

const API_VERSION = '2';

export interface ActivityParams {
  offset?: number;
  limit?: number;
  sortOrder?: SortOrder;
}

export class ActivityError extends Error {
  constructor(public readonly status: number, public readonly body: string) {
    super(`Activity request failed with status ${status}`);
    this.name = 'ActivityError';
  }
}

type InstrumentKind = 'managed_accounts' | 'managed_cards';

function buildQueryString(params: ActivityParams): string {
  const qs = new URLSearchParams();
  if (params.offset !== undefined) qs.set('offset', String(params.offset));
  if (params.limit !== undefined) qs.set('limit', String(params.limit));
  if (params.sortOrder) qs.set('sortOrder', params.sortOrder);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

async function fetchTransactions(
  baseUrl: string,
  authToken: string,
  instrument: InstrumentKind,
  instrumentId: string,
  params: ActivityParams,
): Promise<InstrumentTransactions> {
  const url = `${baseUrl}/${instrument}/${instrumentId}/transactions${buildQueryString(params)}`;
  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Accept': 'application/json',
      'api-version': API_VERSION,
    },
  });
  if (!res.ok) throw new ActivityError(res.status, await res.text());
  return (await res.json()) as InstrumentTransactions;
}

export function fetchAccountActivity(
  baseUrl: string,
  authToken: string,
  accountId: string,
  params: ActivityParams,
): Promise<InstrumentTransactions> {
  return fetchTransactions(baseUrl, authToken, 'managed_accounts', accountId, params);
}

export function fetchCardActivity(
  baseUrl: string,
  authToken: string,
  cardId: string,
  params: ActivityParams,
): Promise<InstrumentTransactions> {
  return fetchTransactions(baseUrl, authToken, 'managed_cards', cardId, params);
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/api/activity.ts
git commit -m "feat: add activity fetch functions for account and card"
```

---

### Task 3: Activity display extraction module

**Files:**
- Create: `src/activity-display.ts`

- [ ] **Step 1: Write the extraction module**

```typescript
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
```

- [ ] **Step 2: Verify it typechecks**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/activity-display.ts
git commit -m "feat: add activity display extraction helpers"
```

---

### Task 4: Config additions

**Files:**
- Modify: `src/config.ts`

- [ ] **Step 1: Replace the file contents**

```typescript
import type { StatementParams } from './api/statements';
import type { ActivityParams } from './api/activity';

/* 👉 Replace baseUrl with your OPC base URL (e.g. 'https://api.weavr.io/multi') when wiring
 * this demo to your own backend. The empty default routes the request through the dev-only
 * mock middleware in vite.config.ts.
 *
 * 👉 Replace authToken with a real Authorization bearer token.
 * 👉 Replace accountId / cardId with real managed account / card ids from your environment. */
export interface DemoConfig {
  baseUrl: string;
  authToken: string;
  accountId: string;
  cardId: string;
  params: StatementParams;
  activityParams: ActivityParams;
}

export const config: DemoConfig = {
  baseUrl: '',
  authToken: 'demo-token',
  accountId: '123456',
  cardId: '654321',
  params: {
    startPeriod: Date.UTC(2026, 4, 1),  // 2026-05-01 UTC
    endPeriod:   Date.UTC(2026, 4, 31), // 2026-05-31 UTC
    limit: 50,
    sortOrder: 'DESC',
  },
  activityParams: {
    limit: 50,
    offset: 0,
    sortOrder: 'DESC',
  },
};
```

- [ ] **Step 2: Verify it typechecks**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/config.ts
git commit -m "feat: add cardId and activityParams to demo config"
```

---

### Task 5: Mock middleware routes for /transactions

**Files:**
- Modify: `vite.config.ts`

- [ ] **Step 1: Replace the `statementMockPlugin` function**

Replace the entire `function statementMockPlugin(): Plugin { ... }` block (lines 9–36) with:

```typescript
/* Dev-only. Delete this plugin and its registration when adopting in your own app.
 * Serves captured fixtures for the statement and transaction-activity endpoints so
 * the demo runs zero-setup. Statement supports content negotiation (JSON or PDF);
 * the activity endpoints are JSON only. */
function statementMockPlugin(): Plugin {
  const fixturesDir = resolve(__dirname, 'public/fixtures');

  // First matching pattern wins. `pdf` is only set for routes that content-negotiate.
  const routes: Array<{ pattern: RegExp; json: string; pdf?: string }> = [
    { pattern: /^\/managed_accounts\/\d+\/statement$/, json: 'statement.json', pdf: 'statement.pdf' },
    { pattern: /^\/managed_accounts\/\d+\/transactions$/, json: 'activity_account.json' },
    { pattern: /^\/managed_cards\/\d+\/transactions$/, json: 'activity_card.json' },
  ];

  return {
    name: 'statement-mock',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.method !== 'GET' || !req.url) return next();
        // Strip query string before matching the path.
        const path = req.url.split('?')[0];
        const route = routes.find(r => r.pattern.test(path));
        if (!route) return next();

        const accept = String(req.headers.accept ?? '');
        const wantsPdf = accept.includes('application/pdf') && Boolean(route.pdf);
        const fileName = wantsPdf ? route.pdf! : route.json;
        try {
          const body = readFileSync(resolve(fixturesDir, fileName));
          res.setHeader('Content-Type', wantsPdf ? 'application/pdf' : 'application/json');
          res.statusCode = 200;
          res.end(body);
        } catch (e) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'text/plain');
          res.end(`statement-mock: failed to read ${fileName}: ${(e as Error).message}`);
        }
      });
    },
  };
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Verify routes serve fixtures**

Run: `npm run dev` in the background, then in another shell:
```bash
curl -s -H 'Accept: application/json' 'http://localhost:5173/managed_accounts/123456/transactions' | head -c 60
curl -s -H 'Accept: application/json' 'http://localhost:5173/managed_cards/654321/transactions' | head -c 60
```
Expected: first prints the start of `activity_account.json` (`{"responseCount":26,...`), second the start of `activity_card.json` (`{"responseCount":9,...`). (Vite may pick a different port — use the one it prints.) Stop the dev server afterward.

- [ ] **Step 4: Commit**

```bash
git add vite.config.ts
git commit -m "feat: mock the account and card transactions endpoints"
```

---

### Task 6: Generalize ErrorBanner

**Files:**
- Modify: `src/components/ErrorBanner.tsx`

**Why:** `ErrorBanner` only extracts `status`/`body` from `StatementError`. `ActivityError` carries the same fields but is a different class, so without this it would only show the generic message. Recognize the shape structurally so both work.

- [ ] **Step 1: Replace the file contents**

```typescript
interface Props {
  error: unknown;
}

/* Both StatementError and ActivityError carry { status: number, body: string }.
 * Recognize that shape structurally rather than coupling to one class. */
function statusAndBody(error: unknown): { status?: number; body: string } {
  if (
    error !== null &&
    typeof error === 'object' &&
    'status' in error &&
    typeof (error as { status: unknown }).status === 'number' &&
    'body' in error &&
    typeof (error as { body: unknown }).body === 'string'
  ) {
    const e = error as { status: number; body: string };
    return { status: e.status, body: e.body };
  }
  if (error instanceof Error) return { body: error.message };
  return { body: String(error) };
}

export function ErrorBanner({ error }: Props) {
  const { status, body } = statusAndBody(error);
  return (
    <div className="error-banner" role="alert">
      <strong>Request failed{status !== undefined ? ` (${status})` : ''}.</strong>
      {body && <pre>{body}</pre>}
    </div>
  );
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/ErrorBanner.tsx
git commit -m "refactor: recognize any status+body error in ErrorBanner"
```

---

### Task 7: ActivityDetailPanel

**Files:**
- Create: `src/components/ActivityDetailPanel.tsx`

- [ ] **Step 1: Write the component**

```tsx
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
```

- [ ] **Step 2: Verify it typechecks**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/ActivityDetailPanel.tsx
git commit -m "feat: add ActivityDetailPanel with card event timeline"
```

---

### Task 8: ActivityTable

**Files:**
- Create: `src/components/ActivityTable.tsx`

- [ ] **Step 1: Write the component**

```tsx
import { Fragment, useState, type KeyboardEvent } from 'react';
import type { ActivityTransaction } from '../api/activity-types';
import { formatMoney, formatTimestamp } from '../format';
import { transactionLabel, categoryTone } from '../labels';
import { activityCounterparty, activityStatusTone } from '../activity-display';
import { ActivityDetailPanel } from './ActivityDetailPanel';

interface Props {
  transactions: ActivityTransaction[];
}

function ChevronIcon() {
  return (
    <svg className="chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function ActivityRow({ tx }: { tx: ActivityTransaction }) {
  const [expanded, setExpanded] = useState(false);
  const cp = activityCounterparty(tx);
  const tone = categoryTone(tx.type);
  const credit = tx.direction === 'CREDIT';

  const onRowClick = () => setExpanded(v => !v);
  const onRowKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setExpanded(v => !v);
    }
  };

  return (
    <Fragment>
      <tr
        className={`entry-row expandable${expanded ? ' expanded' : ''}`}
        onClick={onRowClick}
        onKeyDown={onRowKey}
        tabIndex={0}
        role="button"
        aria-expanded={expanded}
      >
        <td className="entry-time">{formatTimestamp(tx.creationTimestamp)}</td>
        <td>
          <span className={`type-badge tone-${tone}`}>
            <span className="type-badge-dot" aria-hidden="true" />
            {transactionLabel(tx.type)}
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
        <td>
          <span className={`status-badge status-${activityStatusTone(tx.status)}`}>{tx.status}</span>
        </td>
        <td className={`num amount ${credit ? 'credit' : 'debit'}`}>
          <span className="amount-value">{credit ? '+' : '−'}{formatMoney(tx.amount)}</span>
          <ChevronIcon />
        </td>
      </tr>
      {expanded && (
        <tr className="entry-detail-row">
          <td colSpan={5}>
            <ActivityDetailPanel tx={tx} />
          </td>
        </tr>
      )}
    </Fragment>
  );
}

export function ActivityTable({ transactions }: Props) {
  if (transactions.length === 0) {
    return <p className="empty">No activity in this period.</p>;
  }
  return (
    <div className="entries-wrapper">
      <table className="entries">
        <thead>
          <tr>
            <th>Posted</th>
            <th>Activity</th>
            <th>Counterparty</th>
            <th>Status</th>
            <th className="num">Amount</th>
          </tr>
        </thead>
        <tbody>
          {/* `id` is not unique across the feed (a fee and its parent share an id),
              so the React key combines id + type + index. */}
          {transactions.map((tx, i) => (
            <ActivityRow key={`${tx.id}-${tx.type}-${i}`} tx={tx} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/ActivityTable.tsx
git commit -m "feat: add ActivityTable with expandable rows"
```

---

### Task 9: ActivitySummary

**Files:**
- Create: `src/components/ActivitySummary.tsx`

- [ ] **Step 1: Write the component**

```tsx
import type { ActivityTransaction } from '../api/activity-types';
import type { TransactionType, CurrencyAmount } from '../api/types';
import { formatMoney } from '../format';
import { TRANSACTION_TYPE_LABEL, categoryTone } from '../labels';

interface Props {
  transactions: ActivityTransaction[];
  count: number;
  responseCount: number;
  instrumentLabel: string;
  instrumentId: string;
}

interface Totals {
  in: CurrencyAmount;
  out: CurrencyAmount;
  fees: CurrencyAmount;
  net: CurrencyAmount;
}

function totals(txs: ActivityTransaction[], currency: string): Totals {
  let inAmount = 0;
  let outAmount = 0;
  let feeAmount = 0;
  for (const tx of txs) {
    const a = tx.amount.amount;
    if (tx.direction === 'CREDIT') inAmount += a;
    else outAmount += a;
    if (tx.type === 'fees') feeAmount += a;
  }
  return {
    in: { currency, amount: inAmount },
    out: { currency, amount: outAmount },
    fees: { currency, amount: feeAmount },
    net: { currency, amount: inAmount - outAmount },
  };
}

function typeBreakdown(txs: ActivityTransaction[]): Array<{ type: TransactionType; count: number }> {
  const counts = new Map<TransactionType, number>();
  for (const tx of txs) counts.set(tx.type, (counts.get(tx.type) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => ({ type, count }));
}

export function ActivitySummary({ transactions, count, responseCount, instrumentLabel, instrumentId }: Props) {
  const currency = transactions[0]?.amount.currency ?? 'EUR';
  const t = totals(transactions, currency);
  const breakdown = typeBreakdown(transactions);

  return (
    <section className="summary">
      <div className="hero">
        <div className="hero-label">Net flow</div>
        <div className="hero-value">{formatMoney(t.net)}</div>
        <div className="hero-period">{responseCount} of {count} transactions</div>
      </div>

      <div className="stat-strip">
        <div className="stat stat-credit">
          <div className="stat-label">Money in</div>
          <div className="stat-value">{formatMoney(t.in)}</div>
        </div>
        <div className="stat stat-debit">
          <div className="stat-label">Money out</div>
          <div className="stat-value">{formatMoney(t.out)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Total fees</div>
          <div className="stat-value">{formatMoney(t.fees)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">{instrumentLabel}</div>
          <div className="stat-value">{instrumentId}</div>
        </div>
      </div>

      {breakdown.length > 0 && (
        <div className="breakdown">
          {breakdown.map(({ type, count }) => (
            <span key={type} className={`breakdown-chip tone-${categoryTone(type)}`}>
              <span className="breakdown-count">{count}</span>
              <span className="breakdown-label">{TRANSACTION_TYPE_LABEL[type] ?? type}</span>
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/ActivitySummary.tsx
git commit -m "feat: add ActivitySummary with net flow and breakdown"
```

---

### Task 10: ActivityView

**Files:**
- Create: `src/components/ActivityView.tsx`

- [ ] **Step 1: Write the component**

```tsx
import { useEffect, useState } from 'react';
import { fetchAccountActivity, fetchCardActivity, type ActivityParams } from '../api/activity';
import type { InstrumentTransactions } from '../api/activity-types';
import { ActivitySummary } from './ActivitySummary';
import { ActivityTable } from './ActivityTable';
import { ErrorBanner } from './ErrorBanner';

export type ActivityInstrument = 'account' | 'card';

interface Props {
  baseUrl: string;
  authToken: string;
  instrument: ActivityInstrument;
  accountId: string;
  cardId: string;
  params: ActivityParams;
}

type ViewState =
  | { kind: 'loading' }
  | { kind: 'ready'; data: InstrumentTransactions }
  | { kind: 'error'; error: Error };

export function ActivityView({ baseUrl, authToken, instrument, accountId, cardId, params }: Props) {
  const [state, setState] = useState<ViewState>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setState({ kind: 'loading' });
    const request = instrument === 'card'
      ? fetchCardActivity(baseUrl, authToken, cardId, params)
      : fetchAccountActivity(baseUrl, authToken, accountId, params);
    request
      .then(data => { if (!cancelled) setState({ kind: 'ready', data }); })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({ kind: 'error', error: error instanceof Error ? error : new Error(String(error)) });
      });
    return () => { cancelled = true; };
  }, [baseUrl, authToken, instrument, accountId, cardId, params]);

  if (state.kind === 'loading') return <p className="loading">Loading activity…</p>;
  if (state.kind === 'error') return <ErrorBanner error={state.error} />;

  const { data } = state;
  const instrumentLabel = instrument === 'card' ? 'Card' : 'Account';
  const instrumentId = instrument === 'card' ? cardId : accountId;

  return (
    <article className="statement">
      <header className="statement-header">
        <div className="statement-eyebrow">
          <span className="eyebrow-dot" aria-hidden="true" />
          {instrumentLabel} activity
        </div>
      </header>
      <ActivitySummary
        transactions={data.transactions}
        count={data.count}
        responseCount={data.responseCount}
        instrumentLabel={instrumentLabel}
        instrumentId={instrumentId}
      />
      <ActivityTable transactions={data.transactions} />
    </article>
  );
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/ActivityView.tsx
git commit -m "feat: add ActivityView container"
```

---

### Task 11: ViewSwitcher + App wiring

**Files:**
- Create: `src/components/ViewSwitcher.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write `ViewSwitcher.tsx`**

```tsx
export type ViewMode = 'statement' | 'activity';
export type ActivityInstrument = 'account' | 'card';

interface Props {
  mode: ViewMode;
  instrument: ActivityInstrument;
  onModeChange: (mode: ViewMode) => void;
  onInstrumentChange: (instrument: ActivityInstrument) => void;
}

export function ViewSwitcher({ mode, instrument, onModeChange, onInstrumentChange }: Props) {
  return (
    <div className="view-switcher">
      <div className="segmented" role="tablist" aria-label="View">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'statement'}
          className={`segment${mode === 'statement' ? ' active' : ''}`}
          onClick={() => onModeChange('statement')}
        >
          Statement
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'activity'}
          className={`segment${mode === 'activity' ? ' active' : ''}`}
          onClick={() => onModeChange('activity')}
        >
          Activity
        </button>
      </div>

      {mode === 'activity' && (
        <div className="segmented segmented-sub" role="tablist" aria-label="Instrument">
          <button
            type="button"
            role="tab"
            aria-selected={instrument === 'account'}
            className={`segment${instrument === 'account' ? ' active' : ''}`}
            onClick={() => onInstrumentChange('account')}
          >
            Account
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={instrument === 'card'}
            className={`segment${instrument === 'card' ? ' active' : ''}`}
            onClick={() => onInstrumentChange('card')}
          >
            Card
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Replace `src/App.tsx` contents**

```tsx
import { useState } from 'react';
import { config } from './config';
import { StatementView } from './components/StatementView';
import { ActivityView } from './components/ActivityView';
import { ViewSwitcher, type ViewMode, type ActivityInstrument } from './components/ViewSwitcher';

export function App() {
  const [mode, setMode] = useState<ViewMode>('statement');
  const [instrument, setInstrument] = useState<ActivityInstrument>('account');

  return (
    <div className="app-shell">
      <header className="page-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">W</span>
          <span className="brand-name">Weavr</span>
          <span className="brand-divider" aria-hidden="true" />
          <span className="brand-tag">Statements API · Embedder reference</span>
        </div>
      </header>
      <main className="app">
        <ViewSwitcher
          mode={mode}
          instrument={instrument}
          onModeChange={setMode}
          onInstrumentChange={setInstrument}
        />
        {mode === 'statement' ? (
          <StatementView
            baseUrl={config.baseUrl}
            authToken={config.authToken}
            accountId={config.accountId}
            params={config.params}
          />
        ) : (
          <ActivityView
            baseUrl={config.baseUrl}
            authToken={config.authToken}
            instrument={instrument}
            accountId={config.accountId}
            cardId={config.cardId}
            params={config.activityParams}
          />
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Verify it typechecks**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/ViewSwitcher.tsx src/App.tsx
git commit -m "feat: wire ViewSwitcher and activity views into App"
```

---

### Task 12: Styles for switch, status badge, card events

**Files:**
- Modify: `src/styles.css`

- [ ] **Step 1: Append the new styles**

Add to the end of `src/styles.css`, before the final `/* Responsive ... */` section is fine, or at the very end:

```css
/* View switcher ------------------------------------------------------- */

.view-switcher {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}

.segmented {
  display: inline-flex;
  padding: 3px;
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: 10px;
  gap: 2px;
}

.segmented .segment {
  appearance: none;
  border: none;
  background: transparent;
  font: inherit;
  font-size: 0.82rem;
  font-weight: 500;
  color: var(--muted);
  padding: 0.4rem 0.85rem;
  border-radius: 7px;
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease;
}

.segmented .segment:hover {
  color: var(--fg);
}

.segmented .segment.active {
  background: var(--card);
  color: var(--fg);
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
}

.segmented-sub {
  background: transparent;
  border-color: var(--border);
}

/* Status badge -------------------------------------------------------- */

.status-badge {
  display: inline-block;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  border: 1px solid var(--border);
  background: var(--card);
  color: var(--fg-soft);
}

.status-badge.status-ok      { background: var(--credit-bg); border-color: var(--credit-border); color: var(--credit); }
.status-badge.status-pending { background: var(--tone-amber-bg); border-color: var(--tone-amber-bd); color: var(--tone-amber-fg); }
.status-badge.status-warn    { background: var(--debit-bg); border-color: var(--debit-border); color: var(--debit); }
.status-badge.status-neutral { background: var(--tone-slate-bg); border-color: var(--tone-slate-bd); color: var(--tone-slate-fg); }

.amount-value {
  display: inline-block;
  vertical-align: middle;
}

/* Card event timeline ------------------------------------------------- */

.event-timeline {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.event-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  font-size: 0.8rem;
}

.event-type {
  font-weight: 600;
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--accent);
}

.event-meta {
  display: flex;
  gap: 0.6rem;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
  flex-wrap: wrap;
  justify-content: flex-end;
}
```

- [ ] **Step 2: Verify it typechecks (CSS has no checker; confirm the build still compiles)**

Run: `npm run build`
Expected: PASS (`tsc --noEmit` then `vite build` complete with no errors).

- [ ] **Step 3: Commit**

```bash
git add src/styles.css
git commit -m "feat: style view switcher, status badge, and card events"
```

---

### Task 13: README documentation

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add activity rows to the "What to copy" table**

Find the table under "## What to copy" and add these rows after the `src/api/types.ts` row:

```markdown
| [`src/api/activity.ts`](./src/api/activity.ts) | The `fetch` functions for the account + card transaction feeds. |
| [`src/api/activity-types.ts`](./src/api/activity-types.ts) | TypeScript types for the transactions response (envelope + per-type payloads). |
| [`src/activity-display.ts`](./src/activity-display.ts) | How to derive a counterparty/status from the raw, per-type activity payload. |
```

- [ ] **Step 2: Add an "Activity / transactions endpoint" section**

Add this section at the end of the README, after the "Endpoint reference" section:

```markdown
## Transactions / activity endpoint

Alongside the curated statement, the demo covers the raw transaction-activity feed
for both managed accounts and managed cards:

- `GET /managed_accounts/{id}/transactions`
- `GET /managed_cards/{id}/transactions`

Both return the same envelope shape — `{ responseCount, transactions[], count }` —
where each transaction carries a common envelope (`id`, `type`, `direction`,
`status`, `amount`, timestamps) plus a type-specific `transaction` payload. Unlike
the statement, there is **no running balance and no pre-normalized counterparty**:
the consumer derives those from the raw payload per `type` (see
`src/activity-display.ts`). JSON only — there is no PDF representation.

The **Activity** tab in the UI switches between the account and card feeds.

### Regenerating the activity fixtures

```bash
# Account activity
curl -sS \
  -H 'Accept: application/json' \
  -H 'Authorization: Bearer <YOUR_TOKEN>' \
  -H 'api-version: 2' \
  '<BASE_URL>/managed_accounts/<ACCOUNT_ID>/transactions?limit=50&sortOrder=DESC' \
  > public/fixtures/activity_account.json

# Card activity
curl -sS \
  -H 'Accept: application/json' \
  -H 'Authorization: Bearer <YOUR_TOKEN>' \
  -H 'api-version: 2' \
  '<BASE_URL>/managed_cards/<CARD_ID>/transactions?limit=50&sortOrder=DESC' \
  > public/fixtures/activity_card.json
```
```

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: document the transactions/activity endpoints"
```

---

### Task 14: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Typecheck + build**

Run: `npm run build`
Expected: PASS — `tsc --noEmit` reports no errors and `vite build` completes.

- [ ] **Step 2: Manual dev-server pass**

Run: `npm run dev` and open the printed URL. Verify:
- Default **Statement** tab renders the existing statement unchanged.
- Click **Activity** → the **Account | Card** sub-switch appears; **Account** shows 26 transactions with net flow, money in/out, fees, and type breakdown chips.
- Expand an **incoming wire** row → counterparty shows the sender name/reference; raw JSON toggle works.
- Switch to **Card** → shows 9 transactions including a **Card payment** row whose counterparty is the merchant; expand it → the **Card events** timeline lists AUTHORISATION + SETTLEMENT.
- Status badges render with color (COMPLETED = green).
- Switch back to **Statement** → still renders, PDF download button present.

- [ ] **Step 3: Confirm clean git state**

Run: `git status`
Expected: working tree clean (all changes committed). Note: the pre-existing modified fixtures (`statement.json`, `statement.pdf`) and the two new `activity_*.json` fixtures were already present before this work — commit them if desired with a separate `git add public/fixtures && git commit -m "chore: refresh fixtures"`.

---

## Self-Review Notes

- **Spec coverage:** API layer (T1, T2), extraction module (T3), config (T4), mock (T5), the four Activity components (T7–T10), switch + shell (T11), styles (T12), README (T13). ErrorBanner generalization (T6) added beyond the spec because `ActivityError` would otherwise lose its status/body — a correctness fix, not scope creep.
- **No PDF for activity:** enforced in T5 (route has no `pdf`) and `activity.ts` (JSON-only headers).
- **Type consistency:** `ActivityTransaction`, `InstrumentTransactions`, `ActivityParams`, `activityCounterparty`, `activityStatusTone`, `CounterpartyDisplay`, `CpTone`, `ViewMode`, `ActivityInstrument` are used identically across tasks.
- **React key collision:** handled in T8 (ids repeat across a transaction and its fee).
```
