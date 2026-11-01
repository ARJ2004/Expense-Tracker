import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Papa from 'papaparse';
import { parseSms } from './sms';
import { pickStatementAdapter } from './statement/adapters';
import type { Sheet } from './statement/types';

/**
 * The SMS and the statement row for one payment must carry the same reference number and amount,
 * or dedup rule 1 can't merge them (the API's ReferenceRule compares them trimmed, upper-cased).
 * Each pair is a bank's SMS (as in fixtures/sms/messages.json) for a row of that bank's statement
 * fixture, with the row's own reference.
 */
const pairs = [
  {
    bank: 'hdfc',
    sender: 'VM-HDFCBK',
    body: 'Sent Rs.486.00 From HDFC Bank A/C *1234 To SWIGGY On 02/10/26 Ref 427512345678 Not You? Call 18002586161/SMS BLOCK UPI to 7308080808',
    ref: '427512345678',
  },
  {
    bank: 'icici',
    sender: 'VM-ICICIB',
    body: 'ICICI Bank Acct XX234 debited for Rs 612.00 on 03-Oct-26; ZOMATO LTD credited. UPI:427712345602. Call 18002662 for dispute. SMS BLOCK 234 to 9215676766.',
    ref: '427712345602',
  },
  {
    bank: 'sbi',
    sender: 'VM-SBIUPI',
    body: 'Dear UPI user A/C X1234 debited by 486.0 on date 02Oct26 trf to SWIGGY Refno 427512345601. If not u? call 1800111109. -SBI',
    ref: '427512345601',
  },
  {
    bank: 'axis',
    sender: 'AX-AXISBK',
    body: 'INR 486.00 debited\nA/c no. XX1234\n02-10-26, 13:12:10\nUPI/P2M/427512345611/SWIGGY LIMITED\nNot you? SMS BLOCKUPI Cust ID to 919951860002\nAxis Bank',
    ref: '427512345611',
  },
];

const norm = (ref: string | undefined) => ref?.trim().toUpperCase();

describe.each(pairs)('$bank: SMS ↔ statement for the same payment', ({ bank, sender, body, ref }) => {
  const path = join(__dirname, `../fixtures/${bank}/savings-oct-2026.csv`);
  const sheet = Papa.parse<string[]>(readFileSync(path, 'utf8'), { skipEmptyLines: false }).data as Sheet;

  it('reads the same reference number and amount from both', () => {
    const sms = parseSms(sender, body, new Date('2026-10-02T07:42:10Z'));
    expect(sms).not.toBeNull();
    const row = pickStatementAdapter(sheet, path)!.parse(sheet).rows.find((r) => norm(r.referenceNo) === ref);
    expect(row).toBeDefined();
    expect(norm(sms!.referenceNo)).toBe(norm(row!.referenceNo));
    expect(sms!.amountPaise).toBe(row!.amountPaise);
    expect(sms!.direction).toBe(row!.direction);
  });
});
