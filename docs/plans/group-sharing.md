# Plan: Shareable join links for Groups

Status: planning only, nothing built yet. Produced with the `/run-team` workflow. Builds on F12
Groups ([groups-split-expenses.md](groups-split-expenses.md)), which is live on `main`.

---

## Step 1: Sarah (BA), requirements

**Title.** Share a group with a link so the people in it can join, claim their name and see the same
expenses and balances.

**Feature and sprint.** This extends F12 and is a new feature, **F13 Group sharing**, release **v0.5**.
- **S16:** backend
- **S17:** mobile
- **S18:** domain, HTTPS, App Links, landing page and the "not installed" path

It depends on F12, F1 (sign-in) and the F10/F11 notifications module.

**User stories**
- As a group owner, I want to send one link in WhatsApp so that my friends can join the group without
  me adding them by hand.
- As someone who was sent the link, I want to tap it, say "I'm Ravi", and see what I owe, so that I
  don't have to ask.
- As anyone in the group, I want every expense and payment that anyone adds to show up for me with the
  same balances, so that we never argue about whose numbers are right.

**Assumptions** (made instead of asking):
1. **Members and users.** A *member* stays a name in the group. A member can optionally be *linked* to
   one Altus user, and a user is linked to at most one member per group. Unlinked members keep working
   exactly as they do today.
2. **Joining.** Anyone with the link who signs in can join straight away, with no approval step. The
   owner is notified and can unlink someone who joined by mistake.
3. **Claiming a name.** A joiner either claims an unlinked member, which takes over that name's history
   ("I'm Ravi"), or joins as a new member under their own name.
4. **Editing.** Every joined member can add, edit and delete expenses and payments, as in Splitwise.
   Every change is recorded with who made it and shown in a history list.
5. **Owner-only actions.** Only the owner can:
   - reset or turn off the link
   - unlink other people
   - delete the group
   - transfer ownership
6. **"You" depends on who is looking.** It means the member linked to whoever is viewing. Each person
   sees their own balance in the hero card and the list.
7. **Archiving is personal.** Archiving hides the group for me only. Deleting removes it for everyone.
8. **Not installed.** If the app isn't installed, the link opens a small web page with "Get Altus" and
   the join code. After install, the app picks the code up automatically from the Play install
   referrer, or the person types it in.

**Acceptance criteria**

Sharing
1. The owner sees an "Invite people" card on the group with the link (`https://<domain>/j/K7Q2M9XP4R`),
   **Copy**, **Share** (the Android share sheet) and **Reset link**.
2. Reset link turns off the old link at once and makes a new one. Opening the old link says "This
   link was turned off. Ask Asha for a new one."
3. Links do not expire by default. A link that is turned off, or whose group was deleted, never lets
   anyone join.

Opening the link
4. **App installed and signed in:** the link opens the app straight on "Join Goa trip". The join screen
   shows:
   - the group name and icon, and who invited me
   - the list of unlinked names with "That's me" next to each
   - "I'm not on the list"
5. **App installed, signed out or mid-onboarding:** after sign-in and onboarding finish, the app opens
   the join screen for that link. The code is remembered across an app restart.
6. **App not installed:** the web page shows "Asha invited you to Goa trip on Altus", a Get Altus
   button and the code. After installing from that button, the first launch opens the join screen
   with no typing.
7. **Already a member:** the link opens the group itself.
8. **Join with code:** the Groups screen has a "Join with code" option that accepts the 10-character
   code, with or without the dash.

Joining and room handling
9. Claiming "Ravi" links that member to me. All of Ravi's expenses, shares and payments become mine,
   and "You" now means Ravi on my phone.
10. If two people claim the same name at the same moment, one succeeds. The other sees "Someone just
    joined as Ravi. Pick another name or join as yourself" (409 `GROUP_MEMBER_ALREADY_LINKED`).
11. Joining as a new member adds my name, made unique if needed ("Ravi K"). It fails with 409
    `GROUP_MEMBER_LIMIT` at 50 members.
12. The owner gets a notification: "Ravi joined Goa trip".
13. **Leaving:** a member can leave. Their name stays in the group, unlinked, with its history, so no
    balance changes. The owner can't leave until they transfer ownership.
14. **Unlinking:** the owner can unlink another member, with the same effect as them leaving.
15. **Deleting:** if the owner deletes the group, every member loses it and gets a notification.

