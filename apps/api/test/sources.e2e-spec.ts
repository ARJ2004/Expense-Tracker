import type { INestApplication } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import request from 'supertest';
import { bearer, boot, resetDb, signIn, type Session } from './helpers';
import { hdfcStatementPdf } from './make-pdf';

const key = (label: string) => createHash('sha256').update(label).digest('hex');

/** A parsed HDFC UPI SMS as the phone sends it (no body). */
function sms(label: string, overrides: Record<string, unknown> = {}) {
  return {
    source: 'sms',
    messageKey: key(label),
    amountPaise: 50_000,
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

describe('GET /v1/ingest/sources and the SMS → statement merge', () => {
  let app: INestApplication;
  let asha: Session;
  let ravi: Session;
  const http = () => request(app.getHttpServer());
  const sources = async (s: Session) => (await http().get('/v1/ingest/sources').set(bearer(s)).expect(200)).body.items;

  /** Uploads a statement, waits for parsing, and returns the import as it stands for review. */
  async function importStatement(s: Session, pdf: Buffer, name: string) {
    const upload = await http().post('/v1/imports').set(bearer(s)).attach('file', pdf, name).expect(202);
    let imp = upload.body.import;
    for (let i = 0; i < 60 && imp.status === 'parsing'; i++) {
      await new Promise((r) => setTimeout(r, 250));
      imp = (await http().get(`/v1/imports/${imp.id}`).set(bearer(s))).body;
    }
    return imp;
  }

  beforeEach(async () => {
    app = await boot();
    await resetDb(app);
    asha = await signIn(app, 'asha@example.com');
    ravi = await signIn(app, 'ravi@example.com', 'device-0002');
  });

  afterEach(async () => {
    await app.close();
  });

  it('lists every source with zero before anything is added', async () => {
    expect(await sources(asha)).toEqual([
      { kind: 'sms', transactions: 0, lastAt: null },
      { kind: 'statement', transactions: 0, lastAt: null },
      { kind: 'manual', transactions: 0, lastAt: null },
    ]);
  });

  it('merges a later statement row into the SMS for the same payment, and counts it under both', async () => {
    // The sprint demo: a ₹500 UPI payment arrives by SMS first.
    await http().post('/v1/accounts').set(bearer(asha)).send({ bankName: 'HDFC Bank', kind: 'savings', maskedNumber: '6789' }).expect(201);
    await http().post('/v1/ingest/batch').set(bearer(asha)).send({ items: [sms('swiggy'), sms('zomato', { amountPaise: 32_000, counterparty: 'Zomato', referenceNo: '427512345699', occurredAt: '2026-10-03T13:10:00Z' })] }).expect(200);
    await http().post('/v1/transactions').set(bearer(asha)).send({ clientRequestId: randomUUID(), amountPaise: 12_000, direction: 'debit', occurredAt: '2026-10-04T10:00:00Z' }).expect(201);

    // The statement row for the Swiggy payment carries the same reference: it is a duplicate.
    const pdf = hdfcStatementPdf([['02/10/26', 'UPI-SWIGGY LIMITED-SWIGGYUPI@AXISBANK-427512345601-PAYMENT', '0000427512345601', '500.00', '', '84,500.00']]);
    const imp = await importStatement(asha, pdf, 'oct.pdf');
    expect(imp).toMatchObject({ status: 'review', newCount: 0, duplicateCount: 1 });
    await http().post(`/v1/imports/${imp.id}/confirm`).set(bearer(asha)).expect(200);

    const rows = (await http().get('/v1/transactions?limit=50').set(bearer(asha)).expect(200)).body.items as { id: string; amountPaise: number }[];
    expect(rows).toHaveLength(3);
    const swiggy = rows.find((r) => r.amountPaise === 50_000)!;
    const detail = (await http().get(`/v1/transactions/${swiggy.id}`).set(bearer(asha)).expect(200)).body;
    expect(detail.sources.map((s: { source: string }) => s.source).sort()).toEqual(['sms', 'statement']);

    const stats = await sources(asha);
    expect(stats).toEqual([
      { kind: 'sms', transactions: 2, lastAt: expect.any(String) },
      { kind: 'statement', transactions: 1, lastAt: expect.any(String) },
      { kind: 'manual', transactions: 1, lastAt: expect.any(String) },
    ]);

    // Someone else's ledger never shows up.
    expect((await sources(ravi)).map((s: { transactions: number }) => s.transactions)).toEqual([0, 0, 0]);
  });

  it('stops counting a transaction once it is deleted', async () => {
    await http().post('/v1/ingest/batch').set(bearer(asha)).send({ items: [sms('one'), sms('two', { amountPaise: 9_900, referenceNo: undefined, occurredAt: '2026-10-05T07:00:00Z' })] }).expect(200);
    const rows = (await http().get('/v1/transactions?limit=50').set(bearer(asha)).expect(200)).body.items as { id: string }[];
    await http().delete(`/v1/transactions/${rows[0]!.id}`).set(bearer(asha)).expect(204);
    expect((await sources(asha))[0]).toMatchObject({ kind: 'sms', transactions: 1 });
  });

  it('needs a token', async () => {
    await http().get('/v1/ingest/sources').expect(401);
  });
});
