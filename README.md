# Weavr Statements API — Embedder Reference

A minimal React + TypeScript reference for calling the new managed account statement endpoint, rendering the JSON response, and downloading the PDF.

The **source code is the product**. The running UI is here to prove it works and make the reference feel concrete. You're expected to copy a handful of files into your own app, not fork this project.

## Run it

```bash
npm install
npm run dev
```

The dev server serves a captured fixture so the app works out of the box. Open the printed URL.

## What to copy

| File | What it gives you |
|---|---|
| [`src/api/statements.ts`](./src/api/statements.ts) | The two `fetch` functions (JSON + PDF). The canonical reference. |
| [`src/api/types.ts`](./src/api/types.ts) | TypeScript types for the statement response. |
| [`src/components/DownloadPdfButton.tsx`](./src/components/DownloadPdfButton.tsx) | The Blob → object URL → anchor → revoke download pattern. |
| [`src/format.ts`](./src/format.ts) | `formatMoney` (handles minor-unit currencies) and `formatTimestamp`. |

Everything else is presentation glue you can replace freely.

## Wire it to your OPC

1. Open `src/config.ts` and set `baseUrl`, `authToken`, and `accountId` to real values for your environment.
2. In `vite.config.ts`, delete the `statementMockPlugin()` function and remove it from the `plugins: [...]` array. The dev middleware is purely for the bundled demo — once `baseUrl` points at a real OPC, you don't want a local interceptor in the way.
3. Configure CORS / proxy in your environment so the browser can reach OPC.

## Regenerating the fixture

The bundled `public/fixtures/statement.json` and `statement.pdf` were captured from a local OPC. To refresh:

```bash
# JSON
curl -sS \
  -H 'Accept: application/json' \
  -H 'Authorization: Bearer <YOUR_TOKEN>' \
  -H 'api-version: 2' \
  '<BASE_URL>/managed_accounts/<ACCOUNT_ID>/statement?startPeriod=<MS>&endPeriod=<MS>&limit=50&sortOrder=DESC' \
  > public/fixtures/statement.json

# PDF
curl -sS \
  -H 'Accept: application/pdf' \
  -H 'Authorization: Bearer <YOUR_TOKEN>' \
  -H 'api-version: 2' \
  '<BASE_URL>/managed_accounts/<ACCOUNT_ID>/statement?startPeriod=<MS>&endPeriod=<MS>&limit=50&sortOrder=DESC' \
  -o public/fixtures/statement.pdf
```

## Endpoint reference

The endpoint covered here is `GET /managed_accounts/{id}/statement`. Content negotiation is via the `Accept` header:

- `Accept: application/json` → `InstrumentStatement` (see `src/api/types.ts`)
- `Accept: application/pdf` → PDF binary

The full schema lives in `support/common-models/src/main/resources/commons.yml` (`StatementV2`) in the OPC repo. A symmetric endpoint exists for managed cards at `GET /managed_cards/{id}/statement` — same shape, same query params; extending this reference to cover it is a straight copy.
