# Plan: Groups and shared expenses (Splitwise-style)

Status: planning only, nothing built yet. Produced with the `/run-team` workflow.

---

## Step 1: Sarah (BA), requirements

**Title.** Track shared expenses in groups whose members are just names, and see who owes whom.

**Feature and sprint.** This is new. It is not one of F1 to F11 in the design doc. I propose **F12 Groups and shared expenses**, release **v0.4**, sprints **S14 (backend) and S15 (mobile)**. It depends only on F1 (sign-in). It does not depend on the ledger, SMS or imports. Goals set the precedent: they were also added after the design doc as a standalone module.

**User story.** As a user who shares costs with friends, flatmates or a trip group, I want to create a group, add people by name, record what each expense cost, who paid and who shares it, so that I always know who owes whom without anyone else installing the app.

**Assumptions** (made instead of asking, since this is full-team mode):
1. Members are labels owned by the signed-in user. They have no accounts, logins, emails, phone numbers, invites or notifications. Only the creator ever sees the group.
2. The creator is always a member, shown as **"You"**, and cannot be removed.
3. Every expense has **one payer**, which defaults to You, and **one or more members who share it**. "Who needs to pay" means the members who share it.
4. Split modes for v1: **equal** (the default) and **exact amounts**. Percentages and shares are left out.
5. Group expenses are **not** ledger transactions. They do not appear in Transactions, the dashboard, budgets or the daily allowance. Goals are kept separate in the same way.
6. Settling up is recorded as a **payment** from one member to another inside the group. No real money moves.
7. One currency, INR, stored as integer paise.

**Acceptance criteria**

Groups
1. I can create a group with a name (1 to 40 characters) and an optional emoji. I am added automatically as the member "You".
2. I can list my groups. Each row shows the name, member count and my net balance in the group ("you are owed ₹X", "you owe ₹X" or "settled up").
3. I can rename a group, archive it (it moves out of the main list) and restore it. I can delete a group only after confirming, and deleting it removes its members, expenses and payments.
4. A user can have at most 50 active groups. Creating a 51st returns `409 GROUP_LIMIT`.

Members
5. I can add a member by name only (1 to 30 characters). Names must be unique in the group, ignoring case. A duplicate returns `409 GROUP_MEMBER_DUPLICATE`.
6. I can rename a member.
7. I can remove a member only while they are not part of any expense or payment. Otherwise the API returns `409 GROUP_MEMBER_IN_USE` and the app explains why.
8. A group has at most 50 members.

Expenses
9. I can add an expense with a description (1 to 60 characters), an amount, a date (IST, not in the future), the payer (default You) and the members who share it (default everyone).
10. With an **equal** split, the amount is divided in paise and the leftover paise go one each to the first members in member order. The shares always add up exactly to the amount. For example, ₹100.00 across 3 members is 3334 + 3333 + 3333 paise.
11. With an **exact** split, I enter each member's amount. Save stays disabled until the shares add up exactly to the total, and the API rejects a mismatch with `400 GROUP_SPLIT_MISMATCH`.
12. At least one member must share the expense. Every share is at least 0 paise and the total is greater than 0. Every member id must belong to the group, or the API returns 400.
13. I can edit or delete an expense. Balances update right away.
14. The expense list is newest first, uses cursor pagination and has day headers in IST.

Balances and settling up
15. The group screen shows each member's net balance: total paid minus total share, plus payments sent, minus payments received. The net balances always add up to 0.
16. The group screen shows a simplified "who pays whom" list with the fewest transfers possible, worked out greedily. For example, "Ravi pays You ₹450".
17. I can record a payment ("Ravi paid You ₹450") from a suggested transfer or by hand. The payer and payee must be different members.
18. When every net balance is 0, the group shows a "Settled up" state.

Cross-cutting
19. Amounts are integer paise end to end. The display uses Indian grouping (₹1,23,456).
20. Another user's group, member, expense or payment id returns **404**, never 403.
21. Deleting my account (DELETE /v1/me) removes all my groups. The JSON export includes groups.
22. The app handles loading, empty ("No groups yet", "No expenses yet"), error and offline states, in both Altus Light and Altus Dark.