Consistency
16. Everyone in a group sees the same balances and "who pays whom" for the same set of expenses and
    payments. Balances are worked out from the same rows with the same functions, never stored per
    person.
17. Two people editing the same expense: the second save is refused with 409 `GROUP_EXPENSE_CHANGED`.
    The app shows "Priya changed this expense just now", reloads it, and nothing is silently
    overwritten.
18. Editing an expense that someone deleted shows "This expense was deleted" (404).
19. A retried create (flaky network, double tap) never adds an expense, payment or join twice.
20. A group open on my phone shows other people's changes within about 30 seconds while the screen is
    open, and at once when I come back to the app. A push notification also refreshes it.
21. History lists every change with who made it and when, for example "Priya changed Dinner from
    ₹3,600 to ₹3,200". Entries for deleted expenses are kept.

Privacy and accounts
22. Joining a group never shows anything from anyone's personal ledger, budgets or goals. It shows
    only that group's members, expenses and payments.
23. Other members' emails and Google profile details are never shown. The group-local name is what
    everyone sees, with a "joined" mark.
24. The web page shows only the group name, its icon and the inviter's first name. It never shows
    members or amounts.
25. Any id from a group I'm not in returns 404. Owner-only actions by a member return 403
    `GROUP_OWNER_ONLY`.
26. **Deleting my account:**
    - If I'm a member, my members are unlinked and keep their history.
    - If I own a group with other joined members, ownership passes to the member who joined earliest.
    - If nobody else joined, the group is deleted.
    - Other people's groups are never deleted because I left Altus.

**Out of scope**
- Joining without an Altus account (a web view of the group).
- An approval queue for joins.
- Invites by phone number or contact.
- Linking one person across groups ("Ravi in every group").
- Comments on expenses.
- Real-time typing or presence.
- Offline edits that sync later.
- Payment links (UPI collect).

**Routing.** This is full stack and cross-cutting. Alex owns the membership model, the consistency
rules, the domain and App Links. Raj builds the backend. Maya builds the app, the deep linking and a
small Kotlin install-referrer module.

---

## Step 2: Alex (tech lead), technical plan

### Conflicts and decisions to record

- **Groups change from "owned" to "shared".** The F12 doc says only the owner ever sees a group and
  that `groups.user_id` cascades from `users`. Both change here:
  - access becomes "is a linked member"
  - account deletion no longer cascades a whole group away
  
  The design doc's F12 section needs updating.
- **The design doc's privacy rule needs one exception.** "One user's data is never visible to another"
  stays true for ledger, budgets and goals. Shared groups become the single, opt-in exception, and the
  Play Data safety form must say "shared with other users at the user's request".
- **Domain and HTTPS are a hard dependency** for clickable App Links. The API is still on plain HTTP at
  an IP (`docs/deploy-ec2.md` already lists HTTPS as a release blocker). The plan ships in two stages,
  so S16–S17 are not blocked on the domain:
  - **S16–S17:** `altus://j/<code>` plus "Join with code", working without a domain.
  - **S18:** the https link.

### Architecture at a glance

```
WhatsApp link  https://<domain>/j/K7Q2M9XP4R
   │
   ├─ app installed ──► Android App Link (autoVerify, assetlinks.json) ──► app linking config
   │                                                                     └► JoinGroup screen
   └─ not installed ─► Nginx serves landing page /j/<code>
                          ├─ "Open in Altus": intent://j/<code>#Intent;scheme=altus;package=in.altus.app;end
                          └─ "Get Altus": Play URL with &referrer=join%3D<code>
                                └► first launch reads the install referrer ──► pending join ──► JoinGroup

App ──REST /v1──► GroupsModule (membership-scoped)
                   ├─ InvitesService     codes, preview, accept (claim or new member)
                   ├─ GroupsService      expenses / payments, one write at a time per group (row lock + rev)
                   ├─ GroupEventsService history rows written in the same transaction
                   └─ emits group.* events ──► NotificationsModule (push + inbox) ──► other phones refetch
```

**The core decision is one copy of the truth.** The group's rows in Postgres are the only state.
Balances, transfers and "You" are worked out on read for whoever asks (this is already how F12 works).
Nothing is cached per person, so two people can only disagree if one of them is looking at an older
read. The freshness rules below keep that window short, and versions stop an older read from
overwriting a newer one.

