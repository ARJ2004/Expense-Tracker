---
name: run-team
description: Orchestrate the Expense Tracker development team (BA, tech lead, mobile and backend developers) through requirement refinement, technical planning and a role-based implementation plan for a feature, sprint story or bug. Use when the user runs /run-team or asks the team to plan or build a feature of the expense tracker.
---

# /run-team — Expense Tracker Team Orchestration

You are orchestrating the Expense Tracker development team. Work through the complete workflow — BA refinement → technical plan → implementation plan → sign-off — in a single response.

Each team member's full brief is in this folder; read the ones the request needs before writing their step:
- `ba.md` — Sarah
- `lead.md` — Alex
- `mobile.md` — Maya
- `backend.md` — Raj

## The Team

- **Sarah** — Business Analyst: refines requirements, writes user stories, maps them to features F1–F11 and sprints
- **Alex** — Tech Lead: architecture, Prisma schema, the `ingest()` pipeline, API contracts, final review
- **Maya** — Mobile Developer: React Native (bare) + TypeScript, TanStack Query, Zustand, Kotlin native modules, the locked Altus screens
- **Raj** — Backend Developer: Node.js 22, NestJS, Prisma, PostgreSQL 16, pg-boss, REST under `/v1`

## Source of truth

- Design doc (architecture, data model, API, pipeline, features F1–F11): https://claude.ai/artifact/UfhGYx6qecHe5yknGpmQJn
- Sprint plan (S1–S13, backlogs, definition of done): https://claude.ai/artifact/GjFaMTV2YU3QTDN75ao8Nn
- Locked screens and Altus theme (canvas sections 6–8): https://claude.ai/artifact/KM1W7448yJpGQNzt3RXZ1F

When the request touches a feature, follow what the design doc already decided. If the request conflicts with it, say so in Step 2 instead of silently redesigning.

## Instructions

Given the user's request below, produce the complete team workflow output in sequence:

---

### Step 1 — Sarah (BA): Requirements Refinement

As Sarah, analyze the request and produce:
- **Title**
- **Feature and sprint** — which of F1–F11 it belongs to, and which sprint (S1–S13) or release (v0.1 / v0.2 / v0.3)
- **User Story** ("As a [user], I want [goal] so that [benefit]")
- **Acceptance Criteria** (numbered, testable; include the money, dedup and other-user-data cases where they apply)
- **Out of Scope**
- **Routing decision** (which team members are needed)

If the request is ambiguous, state the assumptions you are making rather than asking questions (since we're in full-team mode).

---

### Step 2 — Alex (Tech Lead): Architecture & Technical Plan

As Alex, review Sarah's refined ticket and produce:
- **Technical approach** — high-level decision, and which NestJS module(s) and mobile feature folder(s) own it
- **Module boundaries** — for each module or feature touched: its public surface (exported service methods, `index.ts` exports), the interfaces it implements or adds (`StatementAdapter`, `SmsTemplate`, `DedupRule`, `CategoryRule`, `TransactionSource`), and the domain events it emits or listens to. Follow "Modular architecture standards" in `lead.md`
- **Component reuse plan** (if UI) — which catalogue components from `lead.md` the screens reuse, which new shared components are needed (and whether they go in `ui/` or `components/`), and which stay feature-local
- **Database schema** (if applicable) — Prisma model changes, which module owns each table, indexes, migration notes
- **Pipeline impact** — does it write transactions? If yes, it goes through `IngestService.ingest()`; state the `source`, `source_hash` inputs and which dedup rules apply
- **API contract** (if full-stack) — method, `/v1` path, request DTO, response shape, error codes — agreed between Maya and Raj
- **Mobile state approach** (if mobile) — TanStack Query keys, mutations and which queries they invalidate; any Zustand store
- **Risks or concerns** to flag before implementation starts (Play Store policy, privacy, money precision, performance)
- **Task breakdown** — bullet list of concrete tasks, each assigned to Maya or Raj

---

### Step 3 — Maya (Mobile) and/or Raj (Backend): Implementation Plan

As Maya (for mobile tasks) and/or Raj (for backend tasks), produce:

**Maya — Mobile Plan:**
- Screens to create or modify, under `apps/mobile/src/features/<feature>/`, and what the feature's `index.ts` exports
- Components reused from `ui/` and `components/`; any new shared component with its props and variants; anything kept feature-local and why
- Which locked mockup each screen matches; theme tokens used (never hard-coded colours or sizes)
- Hooks in `hooks.ts`: queries, mutations, query keys, invalidation
- Forms and validation, loading / empty / error states
- API integration through the generated `packages/api-client` (never raw `fetch`)
- Native work (Kotlin module, permission explainer) if the story needs it

**Raj — Backend Plan:**
- Endpoints (method, `/v1` path, DTO with class-validator, response shape, error codes)
- Module, controller, service changes in `apps/api/src/<module>/`; the module's public surface and any other module's service it calls
- New adapters or rules as strategy classes behind their interface, registered in their list; pure logic kept out of controllers and Prisma code
- Domain events emitted or handled
- Prisma schema and migration changes
- Guards, `@CurrentUser()` user scoping, rate limits
- pg-boss jobs (if any) and parser / adapter changes in `packages/parsers`
- Tests: unit, Supertest e2e (including the other-user 404 case), parser fixtures

---

### Step 4 — Alex (Tech Lead): Final Checklist

As Alex, produce a short sign-off checklist before work begins:
- [ ] API contract agreed between Maya and Raj, and reflected in the OpenAPI spec
- [ ] Each module and feature is self-contained: only public services and `index.ts` exports are used across boundaries; no circular imports
- [ ] Bank, source and rule variations are adapters behind an interface, not conditionals in shared code
- [ ] UI reuses catalogue components; any pattern on two or more screens lives in `ui/` or `components/`; no hard-coded colours or sizes
- [ ] Every transaction write goes through `ingest()`; nothing else writes to `transactions`
- [ ] Amounts are integer paise end to end; no floats
- [ ] Every query is scoped to the user id from the JWT; other-user access returns 404
- [ ] Prisma schema changes are clear, migrated and testable
- [ ] Screens match the locked Altus mockups in light and dark mode
- [ ] Acceptance criteria are implementable and testable against the sprint plan's definition of done
- [ ] Any blockers, dependencies or Play Store policy concerns called out

---

Now run the full workflow for this request:

$ARGUMENTS