**Out of scope**
- Real users as members, invites, sharing links, friend lists, contacts import, reminders or notifications to members.
- Percentage or share-based splits, itemised receipts, recurring group expenses, receipt photos.
- More than one payer per expense.
- Multiple currencies.
- Automatically adding my share to my personal ledger. This is a possible follow-up: a "Log my share" button that goes through `ingest()`. See Risks.
- Payment integrations such as UPI collect links.
- Cross-group balances with one person, because members are per-group labels.

**Routing.** This is full stack. Alex reviews the schema and module boundaries. Raj builds the `groups` module and API. Maya builds the `groups` feature, the screens and the navigation entry. The screens are **not** in the locked mockups, so Alex needs design sign-off on the new screens before Maya starts.

---

## Step 2: Alex (tech lead), technical plan

**Conflicts with the design doc.**
- F12 is not in the design doc or the sprint plan. Both need a new section and backlog. This is a scope addition, not a redesign.
- None of the 10 locked screens covers groups. We need new mockups in the Altus theme before mobile work starts. They must be composed from existing catalogue components so the design review is light.

**Technical approach.**
- Add a new self-contained NestJS module, `apps/api/src/groups/`, that owns four new tables. It does not touch `transactions` or `ingest()`, because group expenses are not ledger transactions.
- Put the split and balance maths in pure functions in `packages/domain/src/groups.ts`, which both the API and the app use. The app needs them for the live split preview. The functions are `splitEqually`, `validateExactSplit`, `netBalances` and `simplifyDebts`.
- Add a new mobile feature folder, `apps/mobile/src/features/groups/`.
- Entry points: a "Groups" row in Settings (the same pattern as Goals) and an optional "Groups" card on Home. Use the Settings row for v1 so the locked tab bar stays unchanged.

**Module boundaries.**

| Module | Public surface (`index.ts`) | Interfaces | Events |
|---|---|---|---|
| `api/groups` | `GroupsModule`, `GroupsService` (`purgeUser(userId, tx)`, `exportForUser(userId)`), public DTO types | none of `StatementAdapter`, `SmsTemplate`, `DedupRule`, `CategoryRule` or `TransactionSource` apply. Split modes use a small `SplitStrategy { mode; compute(amountPaise, members, input): Share[] }` with `equal` and `exact` registered in a list, so adding `percent` later means adding one file | Emits `group.expense.created` and `group.settled` from `groups.events.ts`. No listeners yet, but notifications or rewards may react later. Listens to nothing |
| `api/users` | unchanged API. Its export calls `GroupsService.exportForUser()`. Deletion relies on `onDelete: Cascade` from `users`, like `goals` does. `groups` does not need to be in `PURGE_ORDER` because it has no foreign keys with `Restrict` | | |
| `packages/domain` | `splitEqually`, `validateExactSplit`, `netBalances`, `simplifyDebts`, plus `Share` and `Transfer` types | | |
| `mobile/features/groups` | `GroupsScreen`, `GroupDetailScreen`, `GroupFormScreen`, `GroupExpenseFormScreen`, `SettleUpSheet`, `useGroups` (for the Settings row count) | | |

The dependency direction is `common ← groups`. `groups` imports nothing from accounts, categories, ingest or transactions, and nothing imports `groups` internals.

**Component reuse plan.**
- The screens reuse these catalogue components: `Screen`, `TopBar`, `IconButton`, `Button`, `Card`, `ListRow`, `SectionLabel`, `EmptyState`, `Chip`/`ChipGroup` (multi-select for who shares it), `SegmentedControl` (Equal / Exact), `BottomSheet`, `TextField`, `Tag` (owes or owed tone), `AmountText`, `AmountField`/`AmountKeypad`, `MerchantAvatar` (initials for members), `DayHeader`, `HeroCard` (my net balance in the group).
- New shared components: none in v1. `MemberAvatar` is just `MerchantAvatar` with a name, so we reuse it as is. If a "person row with amount" later appears on a second screen outside groups, it moves to `components/` under the rule of two.
- Feature-local components: `GroupRow`, `BalanceList`, `TransferRow`, `SplitEditor` (rows of member, checkbox and amount). They are only used inside groups.

**Database schema** (`apps/api/prisma/schema.prisma`, owned by `groups`)