### Consistency model

| Concern | Mechanism |
|---|---|
| Same numbers for everyone | Balances are worked out from rows with `@et/domain` `netBalances` / `simplifyDebts` on every read. No stored per-user balances. |
| Concurrent writes to one group | Every write transaction starts with `SELECT … FROM groups WHERE id = $1 FOR UPDATE`, then bumps `groups.rev`. Writes to one group run one at a time. Different groups never wait on each other. Contention is negligible at 50 members. |
| Member removed while an expense is being added | Covered by the same group lock. Member checks and the insert happen under it, so a share can't point at a member being unlinked or removed. |
| Lost updates (two edits of one expense) | `group_expenses.version` int. `PUT` must send `version`; a mismatch returns 409 `GROUP_EXPENSE_CHANGED` with the current expense. Deletes also take `version`. Payments are create or delete only. |
| Retries and double taps | `clientRequestId` (uuid) on create expense, create payment and accept invite. Unique `(group_id, client_request_id)`; a replay returns the first result with 200. This follows the `clientRequestId` pattern transactions already use. |
| Two people claiming "Ravi" | `UPDATE group_members SET user_id = $me WHERE id = $ravi AND user_id IS NULL`. 0 rows means 409 `GROUP_MEMBER_ALREADY_LINKED`. `UNIQUE (group_id, user_id)` stops one user holding two names. |
| Freshness on other phones | **(1)** `GET /groups/:id` returns `rev` and an `ETag: "<rev>"`; the app re-asks with `If-None-Match` and gets a cheap 304 when nothing changed. **(2)** While a group screen is open, refetch every 30 s. On app focus, refetch everything (`focusManager` wired to `AppState`). **(3)** Group events make a push to the other linked members; receiving it invalidates `['groups']`. |
| Seeing what changed | `group_events` history rows are written in the same transaction as the change, so history and data never disagree. |
| Offline | Not supported for groups in v1. Writes need the network; the app shows the error and keeps the form. No CRDTs or merging. |

Realtime sockets or SSE were considered and rejected for now. There is one EC2 instance, groups are
small, and polling with a 304 plus a push nudge is simpler to run and good enough for "within 30
seconds". SSE on `GET /groups/:id/stream` can be added later behind the same `rev` without changing the
model.

### Module boundaries

| Module or feature | Public surface | Events |
|---|---|---|
| `api/groups` | Exports `GroupsModule`, `GroupsService` and the DTO types. `GroupsService` keeps its existing methods plus `purgeUser(userId, tx)` and `exportForUser(userId)`. Inside the module, `InvitesService`, `GroupEventsService` and `MembershipService` are private providers. Split modes stay `SplitStrategy`. | Emits, after commit: `group.member.joined`, `group.member.left`, `group.expense.created`, `group.expense.updated`, `group.expense.deleted`, `group.payment.created`, `group.deleted`. Each carries `groupId`, `actorUserId`, `recipientUserIds` and a short display summary. |
| `api/notifications` | A new `GroupsListener` in the notifications module turns those events into drafts for the recipients, respecting each person's notification settings. Four new types: `group_joined`, `group_expense`, `group_payment`, `group_deleted`. | Listens to the `group.*` events. |
| `api/users` | Account deletion asks `GroupsService.purgeUser` to unlink, hand over ownership or delete, inside the purge transaction. `groups` joins `PURGE_ORDER` before `accounts`. The `groups.owner_id` foreign key becomes Restrict, so a cascade can never wipe a shared group. | |
| `packages/domain` | Adds `normalizeInviteCode`, `formatInviteCode` and `uniqueMemberName(names, wanted)` ("Ravi" → "Ravi K"/"Ravi 2"), all pure. | |
| `mobile/features/groups` | `index.ts` adds `JoinGroupScreen`, `usePendingJoin` and `groupLinking` (the linking config fragment). | |
| `mobile/navigation` | `RootNavigator` gets a `linking` prop built from the feature's fragment, and hands a pending join through sign-in and onboarding. | |

The dependency direction is unchanged: `common ← groups ← notifications (listener)`, and
`users → groups` only through the public `purgeUser`.

### Database schema (owned by `groups`)

