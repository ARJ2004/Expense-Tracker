import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import request from 'supertest';
import { SYSTEM_CATEGORIES } from '@et/domain';
import { PrismaService } from '../src/common';
import { bearer, boot, resetDb, signIn, type Session } from './helpers';

const FIXTURES = join(__dirname, '../../../packages/parsers/fixtures');
const HDFC = readFileSync(join(FIXTURES, 'hdfc/savings-oct-2026.csv'));
const GENERIC = readFileSync(join(FIXTURES, 'generic/amount-drcr.csv'));
const SHOPPING = SYSTEM_CATEGORIES.find((c) => c.key === 'shopping')!.id;

/** One debit no rule knows: it lands on Other and needs a category in review. */
const UNKNOWN = Buffer.from(
  [
    'Account No :50100012346789',
    'Date,Narration,Chq./Ref.No.,Value Dt,Withdrawal Amt.,Deposit Amt.,Closing Balance',
    '06/10/26,UPI-SRI LAKSHMI STORES-LAKSHMI@OKSBI-SBIN0000001-427912345601-PAYMENT,0000427912345601,06/10/26,740.00,,"9,260.00"',
  ].join('\n'),
);

/** Rows 9–11 of the HDFC fixture plus one later row: an overlapping second statement. */
const OVERLAP = Buffer.from(
  [
    'Account No :50100012346789',
    'Date,Narration,Chq./Ref.No.,Value Dt,Withdrawal Amt.,Deposit Amt.,Closing Balance',
    '18/10/26,"UPI-BESCOM BANGALORE-BESCOM@HDFCBANK-HDFC0000001-429112345683-ELECTRICITY BILL",0000429112345683,18/10/26,"1,842.00",,"75,723.10"',
    '21/10/26,UPI-ZOMATO LTD-ZOMATO@HDFCBANK-HDFC0000001-429412345684-PAYMENT FROM,0000429412345684,21/10/26,612.00,,"75,111.10"',
    ',PHONE,,,,,',
    '25/10/26,CREDIT INTEREST CAPITALISED,000000000000000,25/10/26,,212.00,"75,323.10"',
    '28/10/26,UPI-PVR INOX-PVRINOX@ICICI-ICIC0000001-430112345690-MOVIE,0000430112345690,28/10/26,640.00,,"74,683.10"',
  ].join('\n'),
);