```prisma
enum GroupSplitMode { equal  exact }

/// A set of people the user splits costs with. Members are labels, not users. Owned by groups.
model Group {
  id         String    @id @default(uuid(7)) @db.Uuid
  userId     String    @map("user_id") @db.Uuid
  name       String    @db.VarChar(40)
  emoji      String?   @db.VarChar(16)
  archivedAt DateTime? @map("archived_at") @db.Timestamptz
  createdAt  DateTime  @default(now()) @map("created_at") @db.Timestamptz
  updatedAt  DateTime  @updatedAt @map("updated_at") @db.Timestamptz

  user     User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  members  GroupMember[]
  expenses GroupExpense[]
  payments GroupPayment[]

  @@index([userId, archivedAt])
  @@map("groups")
}

model GroupMember {
  id        String   @id @default(uuid(7)) @db.Uuid
  groupId   String   @map("group_id") @db.Uuid
  name      String   @db.VarChar(30)
  /// lower(trim(name)); unique per group.
  nameKey   String   @map("name_key") @db.VarChar(30)
  isSelf    Boolean  @default(false) @map("is_self")
  position  Int      // stable order, used for remainder paise in equal splits
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz

  group Group @relation(fields: [groupId], references: [id], onDelete: Cascade)

  @@unique([groupId, nameKey])
  @@index([groupId, position])
  @@map("group_members")
}

model GroupExpense {
  id          String         @id @default(uuid(7)) @db.Uuid
  groupId     String         @map("group_id") @db.Uuid
  description String         @db.VarChar(60)
  amountPaise BigInt         @map("amount_paise")
  paidById    String         @map("paid_by_id") @db.Uuid
  splitMode   GroupSplitMode @map("split_mode")
  /// IST calendar day.
  day         DateTime       @db.Date
  createdAt   DateTime       @default(now()) @map("created_at") @db.Timestamptz
  updatedAt   DateTime       @updatedAt @map("updated_at") @db.Timestamptz

  group  Group               @relation(fields: [groupId], references: [id], onDelete: Cascade)
  paidBy GroupMember         @relation("payer", fields: [paidById], references: [id], onDelete: NoAction)
  shares GroupExpenseShare[]

  @@index([groupId, day(sort: Desc), id(sort: Desc)])
  @@map("group_expenses")
}

model GroupExpenseShare {
  expenseId  String @map("expense_id") @db.Uuid
  memberId   String @map("member_id") @db.Uuid
  sharePaise BigInt @map("share_paise")

  expense GroupExpense @relation(fields: [expenseId], references: [id], onDelete: Cascade)
  member  GroupMember  @relation(fields: [memberId], references: [id], onDelete: NoAction)

  @@id([expenseId, memberId])
  @@index([memberId])
  @@map("group_expense_shares")
}

model GroupPayment {
  id          String   @id @default(uuid(7)) @db.Uuid
  groupId     String   @map("group_id") @db.Uuid
  fromId      String   @map("from_id") @db.Uuid
  toId        String   @map("to_id") @db.Uuid
  amountPaise BigInt   @map("amount_paise")
  day         DateTime @db.Date
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz

  group Group       @relation(fields: [groupId], references: [id], onDelete: Cascade)
  from  GroupMember @relation("paymentFrom", fields: [fromId], references: [id], onDelete: NoAction)
  to    GroupMember @relation("paymentTo", fields: [toId], references: [id], onDelete: NoAction)

  @@index([groupId, day(sort: Desc)])
  @@map("group_payments")
}
```

Migration notes:
- The migration is additive only (`add_groups`) and has no backfill.
- Add CHECK constraints in raw SQL: `amount_paise > 0`, `share_paise >= 0` and `from_id <> to_id`.
- Member references use `NoAction`, not `Restrict`. Both block deleting a member who is in use (`GROUP_MEMBER_IN_USE`). The difference is timing: Postgres checks `NoAction` at the end of the statement, after the whole cascade from `groups` has run. `Restrict` is checked during the cascade and can make deleting a group fail. An e2e test must prove that deleting a group with expenses and payments works.
- Add `groups Group[]` to `User`.
- Scoping: only `groups` has `user_id`. Every child query first loads the group with `{ id, userId }` and answers 404 when it is missing. A private `findOwnedGroup(userId, groupId)` helper enforces this.

**Pipeline impact.** None. No transaction writes, so `ingest()` is untouched. The follow-up "Log my share" would be a `TransactionSource` with `source = 'group'`, `source_hash = sha256(expenseId + memberId)`, going through `ingest()`. It is out of scope.

**API contract** (agreed between Maya and Raj, all under `/v1`, `JwtAuthGuard`, 300/min)