```prisma
model Group {
  // user_id → owner_id. Restrict, not Cascade: the users purge hands ownership on or deletes.
  ownerId   String   @map("owner_id") @db.Uuid
  /// Bumped by every write to the group, under the group row lock. Clients compare it (ETag).
  rev       BigInt   @default(0)
  // archived_at moves to GroupMember (archiving is personal).
}

model GroupMember {
  /// The Altus user this name belongs to; null = a name only. Unique per group.
  userId     String?   @map("user_id") @db.Uuid
  joinedAt   DateTime? @map("joined_at") @db.Timestamptz
  /// Hidden from this member's own list; others unaffected.
  archivedAt DateTime? @map("archived_at") @db.Timestamptz
  // is_self is dropped: "You" = userId == viewer.
  @@unique([groupId, userId])
  @@index([userId])            // "my groups"
}

model GroupInvite {
  id        String    @id @default(uuid(7)) @db.Uuid
  groupId   String    @map("group_id") @db.Uuid
  /// 10 chars of Crockford base32 (50 bits), e.g. K7Q2M9XP4R. Unique. Never reused.
  code      String    @unique @db.VarChar(16)
  createdBy String    @map("created_by") @db.Uuid
  revokedAt DateTime? @map("revoked_at") @db.Timestamptz
  createdAt DateTime  @default(now()) @map("created_at") @db.Timestamptz
  @@index([groupId])
}

model GroupExpense {
  version         Int     @default(1)
  createdBy       String? @map("created_by") @db.Uuid   // user id; null for rows from before F13
  updatedBy       String? @map("updated_by") @db.Uuid
  clientRequestId String? @map("client_request_id") @db.Uuid
  @@unique([groupId, clientRequestId])
}

model GroupPayment {
  createdBy       String? @map("created_by") @db.Uuid
  clientRequestId String? @map("client_request_id") @db.Uuid
  @@unique([groupId, clientRequestId])
}

/// Append-only history of a group: who did what. Written in the same transaction as the change.
model GroupEvent {
  id          String   @id @default(uuid(7)) @db.Uuid
  groupId     String   @map("group_id") @db.Uuid
  actorUserId String?  @map("actor_user_id") @db.Uuid   // null once that account is deleted
  type        String   @db.VarChar(40)                  // expense.updated, member.joined, …
  /// Display summary only: descriptions, amounts, names. Never anything from personal data.
  summary     Json
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz
  @@index([groupId, createdAt(sort: Desc), id(sort: Desc)])
}
```

**Migration (`group_sharing`)**, additive first and then reshaped in the same migration:

1. Add the new columns and tables.
2. Copy `groups.user_id` into the self member: `UPDATE group_members m SET user_id = g.user_id, joined_at = g.created_at FROM groups g WHERE m.group_id = g.id AND m.is_self`.
3. Copy `groups.archived_at` onto that self member.
4. Rename `groups.user_id` to `owner_id` and switch its foreign key to Restrict.
5. Drop `groups.archived_at` and `group_members.is_self`.

User foreign keys on `group_members.user_id`, `created_by`, `updated_by` and `actor_user_id` are
`ON DELETE SET NULL`, as a backstop; the purge does the real work first. An e2e test checks the
migrated F12 data: the owner still sees every group, with the same balances.

**Pipeline impact.** None. Group rows never touch `transactions` or `ingest()`.

### API contract (all under `/v1`, JWT-guarded unless marked public)

Every existing `/groups/:id/...` route now authorises "caller is a linked member" instead of "caller
is owner":
- not a member: 404
- a member but not the owner, on an owner-only action: 403 `GROUP_OWNER_ONLY`

`GroupDetail` gains these fields:
- `rev`
- `myMemberId`
- `isOwner`
- `members[].joined` (boolean)
- `members[].isSelf`, which now depends on who is viewing

`GroupSummary` gains `rev`. The detail response sends `ETag`; an `If-None-Match` request is answered
with 304.

