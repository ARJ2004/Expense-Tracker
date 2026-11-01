# Altus — an expense tracker that fills itself in

Altus is an Android-first personal finance app for India. Instead of asking you to type in every
UPI payment, it reads the bank SMS already on your phone and the statements your bank emails you,
turns them into one clean ledger, and tells you where the month went.

> **Status:** Sprints 1–8 of 13 are done. Statements, SMS capture, the ledger and the dashboard all
> work end to end on Android. See the [sprint plan](https://claude.ai/artifact/GjFaMTV2YU3QTDN75ao8Nn).

## What it does

- **Bank SMS capture.** Reads debit and credit alerts from HDFC, ICICI, SBI and Axis. SMS are
  parsed on the phone and only the parsed fields (amount, date, payee, last 4 digits) reach the
  server, never the message text. OTPs, offers and reminders are ignored.
- **Statement import.** CSV, XLSX and PDF statements, including password-protected PDFs. Each bank
  has its own adapter, and a generic adapter handles everything else by reading the column headers.
- **One ledger, no duplicates.** The same payment from an SMS, a statement and a manual entry
  becomes one transaction. Every source goes through the same `ingest()` pipeline and its dedup rules.
- **Categories that learn.** Payees are categorized automatically, and your corrections are remembered.
- **Home dashboard.** What you spent this month, your income, what's left, and where it went.
- **Manual entry.** A quick Add sheet with a number pad for cash and anything the bank doesn't tell you about.
- **Your data stays yours.** Search, filters, CSV export, and full account deletion from Settings.

## Supported banks

| Bank  | SMS alerts | Statements      |
|-------|:----------:|-----------------|
| HDFC  | ✓          | CSV, XLSX, PDF  |
| ICICI | ✓          | CSV, XLSX, PDF  |
| SBI   | ✓          | CSV, XLSX, PDF  |
| Axis  | ✓          | CSV, XLSX, PDF  |
| Others| —          | Generic adapter |

Adding a bank means adding one file: a `SmsTemplate` in `packages/parsers/src/sms/templates/` or a
`StatementAdapter` in `packages/parsers/src/statement/adapters/`, registered in that folder's list.

## How it works

```
 Phone                                         API (NestJS)                     PostgreSQL
 ─────                                         ────────────                     ──────────
 Bank SMS ──► parse on device ──┐
                                ├──► /v1/ingest/batch ──┐
 Manual entry ──────────────────┘                       ├──► ingest() ──► dedup ──► transactions
 Statement upload ──────────────────► /v1/imports ──────┘     (one pipeline,        (integer paise,
                                      (pg-boss job:            every source)          per user)
                                       CSV / XLSX / PDF)
```

Money is integer paise everywhere, from the parser to the database to the screen. Dates are IST.
Every query is scoped to the signed-in user, and someone else's record returns 404.

## Tech stack

| Layer    | Stack |
|----------|-------|
| Mobile   | React Native 0.88 (bare, Android), TypeScript, TanStack Query, Zustand, MMKV, Kotlin native module for SMS |
| API      | Node.js 22, NestJS 11, Prisma 6, PostgreSQL 16, pg-boss for background jobs, OpenAPI at `/v1/docs` |
| Parsing  | pdf.js for PDFs, ExcelJS for XLSX, Papa Parse for CSV |
| Ops      | Sentry crash reporting, encrypted nightly `pg_dump` backups to S3 (`infra/backup`) |

## Repository layout

```
apps/api/              NestJS + Prisma API (port 4000), one module per feature
apps/mobile/           React Native app, one folder per feature under src/features/
packages/domain/       money (paise), IST dates, enums, NormalizedTxn — no framework code
packages/parsers/      SMS templates and statement adapters, shared by the app and the API
packages/api-client/   typed client generated from the API's OpenAPI spec
packages/config/       shared TypeScript and ESLint config
infra/backup/          database backup script and S3 lifecycle rule
```

## Design

The product is specified in three living documents:

- [Design doc](https://claude.ai/artifact/UfhGYx6qecHe5yknGpmQJn): architecture, data model, API and the ingest pipeline
- [Sprint plan](https://claude.ai/artifact/GjFaMTV2YU3QTDN75ao8Nn): S1–S13 backlogs and definition of done
- [Screens and theme](https://claude.ai/artifact/KM1W7448yJpGQNzt3RXZ1F): the locked Altus Light and Altus Dark screens

## Getting started

You need Node.js 22.13+, PostgreSQL 16, and Android Studio with an emulator or a phone.

```bash
corepack enable                          # provides pnpm 9
pnpm install
pnpm --filter "./packages/*" run build
cp apps/api/.env.example apps/api/.env   # then set DATABASE_URL and JWT_ACCESS_SECRET
pnpm --filter @et/api run prisma:deploy
pnpm --filter @et/api run seed:demo      # optional: a month of demo transactions
```

In development the API accepts `dev:<email>` as a sign-in token (`DEV_AUTH_ENABLED=true`), so the
app's **Continue as dev** button works before the Google OAuth clients exist.

End-to-end tests use their own database from `apps/api/.env.test`, never the dev database:

```bash
createdb expense_tracker_test
printf 'NODE_ENV=test\nDATABASE_URL=postgresql://localhost:5432/expense_tracker_test\n' > apps/api/.env.test
```

## Everyday commands

```bash
pnpm --filter @et/api run dev            # API on http://localhost:4000/v1 (docs at /v1/docs)
pnpm --filter @et/mobile run start       # Metro bundler
pnpm --filter @et/mobile run android     # build and install on the emulator or phone
pnpm run lint && pnpm run typecheck && pnpm run test
pnpm --filter @et/api run test:e2e
pnpm run api-client:generate             # after changing any API route or DTO
```

The Android emulator reaches the API on your computer at `http://10.0.2.2:4000`. A phone on USB
can use `adb reverse tcp:4000 tcp:4000`.

## Testing the SMS parser on real messages

Real SMS never go into git. To turn your own inbox into anonymized test cases:

```bash
adb shell content query --uri content://sms/inbox --projection address:body:date \
  > packages/parsers/fixtures/sms/raw/inbox.txt
pnpm --filter @et/parsers sms:anonymize packages/parsers/fixtures/sms/raw/inbox.txt
```

`raw/` is gitignored. The script replaces account digits, reference numbers, names, UPI IDs, phone
numbers and balances, then appends drafts to `fixtures/sms/real.json`. Read each draft and set
`reviewed: true` before it counts as a test. A privacy test fails the build if a committed SMS
still contains a personal phone number, an email or a full account number.

## Ground rules

- Every transaction write goes through `IngestService.ingest()`. Nothing else writes to `transactions`.
- Bank differences live in adapters and templates, never in `if (bank === …)` branches.
- Amounts are integer paise. No floats, anywhere.
- Secrets, raw SMS and real statements are never committed.
