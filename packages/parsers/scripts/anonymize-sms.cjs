#!/usr/bin/env node
/**
 * Dev-only. Turns an SMS export from your own phone into anonymized draft test cases.
 *
 *   adb shell content query --uri content://sms/inbox --projection address:body:date > fixtures/sms/raw/inbox.txt
 *   pnpm --filter @et/parsers sms:anonymize fixtures/sms/raw/inbox.txt
 *
 * Appends drafts (reviewed: false) to fixtures/sms/real.json and prints how far the real set is
 * from the target. fixtures/sms/raw/ is gitignored: the export never leaves your machine. Read
 * each draft, fix anything personal it missed and the expected fields, then set reviewed: true.
 * Run with --report alone to print the counts.
 */
const { existsSync, readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');
const { anonymize, parseAdbExport } = require('../dist/sms/dev/anonymize');

const TARGET = { real: 50, ignored: 15 };
const out = join(__dirname, '../fixtures/sms/real.json');
const file = existsSync(out) ? JSON.parse(readFileSync(out, 'utf8')) : { _note: 'Real bank SMS, anonymized with scripts/anonymize-sms.cjs and checked by a person (reviewed: true). Only reviewed cases are tested.', cases: [] };

const input = process.argv[2];
if (input && input !== '--report') {
  const text = readFileSync(input, 'utf8');
  const raw = text.trimStart().startsWith('[') ? JSON.parse(text) : parseAdbExport(text);
  const known = new Set(file.cases.map((c) => c.body));
  const drafts = anonymize(raw).filter((d) => !known.has(d.body));
  drafts.forEach((d, i) => (d.name = d.name.replace(/\d+$/, String(file.cases.length + i + 1))));
  file.cases.push(...drafts);
  writeFileSync(out, JSON.stringify(file, null, 2) + '\n');
  console.log(`Read ${raw.length} messages; added ${drafts.length} bank SMS drafts to fixtures/sms/real.json.`);
}

const reviewed = file.cases.filter((c) => c.reviewed === true);
const ignored = reviewed.filter((c) => c.expected === null).length;
const unrecognised = file.cases.filter((c) => c.note).length;
console.log(`Real SMS: ${reviewed.length} reviewed of ${file.cases.length} (target ${TARGET.real}); ${ignored} non-payments reviewed (target ${TARGET.ignored}); ${unrecognised} not recognised.`);
