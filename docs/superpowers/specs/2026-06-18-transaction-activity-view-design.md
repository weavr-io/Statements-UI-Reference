# Transaction Activity View — Design

**Date:** 2026-06-18
**Status:** Approved (design); implementation plan pending

## Purpose

The demo is a reference for embedders. Today it covers one endpoint —
`GET /managed_accounts/{id}/statement` — which returns a *curated* statement
(`InstrumentStatement`): flat entries with a normalized counterparty, a running
`balanceAfter`, opening/closing balances, and a PDF variant.

This work adds a second pair of endpoints — the raw transaction activity feed for
both managed accounts and managed cards — and a switch to move between the
statement and activity views. The goal is to show an embedder how to call and
render these new endpoints, including how to derive a usable UI from their rawer,
type-specific shape.

## The two shapes (why activity needs new code)

**Statement** (`/managed_accounts/{id}/statement`) — already implemented:
- `{ openingBalance, closingBalance, entries[], count, responseCount, footer }`
- Each entry is flat and pre-normalized: `entryId`, `transaction.{type,subtype}`,
  `timestamp`, `balanceAdjustment`, `balanceAfter`, normalized `counterparty`,
  `fee`, `forex`, `executingAccessInstrument`.
- Has a PDF representation via the `Accept` header.

**Activity** (`/managed_accounts/{id}/transactions`, `/managed_cards/{id}/transactions`):
- `{ responseCount, transactions[], count }`
- Each item is a common **envelope** plus a deeply type-specific raw `transaction`:
  - Envelope: `id`, `type`, `direction` (`CREDIT|DEBIT`), `status`, `amount`,
    `creationTimestamp`, `lastUpdatedTimestamp`, and sometimes `fee`.
  - `transaction`: varies by `type` — card payments carry `events[]`
    (AUTHORISATION/SETTLEMENT), `merchant`, `card`; outgoing wires carry a
    destination IBAN/name; incoming wires carry `senderName`/`senderReference`;
    sends/transfers carry source/destination instrument ids; fees carry
    `feeType`/`relatedTransactionId`; system transactions carry little.
- **No running balance, no normalized counterparty.** The embedder must dig into
  the raw `transaction` per `type`. That extraction is the reference's teaching core.

The same envelope + union serves both instruments. The instrument only changes the
fetch URL and which `type` values appear (card payments only on cards; wires/sends
on the account).

## Approach

Chosen: **faithful types + per-type extraction helpers**. Type the response exactly
as it comes off the wire (envelope + discriminated union on the raw `transaction`,
keyed by envelope `type`), and add a small pure module that maps each raw type to a
display model. Reuses the existing table/badge/detail-panel CSS for visual parity.

Rejected:
- **Adapt activity into `StatementEntry`** — would fabricate a `balanceAfter` and a
  normalized counterparty and hide the real activity schema. A reference must not lie
  about the wire shape.
- **Raw JSON dump** — poor UX, poor reference quality.

## Components

### 1. API layer — canonical reference pair (mirrors `statements.ts` + `types.ts`)

`src/api/activity-types.ts`
- Reuses `CurrencyAmount`, `TransactionType`, `CurrencyCode` from `api/types.ts`.
- Adds:
  - `Direction = 'CREDIT' | 'DEBIT'`
  - `ActivityStatus` — known set (`COMPLETED`, `REVERSED`, `PENDING`, …) as a string
    union with open-string fallback.
  - Per-type raw `transaction` interfaces: `SendActivity`, `TransferActivity`,
    `OutgoingWireActivity`, `IncomingWireActivity`, `FeeActivity`,
    `SystemTransactionActivity`, `CardPaymentActivity` (with `events[]`, `merchant`,
    `card`). Fields modelled from the captured fixtures; clearly commented as
    per-type.
  - `ActivityTransaction` envelope: `{ id, type, direction, status, amount,
    creationTimestamp, lastUpdatedTimestamp, fee?, transaction }`, where `transaction`
    is the union discriminated by the envelope `type`.
  - `InstrumentTransactions` response: `{ transactions, count, responseCount }`.

`src/api/activity.ts` (self-contained, like `statements.ts`)
- `ActivityParams`: `offset?`, `limit?`, `sortOrder?` (kept minimal).
- Own `ActivityError` class (mirrors `StatementError` so the file is copyable standalone).
- `fetchAccountActivity(baseUrl, authToken, accountId, params)` →
  `GET /managed_accounts/{id}/transactions`
- `fetchCardActivity(baseUrl, authToken, cardId, params)` →
  `GET /managed_cards/{id}/transactions`
- JSON only (`Accept: application/json`, `api-version: 2`). No PDF.

### 2. Extraction module — the teaching core

`src/activity-display.ts` — pure functions, no React:
- `activityCounterparty(tx: ActivityTransaction): CounterpartyDisplay | null` —
  switch on envelope `type`, read the real raw fields:
  - `card_payments` → `transaction.merchant.name` (+ MCC/country)
  - `outgoing_wire_transfers` → `transaction.destination.name` / IBAN
  - `incoming_wire_transfers` → `transaction.senderName` / `senderReference`
  - `sends` / `transfers` → source/destination instrument ids
  - `fees` → `feeType` + `relatedTransactionId`
  - `system_transactions` → none
