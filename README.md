# Expense Tracker (Altus)

Android-first personal finance app for India. Design doc, sprint plan and locked screens:

- Design doc: https://claude.ai/artifact/UfhGYx6qecHe5yknGpmQJn
- Sprint plan: https://claude.ai/artifact/GjFaMTV2YU3QTDN75ao8Nn
- Screens and theme: https://claude.ai/artifact/KM1W7448yJpGQNzt3RXZ1F

## Layout

```
apps/api/              NestJS + Prisma API (port 4000)
apps/mobile/           React Native app (Android)
packages/domain/       money (paise), IST dates, enums, NormalizedTxn — no framework code
packages/parsers/      statement adapters and SMS templates (interfaces in Sprint 1)
packages/api-client/   typed client generated from the API's OpenAPI spec
packages/config/       shared TypeScript and ESLint config
```

## First-time setup

```bash
corepack enable                      # provides pnpm 9
pnpm install
pnpm --filter "./packages/*" run build
cp apps/api/.env.example apps/api/.env   # then set DATABASE_URL
pnpm --filter @et/api run prisma:deploy
```

End-to-end tests use a separate database from `apps/api/.env.test` (never the shared dev database):

```bash
createdb expense_tracker_test
printf 'NODE_ENV=test\nDATABASE_URL=postgresql://localhost:5432/expense_tracker_test\n' > apps/api/.env.test
```

## Everyday commands

```bash
pnpm --filter @et/api run dev            # API on http://localhost:4000/v1 (docs at /v1/docs)
pnpm --filter @et/mobile run start       # Metro bundler
pnpm --filter @et/mobile run android     # build and install on the emulator
pnpm run lint && pnpm run typecheck && pnpm run test
pnpm --filter @et/api run test:e2e
pnpm run api-client:generate             # after changing any API route or DTO
```

The Android emulator reaches the API on this Mac at `http://10.0.2.2:4000`.