| Method | Path | Body or query | Response | Errors |
|---|---|---|---|---|
| GET | `/groups?archived=false` | | `{ items: GroupSummary[] }`. `GroupSummary = { id, name, emoji, memberCount, myNetPaise, archived }` | |
| POST | `/groups` | `{ name, emoji?, members?: string[] }` (initial names, besides You) | `201 GroupDetail` | 400, 409 `GROUP_LIMIT`, `GROUP_MEMBER_DUPLICATE` |
| GET | `/groups/:id` | | `GroupDetail = { id, name, emoji, archived, members: Member[], balances: { memberId, netPaise }[], transfers: { fromId, toId, amountPaise }[], settled: boolean }` | 404 |
| PATCH | `/groups/:id` | `{ name?, emoji?, archived? }` | `GroupDetail` | 400, 404 |
| DELETE | `/groups/:id` | | 204 | 404 |
| POST | `/groups/:id/members` | `{ name }` | `201 Member = { id, name, isSelf }` | 400, 404, 409 `GROUP_MEMBER_DUPLICATE`, `GROUP_MEMBER_LIMIT` |
| PATCH | `/groups/:id/members/:memberId` | `{ name }` | `Member` | 400, 404, 409 duplicate |
| DELETE | `/groups/:id/members/:memberId` | | 204 | 404, 409 `GROUP_MEMBER_IN_USE`, 400 `GROUP_MEMBER_SELF` |
| GET | `/groups/:id/activity?cursor=&limit=50` | | `{ items: (Expense \| Payment)[], nextCursor }`, newest first, each item tagged with `kind` | 404 |
| POST | `/groups/:id/expenses` | `{ description, amountPaise, day, paidById, split: { mode: 'equal', memberIds } \| { mode: 'exact', shares: { memberId, sharePaise }[] } }` | `201 Expense = { kind:'expense', id, description, amountPaise, day, paidById, splitMode, shares: { memberId, sharePaise }[] }` | 400 (`GROUP_SPLIT_MISMATCH`, unknown member, future day), 404 |
| PATCH | `/groups/:id/expenses/:expenseId` | same as create, all fields optional (shares are recalculated when amount or split changes) | `Expense` | 400, 404 |
| DELETE | `/groups/:id/expenses/:expenseId` | | 204 | 404 |
| POST | `/groups/:id/payments` | `{ fromId, toId, amountPaise, day }` | `201 Payment` | 400 (`GROUP_PAYMENT_SAME_MEMBER`), 404 |
| DELETE | `/groups/:id/payments/:paymentId` | | 204 | 404 |

Amounts are integers in paise sent as JSON numbers, matching the existing endpoints. Dates are `YYYY-MM-DD` IST days, matching goals.

**Mobile state approach.**
- Query keys: `['groups','list',archived]`, `['groups','detail',id]` and `['groups','activity',id]` (infinite).
- Member and expense mutations invalidate `['groups','detail',id]`, `['groups','activity',id]` and `['groups','list']`. Group create, update and delete invalidate `['groups']`.
- Mutations never invalidate `['transactions']` or `['dashboard']`, because groups do not touch the ledger.
- No Zustand store. The expense form state is local to the screen.

**Risks and concerns**
1. **Rounding.** Equal splits must be deterministic and add up exactly. They live in one pure function shared by the app and the API, and the server always recalculates them. Property tests cover many amounts and member counts.
2. **Money type.** `BigInt` in Prisma has to become `number` in DTOs. Follow the goals pattern (`Number(...)`, safe below 2^53). Cap `amountPaise` at ₹1 crore (1,000,000,000 paise) per expense.
3. **Privacy.** Member names are personal data about third parties. Never log them, include them in the export, and delete them with the account. Mention this on the Data safety form ("user-entered names, not shared").
4. **User confusion.** Users may expect group spends in their monthly total. Show a one-line note on the group screen: "Group expenses aren't added to your spending". "Log my share" is the follow-up for this.
5. **Performance.** Balances are worked out on read from expenses and payments. That is fine up to about 1,000 rows per group. Add a cached balance only if profiling shows it is needed.
6. **Design.** The screens have no locked mockup. Get design sign-off first.