- `activityStatusTone(status): StatusTone` — maps status to a visual tone.

`CounterpartyDisplay` mirrors the shape used by `EntriesTable` (`primary`,
`secondary?`, `tone`, `initial`).

### 3. UI components (match existing visual language, reuse CSS)

- `src/components/ActivityView.tsx` — parallels `StatementView`. Props:
  `{ baseUrl, authToken, instrument: { type: 'managed_accounts' | 'managed_cards',
  id }, params }`. Picks the fetch fn by instrument type; same loading/ready/error
  states. Renders `ActivitySummary` + `ActivityTable`.
- `src/components/ActivitySummary.tsx` — parallels `StatementSummary` but honest
  about activity having **no running balance**: hero = net flow, stat strip =
  Money in / Money out / Fees / Count, plus type-breakdown chips (reuse
  `categoryTone`). No opening/closing balance.
- `src/components/ActivityTable.tsx` — columns **Posted · Activity · Counterparty ·
  Status · Amount** (replaces statement's "Balance after" with **Status**).
  Expandable rows reusing `entry-row`, type-badge, and `cp-avatar` classes. Amount
  sign derives from `direction`.
- `src/components/ActivityDetailPanel.tsx` — sections: Identifiers (id, type,
  direction, status, related id), Timestamps (creation/lastUpdated), Amount + fee,
  extracted Counterparty, a **card-payment events timeline** (AUTHORISATION/
  SETTLEMENT with amounts, authCode, result) for `card_payments`, and a Raw JSON
  toggle.

### 4. Switch + shell

- State lifted into `App`: `mode: 'statement' | 'activity'` and
  `instrument: 'account' | 'card'`.
- `src/components/ViewSwitcher.tsx` — primary `Statement | Activity` segmented
  control (top-left). The secondary `Account | Card` segmented control renders only
  when `mode === 'activity'`.
- `App` renders `StatementView` (account) or `ActivityView` (account or card).
- PDF download stays inside the statement view only.

### 5. Config

`src/config.ts` — add to `DemoConfig`:
- `cardId: string`
- `activityParams: ActivityParams` (limit, offset, sortOrder)

Keep statement `params` as-is. Same 👉-comment guidance for replacing values.

### 6. Mock middleware

`vite.config.ts` — refactor the matcher to a small `{ pattern, file }` route table:
- `/managed_accounts/{id}/statement` → `statement.json` / `statement.pdf` (unchanged)
- `/managed_accounts/{id}/transactions` → `activity_account.json`
- `/managed_cards/{id}/transactions` → `activity_card.json`

Activity routes are JSON only.

### 7. Styles

`src/styles.css` — add the segmented-switch CSS, a `status-badge` (toned via
`activityStatusTone`), and the card-payment events-timeline. Otherwise reuse existing
table/badge/detail classes for parity.

### 8. README

- New "Transactions / activity endpoint" section: both endpoint paths, the
  `Accept: application/json` header, `api-version: 2`, the new files, and
  regeneration curls for account and card.
- Update the "What to copy" table to add `src/api/activity.ts`,
  `src/api/activity-types.ts`, and `src/activity-display.ts`.
- Note the statement-vs-activity distinction (curated + PDF vs raw feed).

## Data flow

```
App (mode, instrument state)
 ├─ ViewSwitcher ──> sets mode / instrument
 └─ body:
     mode=statement ─> StatementView ─> fetchStatementJson ─> StatementSummary + EntriesTable
     mode=activity   ─> ActivityView  ─> fetchAccountActivity | fetchCardActivity
                                          └─> ActivitySummary + ActivityTable
                                                                   └─ ActivityDetailPanel
            (rows/detail use activity-display.ts for counterparty + status tone)
```

## Error handling

- `ActivityView` mirrors `StatementView`: `loading | ready | error` states, rendering
  the existing `ErrorBanner` on failure. `ActivityError` carries status + body like
  `StatementError`.
- Extraction helpers return `null` (not throw) for missing/unknown shapes; the table
  renders an em-dash, matching `EntriesTable`'s handling of absent counterparties.
- Unknown `status` / `type` values fall through to humanized raw strings (matching the
  existing `humanise` fallback in `labels.ts`).

## Testing / verification

No test runner exists; the project is intentionally React-only. Verification:
`npm run typecheck` and `npm run build`, then run the dev server and exercise all
three views (statement, account activity, card activity), expanding rows including a
card payment. A test framework (vitest) is **not** added — it would change the
project's minimal-dependency character. If unit tests on `activity-display.ts` are
wanted later, vitest can be added then.

## Out of scope

- PDF for activity (the endpoints are JSON only).
- Pagination UI / infinite scroll (params support offset/limit; no UI control).
- Server-side filtering controls (type/state filters) beyond what config sets.
- Real auth / live backend wiring (config placeholders unchanged).
