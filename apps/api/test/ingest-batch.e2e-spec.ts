import type { INestApplication } from '@nestjs/common';
import { createHash } from 'node:crypto';
import request from 'supertest';
import { PrismaService } from '../src/common';
import { bearer, boot, resetDb, signIn, type Session } from './helpers';
import { hdfcStatementPdf } from './make-pdf';

const key = (label: string) => createHash('sha256').update(label).digest('hex');

/** A parsed HDFC UPI SMS as the phone sends it (no body). */
function sms(label: string, overrides: Record<string, unknown> = {}) {
  return {
    source: 'sms',
    messageKey: key(label),
    amountPaise: 48_600,
    direction: 'debit',
    occurredAt: '2026-10-02T07:42:10Z',
    timePrecision: 'minute',
    bank: 'HDFC Bank',
    last4: '6789',
    counterparty: 'Swiggy',
    referenceNo: '427512345601',
    narration: 'UPI',
    ...overrides,
  };
}

describe('POST /v1/ingest/batch (bank SMS)', () => {
  let app: INestApplication;
  let asha: Session;
  let ravi: Session;
  const http = () => request(app.getHttpServer());
  const send = (s: Session, items: unknown[]) => http().post('/v1/ingest/batch').set(bearer(s)).send({ items });
  const ledger = async (s: Session) => (await http().get('/v1/transactions?limit=50').set(bearer(s)).expect(200)).body.items as Record<string, unknown>[];

  beforeEach(async () => {
    app = await boot();
    await resetDb(app);
    asha = await signIn(app, 'asha@example.com');
    ravi = await signIn(app, 'ravi@example.com', 'device-0002');
  });

  afterEach(async () => {
    await app.close();
  });

  it('adds new rows, finds or creates the account, categorizes, and keeps no message text', async () => {
    const res = await send(asha, [
      sms('swiggy'),
      sms('salary', { amountPaise: 7_500_000, direction: 'credit', counterparty: 'Acme Corp', referenceNo: '412345678901', narration: 'CREDIT', occurredAt: '2026-10-01T04:30:00Z' }),
      sms('atm', { amountPaise: 200_000, counterparty: 'ATM withdrawal', referenceNo: undefined, narration: 'ATM WITHDRAWAL', occurredAt: '2026-10-03T09:15:00Z' }),
    ]).expect(200);
    expect(res.body).toEqual({ created: 3, merged: 0, skipped: 0, rejected: 0 });

    const accounts = (await http().get('/v1/accounts').set(bearer(asha)).expect(200)).body.items;
    expect(accounts).toEqual([expect.objectContaining({ bankName: 'HDFC Bank', maskedNumber: '6789', kind: 'savings' })]);

    const rows = await ledger(asha);
    const byMerchant = Object.fromEntries(rows.map((r) => [r.merchantName as string, r]));
    expect(byMerchant['Swiggy']).toMatchObject({ amountPaise: 48_600, type: 'expense', category: { name: 'Food & Dining' }, account: { maskedNumber: '6789' } });
    expect(byMerchant['Acme Corp']).toMatchObject({ type: 'income', category: { name: 'Income' } });
    expect(byMerchant['ATM withdrawal']).toMatchObject({ type: 'atm_withdrawal', category: { name: 'Cash' } });

    const sources = await app.get(PrismaService).transactionSource.findMany({ where: { userId: asha.user.id } });
    expect(sources).toHaveLength(3);
    expect(sources.every((s) => s.source === 'sms' && s.rawText === null)).toBe(true);
  });

  it('adds nothing when the same messages are sent again', async () => {
    await send(asha, [sms('a'), sms('b', { amountPaise: 1000, referenceNo: undefined })]).expect(200);
    const again = await send(asha, [sms('a'), sms('b', { amountPaise: 1000, referenceNo: undefined })]).expect(200);
    expect(again.body).toEqual({ created: 0, merged: 0, skipped: 2, rejected: 0 });
    expect(await ledger(asha)).toHaveLength(2);
  });

  it('keeps two genuine same-amount SMS payments as two rows', async () => {
    const res = await send(asha, [sms('first', { referenceNo: undefined }), sms('second', { referenceNo: undefined, occurredAt: '2026-10-02T08:10:00Z' })]).expect(200);
    expect(res.body).toEqual({ created: 2, merged: 0, skipped: 0, rejected: 0 });
  });

  it('merges an SMS into the statement row for the same payment, and the statement into an SMS', async () => {
    await http().post('/v1/accounts').set(bearer(asha)).send({ bankName: 'HDFC Bank', kind: 'savings', maskedNumber: '6789' }).expect(201);
    const pdf = hdfcStatementPdf([['02/10/26', 'UPI-SWIGGY LIMITED-SWIGGYUPI@AXISBANK-427512345601-PAYMENT', '0000427512345601', '486.00', '', '84,514.00']]);
    const upload = await http().post('/v1/imports').set(bearer(asha)).attach('file', pdf, 'oct.pdf').expect(202);
    let imp = upload.body.import;
    for (let i = 0; i < 60 && imp.status === 'parsing'; i++) {
      await new Promise((r) => setTimeout(r, 250));
      imp = (await http().get(`/v1/imports/${imp.id}`).set(bearer(asha))).body;
    }
    await http().post(`/v1/imports/${imp.id}/confirm`).set(bearer(asha)).expect(200);

    // Same reference and amount: rule 1 merges it.
    const merged = await send(asha, [sms('swiggy')]).expect(200);
    expect(merged.body).toEqual({ created: 0, merged: 1, skipped: 0, rejected: 0 });
    const rows = await ledger(asha);
    expect(rows).toHaveLength(1);
    const detail = await http().get(`/v1/transactions/${rows[0]!.id as string}`).set(bearer(asha)).expect(200);
    expect(detail.body.sources.map((s: { source: string }) => s.source).sort()).toEqual(['sms', 'statement']);
    expect(detail.body.merchantName).toBe('Swiggy Limited');

    // No reference: same account, amount and day (rule 2) still finds it.
    await send(asha, [sms('bescom', { amountPaise: 184_200, counterparty: 'Bescom', referenceNo: undefined, occurredAt: '2026-10-18T12:05:00Z' })]).expect(200);
    const later = hdfcStatementPdf([['18/10/26', 'UPI-BESCOM BANGALORE-BESCOM@HDFCBANK-429112345683-ELECTRICITY BILL', '0000429112345683', '1,842.00', '', '82,672.00']]);
    const up2 = await http().post('/v1/imports').set(bearer(asha)).attach('file', later, 'oct-2.pdf').expect(202);
    let imp2 = up2.body.import;
    for (let i = 0; i < 60 && imp2.status === 'parsing'; i++) {
      await new Promise((r) => setTimeout(r, 250));
      imp2 = (await http().get(`/v1/imports/${imp2.id}`).set(bearer(asha))).body;
    }
    expect(imp2).toMatchObject({ status: 'review', newCount: 0, duplicateCount: 1 });
  });

  it('matches a 3-digit ICICI account to the account ending in those digits', async () => {
    const icici = await http().post('/v1/accounts').set(bearer(asha)).send({ bankName: 'ICICI Bank', kind: 'savings', maskedNumber: '1234' }).expect(201);
    await send(asha, [sms('icici', { bank: 'ICICI Bank', last4: '234' })]).expect(200);
    const [row] = await ledger(asha);
    expect(row).toMatchObject({ account: { id: icici.body.id } });
    expect((await http().get('/v1/accounts').set(bearer(asha))).body.items).toHaveLength(1);
  });

  it('creates no account without 4 digits: the row stays account-unknown', async () => {
    await send(asha, [
      sms('no-digits', { bank: 'SBI', last4: undefined, referenceNo: undefined, narration: 'CARD' }),
      sms('unmatched-suffix', { bank: 'ICICI Bank', last4: '234', referenceNo: undefined, amountPaise: 1_000 }),
      sms('unmatched-suffix-2', { bank: 'ICICI Bank', last4: '987', referenceNo: undefined, amountPaise: 2_000 }),
    ]).expect(200);
    expect((await http().get('/v1/accounts').set(bearer(asha))).body.items).toEqual([]);
    expect((await ledger(asha)).every((r) => r.account === null)).toBe(true);
  });

  it('merges a debit card SMS (no account digits) into the savings statement row for the same spend', async () => {
    await http().post('/v1/accounts').set(bearer(asha)).send({ bankName: 'HDFC Bank', kind: 'savings', maskedNumber: '6789' }).expect(201);
    const card = sms('dmart', {
      amountPaise: 234_000,
      last4: undefined,
      accountKind: 'savings',
      counterparty: 'Dmart Avenue',
      referenceNo: undefined,
      narration: 'CARD',
      occurredAt: '2026-10-14T06:19:52Z',
    });
    expect((await send(asha, [card]).expect(200)).body).toEqual({ created: 1, merged: 0, skipped: 0, rejected: 0 });

    const pdf = hdfcStatementPdf([['14/10/26', 'POS 416021XXXXXX4321 DMART AVENUE', '0000000000000000', '2,340.00', '', '80,174.00']]);
    const upload = await http().post('/v1/imports').set(bearer(asha)).attach('file', pdf, 'oct-card.pdf').expect(202);
    let imp = upload.body.import;
    for (let i = 0; i < 60 && imp.status === 'parsing'; i++) {
      await new Promise((r) => setTimeout(r, 250));
      imp = (await http().get(`/v1/imports/${imp.id}`).set(bearer(asha))).body;
    }
    expect(imp).toMatchObject({ status: 'review', newCount: 0, duplicateCount: 1 });
    expect((await http().get('/v1/accounts').set(bearer(asha))).body.items).toHaveLength(1);
  });

  it("never touches another user's ledger, and the same SMS is separate per user", async () => {
    await send(asha, [sms('shared')]).expect(200);
    expect(await ledger(ravi)).toEqual([]);
    expect((await http().get('/v1/accounts').set(bearer(ravi))).body.items).toEqual([]);
    const res = await send(ravi, [sms('shared')]).expect(200);
    expect(res.body).toEqual({ created: 1, merged: 0, skipped: 0, rejected: 0 });
    expect(await ledger(asha)).toHaveLength(1);
  });

  it.each([
    ['an empty batch', []],
    ['101 items', Array.from({ length: 101 }, (_, i) => sms(`n${i}`))],
    ['a message body field', [{ ...sms('x'), body: 'Sent Rs.486.00 From HDFC Bank' }]],
    ['a float amount', [sms('x', { amountPaise: 486.5 })]],
    ['a bad message key', [sms('x', { messageKey: 'abc' })]],
    ['a full account number', [sms('x', { last4: '50100012346789' })]],
    ['narration that is not a keyword', [sms('x', { narration: 'Sent Rs.486 to Swiggy' })]],
    ['an unknown source', [sms('x', { source: 'statement' })]],
    ['a user id', [sms('x', { userId: '00000000-0000-7000-8000-000000000001' })]],
  ])('rejects %s', async (_name, items) => {
    const res = await send(asha, items as unknown[]).expect(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('counts a row dated more than a day ahead as rejected and still takes the rest', async () => {
    const res = await send(asha, [sms('future', { occurredAt: new Date(Date.now() + 3 * 86_400_000).toISOString() }), sms('today')]).expect(200);
    expect(res.body).toEqual({ created: 1, merged: 0, skipped: 0, rejected: 1 });
    expect(await ledger(asha)).toHaveLength(1);
    const alone = await send(asha, [sms('future-2', { occurredAt: new Date(Date.now() + 3 * 86_400_000).toISOString() })]).expect(200);
    expect(alone.body).toEqual({ created: 0, merged: 0, skipped: 0, rejected: 1 });
  });

  it('needs a token', async () => {
    await http().post('/v1/ingest/batch').send({ items: [sms('x')] }).expect(401);
  });
});