**Task breakdown**
- Alex: add F12 to the design doc and sprint plan, and get the 4 screen mockups approved in Altus Light and Dark.
- Raj: `packages/domain/src/groups.ts` and its tests (shared with Maya).
- Raj: Prisma models, migration, CHECK constraints.
- Raj: `groups` module, which includes the service, controller, DTOs, split strategies, events, export hook and e2e tests.
- Raj: regenerate `packages/api-client`.
- Maya: `features/groups` hooks, the Groups list, Group form, Group detail (balances, transfers, activity), the Expense form with `SplitEditor`, and the Settle-up sheet.
- Maya: the Settings row and navigation routes.

---

## Step 3: implementation plans

### Maya, mobile

**Folder** `apps/mobile/src/features/groups/`
- `screens/GroupsScreen.tsx`: list of `GroupRow`s, an Active or Archived `ChipGroup`, `EmptyState` "No groups yet" with a "Create group" `Button`, and a FAB or TopBar action "+".
- `screens/GroupFormScreen.tsx`: create or edit. Fields are name, emoji and a member names list (add by typing a name and tapping +; delete only while unused). Edit mode also has Archive and Delete (`Button variant="danger"` plus a confirm).
- `screens/GroupDetailScreen.tsx`:
  - a `HeroCard` with my net balance ("You are owed ₹1,200" in the income tone, "You owe ₹300" in the spend tone, or "Settled up")
  - "Balances" `SectionLabel` followed by a `ListRow` for each member with an `AmountText` tone
  - "Settle up" section with the `TransferRow`s, where tapping one opens `SettleUpSheet` prefilled
  - "Activity" with `DayHeader`s and expense and payment rows (FlashList, infinite)
  - an "Add expense" primary `Button`
- `screens/GroupExpenseFormScreen.tsx`:
  - description `TextField`, `AmountField` with `AmountKeypad`, day picker
  - "Paid by" `ChipGroup` with single selection (default You)
  - "Split" `SegmentedControl` Equal / Exact
  - `SplitEditor`: in Equal mode, a multi-select `ChipGroup` of members with a live per-person preview from `splitEqually`. In Exact mode, a row per member with an `AmountField` and a "₹X left" or "₹X over" `Tag`
  - Save stays disabled until the form is valid
- `components/SettleUpSheet.tsx` (`BottomSheet`): from, to, amount and day.
- `components/GroupRow.tsx`, `BalanceList.tsx`, `TransferRow.tsx`, `SplitEditor.tsx` stay feature-local.
- `hooks.ts`:
  - queries: `useGroups`, `useGroup`, `useGroupActivity` (infinite)
  - mutations: `useCreateGroup`, `useUpdateGroup`, `useDeleteGroup`, `useAddMember`, `useRenameMember`, `useRemoveMember`, `useCreateExpense`, `useUpdateExpense`, `useDeleteExpense`, `useRecordPayment`, `useDeletePayment`
  - every hook goes through `api` from `lib` (the generated client) and uses `toApiError`
- `labels.ts`: maps error codes to messages (for example, `GROUP_MEMBER_IN_USE`: "Ravi is part of an expense. Remove them from those expenses first.").
- `index.ts` exports the four screens and `useGroups` only.

**Wiring**
- `lib/routes.ts`: add `Groups`, `GroupDetail {id}`, `GroupForm {id?}` and `GroupExpenseForm {groupId, expenseId?}` to `MainStackParamList`.
- `navigation/MainNavigator.tsx`: register the four screens.
- `features/settings/screens/SettingsScreen.tsx`: add a `ListRow label="Groups"` with the count, next to Goals.

**Theme and states.** Use tokens only (`income`/`spend` for balances, `accent` for "settled"). Use the 44 px targets of the primitives. Every member chip and avatar gets an `accessibilityLabel`. Amounts always carry a sign or a word, never colour alone. Each screen covers its loading (skeleton `Card`s), empty, error (retry), and submitting (Save disabled) states.

**Tests.** React Native Testing Library tests for `SplitEditor` (remainder display, exact mismatch blocks Save), `GroupDetailScreen` (settled state, transfer to sheet prefill), and the form validation messages.

### Raj, backend

