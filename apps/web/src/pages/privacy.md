---
layout: ../layouts/Legal.astro
title: Privacy policy
description: What Altus collects, what it never collects, where your data is kept, and how to get it out or delete it.
updated: "[DATE]"
---

> Draft written from what the app does today. It needs review by a lawyer before launch [LEGAL CHECK], including which parts of India's Digital Personal Data Protection Act, 2023 apply.

Altus is run by [LEGAL ENTITY NAME], [CITY], India ("we"). Questions about this policy or your data: [CONTACT EMAIL]. Grievance officer: [GRIEVANCE OFFICER NAME], [CONTACT EMAIL].

## What we collect

- **Your Google account basics** when you sign in: email address, name and Google account ID.
- **Accounts you add**: bank name, account type and the **last 4 digits** only. Never the full account number.
- **Transactions**, from three places:
  - **Bank SMS**, read **on your phone**. Only these fields leave your phone: amount, debit or credit, date and time, bank, merchant or payee, the last 3 or 4 digits of the account, the bank's reference number, a short type such as UPI or CARD, and a one-way fingerprint so the same SMS is never counted twice. The fingerprint can't be turned back into the message.
  - **Statements** you upload (CSV, Excel or PDF).
  - **Entries you type** yourself.
- **Your settings and plans**: monthly income if you enter it, categories, budgets, goals, streaks and notification choices.
- **Groups**: group names, the names you give members, and the expenses and payments in them. Everyone in a group sees that group.
- **Device token** for push notifications (Firebase Cloud Messaging).
- **Crash reports**, if switched on, with personal details removed (Sentry).
- **Waitlist**: if you join the iPhone waitlist on this website, your email address and the page you joined from. Nothing else.

## What we never collect

- The text of your SMS. Personal messages, OTPs and promotions are skipped on the phone.
- Your bank passwords or net-banking logins.
- A statement's password. It is used once to open the file and is not stored.

## How long we keep it

- **Uploaded statements** are deleted once they have been read. A password-protected PDF is kept, still locked, until you unlock it [VERIFY retention].
- **Your account data** is kept until you delete your account.
- **Backups** are encrypted and expire after 30 days.
- <span id="waitlist"></span>**Waitlist emails** are kept until we send the one "Altus is ready for iPhone" email, or for 24 months, whichever comes first.

## Who processes it for us

We don't sell your data or share it for advertising. These providers process it on our behalf:

- **Amazon Web Services** (servers in Mumbai, backups and this website).
- **Google** (sign-in and push notifications).
- **Sentry** (crash reports, if switched on).

## Security

[LEGAL CHECK] Describe the current safeguards accurately. Do not claim end-to-end encryption, or that all data is encrypted in transit, until the connection between CloudFront and the server is encrypted (see `docs/deploy-web.md`, Phase 5).

## Your choices

- **Turn off SMS reading** any time in Settings, Data sources.
- **Export** your transactions as a CSV file from Settings.
- **Delete your account** from Settings, or see [how to delete your account](/account-deletion).
- **Correct or ask about your data**: email [CONTACT EMAIL].

## Children

Altus is not meant for anyone under 18.

## Changes

We'll update this page and the date at the top when this policy changes, and tell you in the app if the change is significant.