| Method | Path | Body or query | Response | Errors |
|---|---|---|---|---|
| GET | `/groups/:id/invite` | | `{ code, url, createdAt }` or `null` when off | 403 owner only, 404 |
| POST | `/groups/:id/invite` | `{ reset?: boolean }` | `201 { code, url }`: returns the active link, or turns it off and makes a new one when `reset` | 403, 404 |
| DELETE | `/groups/:id/invite` | | 204 (link off) | 403, 404 |
| GET | `/invites/:code` | | `{ group: { id, name, emoji }, invitedBy: firstName, members: [{ id, name, joined }], alreadyMemberGroupId? }` | 404 `INVITE_NOT_FOUND` (unknown, off or group gone; one code for all, so the result reveals nothing) |
| POST | `/invites/:code/accept` | `{ clientRequestId, memberId? }`: `memberId` claims that name; leave it out to join under my Google first name | `200 GroupDetail` | 404 `INVITE_NOT_FOUND`, 409 `GROUP_MEMBER_ALREADY_LINKED`, 409 `GROUP_MEMBER_LIMIT`, 409 `GROUP_LIMIT` (50 active groups) |
| GET (public) | `/public/invites/:code` | | `{ groupName, emoji, invitedBy }` for the web page; nothing else | 404. 30/min per IP. |
| POST | `/groups/:id/leave` | | 204 | 409 `GROUP_OWNER_MUST_TRANSFER` |
| DELETE | `/groups/:id/members/:memberId/link` | | 204 (unlink someone) | 403, 404 |
| POST | `/groups/:id/owner` | `{ memberId }` (must be joined) | `GroupDetail` | 403, 404, 400 `GROUP_MEMBER_NOT_JOINED` |
| PATCH | `/groups/:id/me` | `{ archived: boolean }` | `GroupDetail` | 404 |
| GET | `/groups/:id/history?cursor=&limit=50` | | `{ items: [{ id, type, actor: { memberId?, name }, summary, createdAt }], nextCursor }` | 404 |
| POST | `/groups/:id/expenses` | as today, plus `clientRequestId` | 201, or 200 on a replay | as today |
| PUT | `/groups/:id/expenses/:expenseId` | as today, plus `version` | `Expense` (with `version`) | 409 `GROUP_EXPENSE_CHANGED` (body has `current`), 404 |
| DELETE | `/groups/:id/expenses/:expenseId?version=` | | 204 | 409 `GROUP_EXPENSE_CHANGED`, 404 |
| POST | `/groups/:id/payments` | as today, plus `clientRequestId` | 201, or 200 on a replay | as today |

**Rate limits:** `/invites/*` at 20/min per user, `/public/invites/*` at 30/min per IP. Codes have 50
bits of randomness, so guessing is hopeless, but the limits keep logs quiet.

**Links:**
- `url` is built from a new `PUBLIC_WEB_BASE_URL` config value (`https://<domain>`).
- Until the domain exists, `url` is `altus://j/<code>` and the app shares the code text alongside it.

### URL and deep-link handling

| Case | What happens |
|---|---|
| App installed, link tapped | Android App Link: `intent-filter android:autoVerify="true"` for `https://<domain>/j/*`. Android checks `https://<domain>/.well-known/assetlinks.json`, which lists the SHA-256 of the upload key and the Play signing key, then opens the app directly with no chooser. React Navigation `linking` maps `j/:code` to `JoinGroup`. |
| Also handled | The `altus://j/:code` custom scheme, from the web page's button and before the domain exists. |
| Signed out or onboarding | `usePendingJoin` is a Zustand store persisted to MMKV. Linking writes the code into it instead of navigating. `RootNavigator` sends the user to `JoinGroup` once the main stack mounts, then clears it. A pending code older than 7 days is dropped. |
| Not installed | Nginx serves the web page at `location /j/`: a static HTML page that calls `/public/invites/:code` for the title. It has Open Graph tags so WhatsApp shows "Join Goa trip on Altus". Its buttons are: Open in Altus (an `intent://` URL that falls back to Play) and Get Altus (`https://play.google.com/store/apps/details?id=in.altus.app&referrer=join%3D<code>`). The code is shown as `K7Q2-M9XP4R`. |
| First launch after install | A small Kotlin `InstallReferrerModule` using `com.android.installreferrer` reads `join=<code>` once and hands it to `usePendingJoin`. Google Play passes the referrer through installs from the Play link; Firebase Dynamic Links is shut down and not used. |
| Typed code | Groups screen, then the "+" menu, then **Join with code**. `normalizeInviteCode` uppercases, removes dashes and spaces, and maps O to 0 and I/L to 1 (Crockford). |
| Already a member | `GET /invites/:code` returns `alreadyMemberGroupId`, and the app opens `GroupDetail` instead. |
| Bad or old link | The join screen shows "This link doesn't work any more. Ask the person who sent it for a new one." |

