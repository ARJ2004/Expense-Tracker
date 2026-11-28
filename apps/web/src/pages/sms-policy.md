---
layout: ../layouts/Legal.astro
title: SMS permission policy
description: Why Altus asks to read SMS, exactly what it reads, what leaves your phone, and how to turn it off.
updated: "[DATE]"
---

> Draft for review [LEGAL CHECK]. This page must say the same thing as the in-app disclosure, the privacy policy and Google Play's SMS permission declaration.

## Why Altus asks for SMS access

Logging bank transactions automatically is Altus's core feature. Your bank already sends an SMS for every debit and credit. With your permission, Altus reads those alerts so you don't have to type each payment in.

The permissions are **READ_SMS** (to read existing bank alerts once, when you turn the feature on) and **RECEIVE_SMS** (to log new alerts as they arrive).

## What Altus reads

- Only messages from **bank senders**. A sender Altus doesn't recognise asks you "Is this your bank?" once.
- Debit and credit alerts. **OTPs, personal messages, offers and "will be debited" reminders are skipped.**
- Altus **never sends, edits or deletes** SMS.

## What leaves your phone

Each alert is read **on your phone**. Only these fields are sent to your Altus ledger: amount, debit or credit, date and time, bank, merchant or payee, the last 3 or 4 digits of the account, the bank's reference number, a short type such as UPI or CARD, and a one-way fingerprint that stops the same SMS being counted twice. **The text of the message never leaves your phone.**

## Turning it off

Open Settings, Data sources, and turn SMS off. You can also remove the permission in Android settings. Altus keeps working with statements and manual entry.

## Google Play and the APK

Google reviews every app that asks to read SMS. Until it approves Altus, the Google Play version doesn't include SMS reading. The APK on our [Download page](/download) does.