describe('/v1/imports', () => {
  let app: INestApplication;
  let asha: Session;
  let ravi: Session;
  const http = () => request(app.getHttpServer());

  const upload = (s: Session, file: Buffer, name = 'statement.csv') => http().post('/v1/imports').set(bearer(s)).attach('file', file, name);

  /** Waits for the background parse job to finish. */
  async function settled(s: Session, id: string): Promise<Record<string, unknown>> {
    for (let i = 0; i < 60; i++) {
      const res = await http().get(`/v1/imports/${id}`).set(bearer(s)).expect(200);
      if (res.body.status !== 'parsing') return res.body as Record<string, unknown>;
      await new Promise((r) => setTimeout(r, 250));
    }
    throw new Error('import still parsing');
  }

  async function uploaded(s: Session, file: Buffer, name?: string) {
    const res = await upload(s, file, name).expect(202);
    return { ...res.body, import: await settled(s, res.body.import.id) } as { import: Record<string, unknown> & { id: string }; alreadyImportedAt?: string };
  }

  const hdfcAccount = (s: Session) =>
    http().post('/v1/accounts').set(bearer(s)).send({ bankName: 'HDFC Bank', kind: 'savings', maskedNumber: '6789' }).expect(201);

  const rows = async (s: Session, id: string, filter = 'all') => (await http().get(`/v1/imports/${id}/rows?filter=${filter}`).set(bearer(s)).expect(200)).body.items as Record<string, unknown>[];

  beforeEach(async () => {
    app = await boot();
    await resetDb(app);
    asha = await signIn(app, 'asha@example.com');
    ravi = await signIn(app, 'ravi@example.com', 'device-0002');
  });

  afterEach(async () => {
    await app.close();
  });

  it('parses an HDFC statement, detects the account and adds every row', async () => {
    const account = await hdfcAccount(asha);
    const { import: imp } = await uploaded(asha, HDFC, 'Acct_Statement_Oct2026.csv');
    expect(imp).toMatchObject({
      status: 'review',
      fileName: 'Acct_Statement_Oct2026.csv',
      bankDetected: 'HDFC Bank',
      account: { id: account.body.id, maskedNumber: '6789' },
      periodFrom: '2026-10-01',
      periodTo: '2026-10-25',
      rowCount: 11,
      newCount: 11,
      duplicateCount: 0,
      flaggedCount: 0,
      selectedCount: 11,
    });

    const all = await rows(asha, imp.id);
    expect(all[1]).toMatchObject({ rowNo: 2, occurredOn: '2026-10-02', amountPaise: 48600, direction: 'debit', merchantName: 'Swiggy Limited', referenceNo: '427512345678', status: 'new', action: 'import' });
    expect((all[1]!.category as { name: string }).name).toBe('Food & Dining');
    expect(all[9]).toMatchObject({ narration: 'UPI-ZOMATO LTD-ZOMATO@HDFCBANK-HDFC0000001-429412345684-PAYMENT FROM PHONE' });

    const done = await http().post(`/v1/imports/${imp.id}/confirm`).set(bearer(asha)).expect(200);
    expect(done.body).toMatchObject({ status: 'imported', importedCount: 11, mergedCount: 0 });

    const ledger = await http().get('/v1/transactions?limit=50').set(bearer(asha)).expect(200);
    expect(ledger.body.items).toHaveLength(11);
    const types = Object.fromEntries((ledger.body.items as { merchantName: string; type: string }[]).map((t) => [t.merchantName, t.type]));
    const atm = (ledger.body.items as { merchantName: string; category: { name: string } }[]).find((t) => t.merchantName === 'ATM withdrawal')!;
    expect(atm.category.name).toBe('Transfers');
    expect(types).toMatchObject({ 'ATM withdrawal': 'atm_withdrawal', 'Amazon Seller Services': 'refund', 'Acme Software Pvt Ltd': 'income', 'Swiggy Limited': 'expense' });
    const swiggy = (ledger.body.items as { id: string; merchantName: string }[]).find((t) => t.merchantName === 'Swiggy Limited')!;
    const detail = await http().get(`/v1/transactions/${swiggy.id}`).set(bearer(asha)).expect(200);
    expect(detail.body).toMatchObject({ amountPaise: 48600, account: { id: account.body.id }, occurredAt: expect.stringMatching(/^2026-10-0[12]T18:30:00/) });
    expect(detail.body.sources).toEqual([expect.objectContaining({ source: 'statement' })]);
  });

  it('adds nothing when the same file is imported again, and says when it was first imported', async () => {
    await hdfcAccount(asha);
    const first = await uploaded(asha, HDFC);
    await http().post(`/v1/imports/${first.import.id}/confirm`).set(bearer(asha)).expect(200);

    const again = await uploaded(asha, HDFC);
    expect(again.alreadyImportedAt).toEqual(expect.any(String));
    expect(again.import).toMatchObject({ newCount: 0, duplicateCount: 11, selectedCount: 0 });
    const done = await http().post(`/v1/imports/${again.import.id}/confirm`).set(bearer(asha)).expect(200);
    expect(done.body).toMatchObject({ importedCount: 0 });
    expect((await http().get('/v1/transactions?limit=50').set(bearer(asha))).body.items).toHaveLength(11);
  });

  it('adds each row of two overlapping statements once', async () => {
    await hdfcAccount(asha);
    const first = await uploaded(asha, HDFC);
    await http().post(`/v1/imports/${first.import.id}/confirm`).set(bearer(asha)).expect(200);
    const second = await uploaded(asha, OVERLAP);
    expect(second.import).toMatchObject({ rowCount: 4, newCount: 1, duplicateCount: 3 });
    await http().post(`/v1/imports/${second.import.id}/confirm`).set(bearer(asha)).expect(200);
    expect((await http().get('/v1/transactions?limit=50').set(bearer(asha))).body.items).toHaveLength(12);
  });

  it('merges a manual entry with its statement row and keeps what the user typed', async () => {
    const account = await hdfcAccount(asha);
    const manual = await http()
      .post('/v1/transactions')
      .set(bearer(asha))
      .send({ clientRequestId: randomUUID(), amountPaise: 48_600, direction: 'debit', occurredAt: '2026-10-02T07:30:00Z', merchantName: 'Swiggy', note: 'lunch' })
      .expect(201);

    const { import: imp } = await uploaded(asha, HDFC);
    expect(imp).toMatchObject({ newCount: 10, duplicateCount: 1, flaggedCount: 0 });
    const dup = await rows(asha, imp.id, 'duplicates');
    expect(dup).toEqual([expect.objectContaining({ rowNo: 2, status: 'duplicate', duplicateOf: manual.body.id, action: 'skip' })]);
    // The second ₹486 Swiggy order a day later is its own payment, not a possible duplicate.
    expect((await rows(asha, imp.id))[2]).toMatchObject({ rowNo: 3, status: 'new', action: 'import' });

    const done = await http().post(`/v1/imports/${imp.id}/confirm`).set(bearer(asha)).expect(200);
    expect(done.body).toMatchObject({ importedCount: 10, mergedCount: 1 });
    const detail = await http().get(`/v1/transactions/${manual.body.id}`).set(bearer(asha)).expect(200);
    expect(detail.body).toMatchObject({ merchantName: 'Swiggy', note: 'lunch', occurredAt: '2026-10-02T07:30:00.000Z', account: { id: account.body.id } });
    // The statement filled the reference number the manual entry lacked.
    const stored = await app.get(PrismaService).transaction.findUniqueOrThrow({ where: { id: manual.body.id } });
    expect(stored.referenceNo).toBe('427512345678');
    expect((detail.body.sources as { source: string }[]).map((s) => s.source).sort()).toEqual(['manual', 'statement']);
    expect((await http().get('/v1/transactions?limit=50').set(bearer(asha))).body.items).toHaveLength(11);
  });

  it('flags a same-amount entry 3 days away as a possible duplicate, unticked', async () => {
    await hdfcAccount(asha);
    await http()
      .post('/v1/transactions')
      .set(bearer(asha))
      .send({ clientRequestId: randomUUID(), amountPaise: 31_240, direction: 'debit', occurredAt: '2026-10-12T10:00:00Z', merchantName: 'Cab' })
      .expect(201);
    const { import: imp } = await uploaded(asha, HDFC);
    expect(imp).toMatchObject({ flaggedCount: 1, newCount: 10 });
    expect(await rows(asha, imp.id, 'flagged')).toEqual([expect.objectContaining({ rowNo: 8, status: 'possible_duplicate', action: 'skip' })]);
  });

  it('creates a ticked duplicate as a new transaction', async () => {
    await hdfcAccount(asha);
    const first = await uploaded(asha, HDFC);
    await http().post(`/v1/imports/${first.import.id}/confirm`).set(bearer(asha)).expect(200);
    const again = await uploaded(asha, HDFC);
    await http().patch(`/v1/imports/${again.import.id}/rows/2`).set(bearer(asha)).send({ action: 'import' }).expect(200);
    const done = await http().post(`/v1/imports/${again.import.id}/confirm`).set(bearer(asha)).expect(200);
    expect(done.body).toMatchObject({ importedCount: 0, selectedCount: 1 });
  });

  it('needs an account before adding, and re-checks duplicates when one is picked', async () => {
    const { import: imp } = await uploaded(asha, GENERIC, 'sbi.csv');
    expect(imp).toMatchObject({ status: 'review', account: null, rowCount: 3, bankDetected: null });
    const refused = await http().post(`/v1/imports/${imp.id}/confirm`).set(bearer(asha)).expect(409);
    expect(refused.body.error.code).toBe('ACCOUNT_REQUIRED');

    const account = await http().post('/v1/accounts').set(bearer(asha)).send({ bankName: 'SBI', kind: 'savings', maskedNumber: '5521' }).expect(201);
    const picked = await http().patch(`/v1/imports/${imp.id}`).set(bearer(asha)).send({ accountId: account.body.id }).expect(200);
    expect(picked.body.account.id).toBe(account.body.id);
    await http().post(`/v1/imports/${imp.id}/confirm`).set(bearer(asha)).expect(200);
  });

  it('keeps the category the user picked in review', async () => {
    await hdfcAccount(asha);
    const { import: imp } = await uploaded(asha, UNKNOWN);
    expect(imp).toMatchObject({ needsCategoryCount: 1 });
    const needs = await rows(asha, imp.id, 'needs_category');
    expect(needs).toHaveLength(1);
    const rowNo = needs[0]!.rowNo as number;
    const patched = await http().patch(`/v1/imports/${imp.id}/rows/${rowNo}`).set(bearer(asha)).send({ categoryId: SHOPPING, merchantName: 'Neighbour' }).expect(200);
    expect(patched.body).toMatchObject({ categorySource: 'user', merchantName: 'Neighbour', category: { id: SHOPPING } });
    await http().post(`/v1/imports/${imp.id}/confirm`).set(bearer(asha)).expect(200);
    const ledger = await http().get('/v1/transactions?limit=50&q=Neighbour').set(bearer(asha)).expect(200);
    expect(ledger.body.items).toHaveLength(1);
    const detail = await http().get(`/v1/transactions/${ledger.body.items[0].id}`).set(bearer(asha)).expect(200);
    expect(detail.body).toMatchObject({ merchantName: 'Neighbour', category: { id: SHOPPING }, categorySource: 'user' });
  });

  it('refuses PDFs, unknown files, oversized files and a missing file', async () => {
    const pdf = await upload(asha, Buffer.from('%PDF-1.7\n...'), 'statement.pdf').expect(415);
    expect(pdf.body.error.code).toBe('IMPORT_PDF_NOT_YET');
    const bin = await upload(asha, Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0]), 'old.xls').expect(415);
    expect(bin.body.error.code).toBe('IMPORT_UNSUPPORTED_FORMAT');
    const big = await upload(asha, Buffer.alloc(10 * 1024 * 1024 + 1, 'a'), 'big.csv').expect(413);
    expect(big.body.error.code).toBe('FILE_TOO_LARGE');
    await http().post('/v1/imports').set(bearer(asha)).field('accountId', randomUUID()).expect(400);
  });

  it('fails a file with no statement in it, without keeping the file', async () => {
    const { import: imp } = await uploaded(asha, Buffer.from('hello,world\nthis,is not a statement\n'), 'notes.csv');
    expect(imp).toMatchObject({ status: 'failed', error: 'IMPORT_UNREADABLE', rowCount: 0 });
  });

  it("returns 404 for another user's import on every endpoint", async () => {
    const { import: imp } = await uploaded(asha, HDFC);
    const id = imp.id;
    await http().get(`/v1/imports/${id}`).set(bearer(ravi)).expect(404);
    await http().get(`/v1/imports/${id}/rows`).set(bearer(ravi)).expect(404);
    await http().patch(`/v1/imports/${id}/rows/1`).set(bearer(ravi)).send({ action: 'skip' }).expect(404);
    await http().patch(`/v1/imports/${id}`).set(bearer(ravi)).send({ accountId: randomUUID() }).expect(404);
    await http().post(`/v1/imports/${id}/confirm`).set(bearer(ravi)).expect(404);
    await http().delete(`/v1/imports/${id}`).set(bearer(ravi)).expect(404);
    expect((await http().get('/v1/imports').set(bearer(ravi))).body.items).toEqual([]);
  });

  it('discards an import in review but not one already added', async () => {
    await hdfcAccount(asha);
    const a = await uploaded(asha, HDFC);
    await http().delete(`/v1/imports/${a.import.id}`).set(bearer(asha)).expect(204);
    await http().get(`/v1/imports/${a.import.id}`).set(bearer(asha)).expect(404);
    const b = await uploaded(asha, HDFC);
    await http().post(`/v1/imports/${b.import.id}/confirm`).set(bearer(asha)).expect(200);
    const res = await http().delete(`/v1/imports/${b.import.id}`).set(bearer(asha)).expect(409);
    expect(res.body.error.code).toBe('IMPORT_ALREADY_CONFIRMED');
    const again = await http().post(`/v1/imports/${b.import.id}/confirm`).set(bearer(asha)).expect(409);
    expect(again.body.error.code).toBe('IMPORT_NOT_IN_REVIEW');
  });

  it('lists imports newest first', async () => {
    await uploaded(asha, HDFC, 'one.csv');
    await uploaded(asha, GENERIC, 'two.csv');
    const res = await http().get('/v1/imports').set(bearer(asha)).expect(200);
    expect((res.body.items as { fileName: string }[]).map((i) => i.fileName)).toEqual(['two.csv', 'one.csv']);
  });
});