### Component reuse plan

- **Join screen:** `Screen`, `TopBar`, `Card`, `ListRow` and `MerchantAvatar` (the existing tones). The
  "That's me" action is a `Button` (secondary, compact). Also `EmptyState` for bad links and `HeroCard`
  for the group header.
- **Invite card on group detail:** `Card`, `Text`, `Button` (Copy, Share), and `Button variant="text"`
  for Reset link.
- **Joined mark:** `Tag tone="neutral"`, which already exists.
- **History:** reuses the feature-local `PersonRow` and `SectionLabel` day headers.
- **New shared component:** none. "Join with code" is a `BottomSheet` with `TextField`.
- **Needs design sign-off:** the Join screen and the Invite card, in Altus Light and Dark.

### Mobile state approach

- **Keys:**
  - `['groups','invite',id]` (owner only)
  - `['invites', code]` (preview)
  - `['groups','history',id]` (infinite)
  - existing keys unchanged
- **Mutations:**
  - Accepting an invite, leaving, unlinking or transferring invalidates `['groups']`.
  - Resetting the link invalidates `['groups','invite',id]`.
- **Refresh:**
  - `useGroup` sets `refetchInterval: 30_000` while focused.
  - `focusManager` is set from `AppState`, so every group query refetches when the app returns.
  - A push of type `group_*` calls `invalidateQueries(['groups'])`.
- **Conflicts:**
  - On 409 `GROUP_EXPENSE_CHANGED`, the expense form replaces its draft with `current` and shows a
    banner.
  - On 404 it goes back with a toast.
- **Zustand:** `usePendingJoin` (code and when it was received), persisted to MMKV.

### Risks

1. **Domain and HTTPS** block App Links and the web page. The custom scheme and typed codes work
   without them.