**Module** `apps/api/src/groups/`
- `groups.module.ts`, `groups.controller.ts` (the routes above, OpenAPI decorators with an `operationId` for each), `groups.service.ts`, `groups.events.ts`, `index.ts`.
- `dto/group.dto.ts`, `dto/expense.dto.ts`, `dto/payment.dto.ts`. They use class-validator: `@IsInt() @Min(1) @Max(1_000_000_000) amountPaise`, `@Length` on names, `@IsUUID` member ids, `@IsISO8601` day, and a discriminated `split` validated with `@ValidateNested` plus a mode check. `@ArrayMinSize(1) @ArrayMaxSize(50)` on memberIds and shares.
- `domain/split-strategies.ts`: `SplitStrategy` with `EqualSplit` and `ExactSplit`, registered in `SPLIT_STRATEGIES`. They call `@et/domain` `splitEqually` and `validateExactSplit`.
- Service rules:
  - `findOwnedGroup(userId, id)` runs before every child operation. A missing group throws `NotFoundException('GROUP_NOT_FOUND')`.
  - Members, expenses and payments are always fetched with `groupId` in the where clause, so ids from another group give 404.
  - Every referenced member id is checked against the group's members, or the service answers 400 `GROUP_UNKNOWN_MEMBER`.
  - Create and update of an expense run in one `$transaction`: upsert the expense, delete its shares, then insert the new shares.
  - Removing a member catches Prisma `P2003` (foreign key violation) and turns it into 409 `GROUP_MEMBER_IN_USE`. Removing self gives 400 `GROUP_MEMBER_SELF`.
  - Balances: load sums with `groupBy` (paid per member, share per member, payments from and to), then pass them to `netBalances` and `simplifyDebts`. That is 4 small queries per detail view, with no N+1.
  - `GroupSummary.myNetPaise`: work it out with one grouped SQL query across the user's groups. Keep it in the service, not the controller.
  - Emit `group.expense.created` after the commit, using the existing emit-after-commit helper (see fe74ef0).
- `exportForUser(userId)` is called from the users export. Deletion happens through the cascade from `users`, and the e2e test asserts that no group rows are left after DELETE /v1/me.
- No pg-boss jobs. No parser changes.

**Pure logic** `packages/domain/src/groups.ts`:
- `splitEqually(amountPaise, memberIdsInPositionOrder) → Share[]`
- `validateExactSplit(amountPaise, shares) → ok | { diffPaise }`
- `netBalances({ expenses, shares, payments }) → Map<memberId, paise>`
- `simplifyDebts(balances) → Transfer[]`: greedy, largest debtor to largest creditor, deterministic tie-break by member position.

**Tests**
- Unit tests for `@et/domain/groups`: rounding (₹100 / 3, 1 paisa across 3 people, zero shares in exact mode), the sum of shares equals the amount (property test), net balances add up to 0, and `simplifyDebts` produces at most n−1 transfers that settle every balance to 0.
- Service unit tests: split strategies and the error mapping.
- Supertest e2e:
  - full flow: create a group, add members, add an equal expense, add an exact expense, check balances and transfers, record a payment, check that the group is settled
  - validation: split mismatch, an unknown member, a member from another group, a future day, a duplicate name, removing a member in use, deleting a group that has expenses
  - **another user's group, member, expense and payment ids all return 404**
  - DELETE /v1/me removes every group row
- Regenerate `packages/api-client` and commit it.

---

## Step 4: Alex, sign-off checklist

- [ ] API contract above is agreed between Maya and Raj and reflected in the OpenAPI spec and the regenerated `packages/api-client`
- [ ] `groups` is self-contained: only `GroupsService` and the `index.ts` exports are used across boundaries. No imports from accounts, transactions or ingest. No circular imports
- [ ] Split modes are `SplitStrategy` classes in a registered list, not `if mode ===` chains across the code
- [ ] UI reuses catalogue components. Feature-local components stay feature-local until a second screen needs them. No hard-coded colours or sizes
- [ ] No writes to `transactions`. `ingest()` is untouched. "Log my share" stays deferred
- [ ] Amounts are integer paise end to end. Equal-split remainders are deterministic and shares add up exactly to the amount
- [ ] Every query is scoped through `findOwnedGroup(userId, …)`. Another user's group returns 404, with an e2e test for each resource
- [ ] Prisma migration is additive, has CHECK constraints, cascades from `users`, and is covered by e2e tests
- [ ] **Blocker:** there are no locked mockups for the 4 groups screens. Design sign-off in Altus Light and Dark is needed before Maya starts
- [ ] **Blocker:** F12 has to be added to the design doc and sprint plan (v0.4, S14 to S15) with the acceptance criteria above
- [ ] Data safety form updated for user-entered third-party names. Export and delete cover groups
