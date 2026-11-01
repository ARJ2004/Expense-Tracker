import { parseSms } from '../index';
import { anonymize, parseAdbExport, type RawSms } from './anonymize';

const at = Date.parse('2026-10-18T07:42:10Z');
const sms = (sender: string, body: string): RawSms => ({ sender, body, date: at });

describe('anonymize', () => {
  const real = [
    sms('VM-HDFCBK', 'Sent Rs.486.00 From HDFC Bank A/C *4821 To RAVI KUMAR On 18/10/26 Ref 427512399001 Not You? Call 18002586161/SMS BLOCK UPI to 7308080808'),
    sms('VM-HDFCBK', 'Rs.1842.00 debited from a/c **4821 on 18-10-26 to VPA ravi.k99@okhdfcbank(UPI Ref No 427512399001). Avl bal: INR 1,82,514.36'),
    sms('AX-AXISBK', 'INR 486.00 debited\nA/c no. XX7745\n18-10-26, 13:12:10\nUPI/P2M/429912399002/SWIGGY LIMITED\nNot you? SMS BLOCKUPI Cust ID to 919951860002\nAxis Bank'),
    sms('VM-SBIINB', 'Dear ANITA SHARMA, your A/c X5531-credited by Rs.75000 on 18Oct26 transfer from ANITA SHARMA Ref No 412345698765 -SBI. Mail me at anita.s@gmail.com 9876543210'),
    sms('VM-ICICIB', 'Your ICICI Bank a/c XX234 has a new statement. Something we have not seen before.'),
    sms('+919876543210', 'Sent Rs.10.00 From HDFC Bank A/C *4821 To ME'),
  ];
  const drafts = anonymize(real);
  const text = drafts.map((d) => d.body).join('\n');

  it('keeps only bank senders and marks every draft unreviewed', () => {
    expect(drafts).toHaveLength(5);
    expect(drafts.every((d) => d.origin === 'real' && d.reviewed === false)).toBe(true);
  });

  it('removes account digits, references, people, VPAs, emails, phones and balances', () => {
    for (const secret of ['4821', '7745', '5531', '427512399001', '429912399002', '412345698765', 'RAVI KUMAR', 'ravi.k99', 'ANITA', 'gmail', '9876543210', '1,82,514.36']) {
      expect(text).not.toContain(secret);
    }
  });

  it('keeps amounts, dates, businesses, bank handles and public helplines', () => {
    for (const kept of ['Rs.486.00', '18/10/26', 'SWIGGY LIMITED', '@okhdfcbank', '18002586161', '7308080808', '919951860002', 'Rs.75000']) {
      expect(text).toContain(kept);
    }
  });

  it('replaces the same value the same way everywhere', () => {
    const [first, second] = drafts;
    expect(first!.expected?.referenceNo).toBeDefined();
    expect(first!.expected?.referenceNo).toBe(second!.expected?.referenceNo);
    expect((first!.expected?.accountHint as { last4: string }).last4).toBe((second!.expected?.accountHint as { last4: string }).last4);
  });

  it('fills expected from the parser and flags what it does not recognise', () => {
    expect(drafts[0]!.expected).toMatchObject({ template: 'hdfc', amountPaise: 48_600, direction: 'debit', counterparty: 'Person A' });
    expect(drafts[2]!.expected).toMatchObject({ template: 'axis', counterparty: 'Swiggy Limited' });
    expect(drafts[4]!.expected).toBeNull();
    expect(drafts[4]!.note).toMatch(/Not recognised/);
    for (const d of drafts) {
      const txn = parseSms(d.sender, d.body, new Date(d.receivedAt));
      expect(txn?.amountPaise ?? null).toBe((d.expected?.amountPaise as number | undefined) ?? null);
    }
  });
});

describe('parseAdbExport', () => {
  it('reads multi-line bodies with commas', () => {
    const out = parseAdbExport(
      'Row: 0 address=AX-AXISBK, body=INR 486.00 debited\nA/c no. XX1234, 18-10-26, date=1792312930000\nRow: 1 address=VM-HDFCBK, body=Rs.10 debited, date=1792312940000\n',
    );
    expect(out).toEqual([
      { sender: 'AX-AXISBK', body: 'INR 486.00 debited\nA/c no. XX1234, 18-10-26', date: 1792312930000 },
      { sender: 'VM-HDFCBK', body: 'Rs.10 debited', date: 1792312940000 },
    ]);
  });
});