2. **Privacy shift.** Groups are the first data visible to other users. Needed:
   - a Data safety form update (data shared with other users, at the user's request)
   - clear wording on Join: "Everyone in this group will see the expenses and payments in it"
   - the guarantee that nothing personal crosses into a group
3. **Leaked links.** Anyone with the link can join. The mitigations are:
   - Reset link
   - Unlink
   - a "Ravi joined" notification to the owner
   - the 50-member cap
   
   An approval mode is listed as a follow-up.
4. **Account deletion** must never delete other people's shared history. This is covered by the
   ownership handover in `purgeUser` and the Restrict foreign key; it needs an e2e test.
5. **Migration** reshapes live F12 data (moving `is_self`, renaming `user_id`). Take a backup first.
   The migration runs in one transaction, with an e2e test on seeded F12 data.
6. **Play install referrer** passes through only when installs go through the Play link, so the typed
   code is the fallback.

### Task breakdown

- **Alex:**
  - update the design doc for F12 and F13
  - register the domain and set up HTTPS in Nginx
  - publish `assetlinks.json` with the Play signing SHA-256
  - get design sign-off for Join and the Invite card
- **Raj:**
  - `group_sharing` migration
  - membership-scoped access (`MembershipService`)
  - the group row lock and `rev`
  - versions and `clientRequestId`
  - `InvitesService` and its endpoints
  - leave, unlink and transfer
  - `GroupEventsService` and history
  - ETag
  - `purgeUser`
  - `GroupsListener` with four notification types
  - tests
  - regenerate `packages/api-client`
- **Raj:** the Nginx `/j/` web page, plus public preview and its rate limit.
- **Maya:**
  - linking config and `usePendingJoin`
  - Join screen and Join with code
  - Invite card and the share sheet
  - joined marks and owner actions
  - History screen
  - conflict UI
  - refresh strategy and push invalidation
  - Kotlin `InstallReferrerModule`
  - Android intent filters

---

## Step 3: implementation plans

### Raj, backend

**Module `apps/api/src/groups/`**
- `membership.service.ts`:
  - `require(userId, groupId, tx)` returns `{ group, me }`, or 404 when the caller isn't linked.
  - `requireOwner` returns 403 `GROUP_OWNER_ONLY`.
  - Every existing service method swaps `owned()` for these.
- `domain/group-lock.ts`: `withGroupWrite(tx, groupId, fn)`. It runs `SELECT id, rev FROM groups WHERE id = $1 FOR UPDATE`, then `fn`, then `UPDATE groups SET rev = rev + 1, updated_at = now()`. All writes (expenses, payments, members, invites, settings) go through it, and history is written inside `fn`.
- `invites.service.ts`:
  - Codes come from `crypto.randomBytes`, encoded as 10 Crockford base32 characters, and are
    retried on a unique-key clash.
  - Accept runs under `withGroupWrite`. It:
    1. replays the earlier result if this `clientRequestId` was seen before
    2. checks the caller isn't already linked (returns the group if they are)
    3. either claims a name with the conditional update, or inserts a new member named with
       `uniqueMemberName`
    4. counts the caller's active groups
    5. writes history
    6. emits after commit
- `group-events.service.ts`: `record(tx, groupId, actorUserId, type, summary)` and `list(groupId, cursor)`. `summary` holds names and paise, and is built by pure helpers in `domain/history.ts`.
- **Expenses and payments:**
  - `version` is checked with `UPDATE … WHERE id = $1 AND version = $2`; 0 rows triggers a read of
    the current row and a 409 with `current`.
  - `clientRequestId` is unique; on P2002 the service returns the stored row with 200.
  - `createdBy` and `updatedBy` come from the JWT user.
- **`list`** reads groups through `group_members.user_id = me` and filters on the member's own
  `archived_at`. `myNetPaise` is worked out for the caller's own member.
- **`purgeUser(userId, tx)`:**
  - groups the user owns with another joined member: ownership moves to the earliest `joined_at`, and
    a history entry is written
  - groups the user owns with no one else joined: the group is deleted
  - every remaining member the user is linked to: `user_id = null`
- **ETag.** A small interceptor on `GET /groups/:id` sets `ETag: "g<rev>"`. A matching `If-None-Match`
  gets 304 without building the balances. The `rev` is read with a one-row query first.
- **Notifications.** `notifications/groups.listener.ts` uses `@OnEvent('group.*', { async: true })`
  and sends to `recipientUserIds` minus the actor:
  - joined → owner: "Ravi joined Goa trip"
  - expense → members with a share: "Priya added Dinner · you owe ₹900"
  - payment → the payee: "Arjun paid you ₹2,000"
  - deleted → all members

  Users can switch these off in notification settings. The `dedup_key` is the event id.
- **Config:** `PUBLIC_WEB_BASE_URL`, optional; without it, `url` falls back to `altus://`.
- **Rate limits:** a named throttler for invites and public routes.
- **Web page:** `infra/web/join/index.html` is static, with inline CSS in the Altus tokens and no
  framework, so Nginx serves it at `location /j/`. It also gets an Nginx snippet in
  `docs/deploy-ec2.md`.

**Tests**
- **Unit:**
  - code format and `normalizeInviteCode`
  - `uniqueMemberName`
  - history summaries
- **E2e:**
  - Asha shares a link, Ravi joins by claiming "Ravi", and both see the same balances
  - Ravi's "You" is Ravi
  - two parallel claims of the same name: one gets 200, the other 409
  - a replayed accept returns the same result once
  - a reset link stops the old code from working
  - parallel `PUT`s with the same version: one 200, one 409
  - a replayed `clientRequestId` makes one row
  - a member can add and edit expenses, and gets 403 resetting the link or unlinking someone
  - a non-member gets 404 on every route, including history and invite
  - leaving keeps balances unchanged
  - account deletion: the owner hands over to the first joiner, an owner who is alone loses the group,
    and a member is unlinked; a group with another joined member is never deleted
  - the ETag gives a 304 until a write bumps `rev`
  - the migration on F12 data keeps the owner's groups and balances

### Maya, mobile

**Feature `apps/mobile/src/features/groups/`**
- `linking.ts` exports `groupLinking` with:
  - `prefixes: ['https://<domain>', 'altus://']`
  - `config: { JoinGroup: 'j/:code' }`

  It also exports `extractJoinCode(url)` for the pending flow.
- `pending-join.ts`: `usePendingJoin` (Zustand + MMKV) with `{ code, at }`, `set` and `take()`.
- `screens/JoinGroupScreen.tsx` loads the preview and shows:
  - a hero with the group's icon and name
  - "Asha invited you"
  - the privacy line
  - a "Which one are you?" list of unlinked names, each with a "That's me" button
  - "I'm not on the list" (join under my name)

  It handles loading, a bad link, already a member (replace with `GroupDetail`) and a 409 claim
  conflict (refetch and show a banner).
- `components/InviteCard.tsx`, owner only, on `GroupDetailScreen`:
  - shows the link and code
  - Copy (`Clipboard`), Share (`Share.share`, with a message such as "Join Goa trip on Altus: …") and
    Reset link (with a confirm)
- `components/JoinWithCodeSheet.tsx`: a `BottomSheet` with `TextField` (auto-caps, 12 characters).
  Continue opens `JoinGroup`.
- **Group detail:**
  - "joined" `Tag` next to linked members
  - an owner menu (Unlink, Make owner) on each balance row
  - "Leave group" in the edit screen for non-owners
  - a History entry
- `screens/GroupHistoryScreen.tsx`: an infinite list of events with day headers.
- **Expense form:**
  - sends `version` on save
  - on 409, swaps in `current` and shows a warning `Tag`: "Priya changed this just now. Check it and
    save again."
  - sends a `clientRequestId` that is made once per form and kept across retries
- **Hooks** (`hooks.ts`):
  - `useInvite`, `useResetInvite`, `useInvitePreview(code)`, `useAcceptInvite`
  - `useLeaveGroup`, `useUnlinkMember`, `useTransferOwner`, `useGroupHistory`
  - `useGroup` with `refetchInterval: 30_000`
- **Navigation:**
  - `RootNavigator` gets `linking={{ ...groupLinking, getStateFromPath }}`, where `getStateFromPath`
    sends `j/:code` to the pending store when signed out or onboarding
  - `MainNavigator` takes the pending code on mount
  - routes added: `JoinGroup { code }` and `GroupHistory { id }`
- **Push:** the notifications feature's handler invalidates `groupKeys.all` for `group_*` types and
  opens `GroupDetail { id }` on a tap.
- **Android:**
  - `AndroidManifest.xml` gets an `intent-filter autoVerify="true"` (VIEW, DEFAULT, BROWSABLE; https,
    host `<domain>`, pathPrefix `/j/`) and a second one for scheme `altus` host `j`, with
    `launchMode="singleTask"`
  - Kotlin `InstallReferrerModule`, using the `com.android.installreferrer:installreferrer`
    dependency, reads the referrer once (a flag in shared prefs) and returns `join` if present
  - registered with codegen like the existing native modules
- **Tests:**
  - `extractJoinCode` and `normalizeInviteCode`
  - a pending join survives sign-in and opens Join
  - the Join screen claims a name and opens the group
  - a 409 claim conflict
  - InviteCard is owner-only, and Share builds the message
  - the expense form's 409 swaps the draft and keeps the `clientRequestId`

---

## Step 4: Alex, sign-off checklist

- [ ] API contract above agreed and reflected in OpenAPI and the regenerated client; 304 and 409 bodies documented
- [ ] `groups` stays self-contained; `users` uses only `GroupsService.purgeUser`; notifications only listens to `group.*` events
- [ ] Split modes stay strategies; no per-role `if` chains outside `MembershipService`
- [ ] UI reuses catalogue components; Join and Invite card designs approved in Light and Dark
- [ ] No writes to `transactions`; nothing from the ledger, budgets or goals is readable through a group
- [ ] Amounts stay integer paise; balances worked out on read, never stored per person
- [ ] Every route requires a linked membership; non-member → 404, member on owner action → 403
- [ ] Every group write runs under the group row lock, bumps `rev` and writes history in the same transaction
- [ ] Edits carry `version`; creates and joins carry `clientRequestId`; both have concurrency e2e tests
- [ ] Account deletion never deletes a group that another joined user is in (e2e)
- [ ] Migration tested on F12 data; backup before deploy
- [ ] **Blocker:** domain + HTTPS + `assetlinks.json` before https links ship (custom scheme and typed codes don't need it)
- [ ] **Blocker:** Play Data safety form updated for data shared with other users
- [ ] Open decisions confirmed with the product owner:
  - instant join or approval
  - whether everyone can edit every expense
  - which domain
  - whether the web page may show the group name
