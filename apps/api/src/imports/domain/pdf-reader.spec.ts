import { pickStatementAdapter } from '@et/parsers';
import { axisStatementPdf, ENCRYPTED_PASSWORD, encryptedPdf, hdfcStatementPdf, makePdf } from '../../../test/make-pdf';
import { countPageObjects, MAX_PDF_PAGES, PdfError, pdfTextItems, readPdf } from './pdf-reader';

const ROWS = [
  ['01/10/26', 'NEFT CR-ICIC0000001-ACME CORP-SALARY OCT', '0000412345678901', '', '75,000.00', '85,000.00'],
  ['02/10/26', 'UPI-SWIGGY LIMITED-SWIGGYUPI@AXISBANK-427512345601-PAYMENT', '0000427512345601', '486.00', '', '84,514.00'],
  ['03/10/26', 'ATW-416021XXXXXX1234-S1ANBG12-BANGALORE', '0000000000001234', '2,000.00', '', '82,514.00'],
] as const;

async function failure(bytes: Buffer, password?: string): Promise<string> {
  try {
    await readPdf(bytes, password);
  } catch (e) {
    if (e instanceof PdfError) return e.code;
    throw e;
  }
  throw new Error('expected readPdf to fail');
}

describe('readPdf', () => {
  it('reads a text PDF statement into a sheet the HDFC adapter parses', async () => {
    const sheet = await readPdf(hdfcStatementPdf(ROWS));
    const adapter = pickStatementAdapter(sheet);
    expect(adapter?.id).toBe('hdfc');
    const parsed = adapter!.parse(sheet);
    expect(parsed.accountLast4).toBe('6789');
    expect(parsed.rows.map((r) => [r.date, r.amountPaise, r.direction])).toEqual([
      ['2026-10-01', 7_500_000, 'credit'],
      ['2026-10-02', 48_600, 'debit'],
      ['2026-10-03', 200_000, 'debit'],
    ]);
    expect(parsed.rows.map((r) => r.balancePaise)).toEqual([8_500_000, 8_451_400, 8_251_400]);
  });

  it('reads an Axis statement PDF with its short DR / CR / BAL headings', async () => {
    const sheet = await readPdf(
      axisStatementPdf([
        ['01-10-2026', 'NEFT/AXISN26274123456/ACME SOFTWARE PVT LTD/HDFC BANK/SALARY', '', '78,000.00', '96,100.00'],
        ['02-10-2026', 'UPI/P2M/427512345611/SWIGGY LIMITED/UPI/YES BANK', '486.00', '', '95,614.00'],
      ]),
    );
    const adapter = pickStatementAdapter(sheet);
    expect(adapter?.id).toBe('axis');
    expect(adapter!.parse(sheet)).toMatchObject({
      bank: 'Axis Bank',
      accountLast4: '5678',
      skipped: 0,
      rows: [
        { date: '2026-10-01', amountPaise: 7_800_000, direction: 'credit', counterparty: 'Acme Software Pvt Ltd', balancePaise: 9_610_000 },
        { date: '2026-10-02', amountPaise: 48_600, direction: 'debit', counterparty: 'Swiggy Limited', balancePaise: 9_561_400 },
      ],
    });
  });

  it('calls a PDF with no text layer a scan', async () => {
    expect(await failure(makePdf([[]]))).toBe('IMPORT_PDF_SCANNED');
  });

  it('calls a PDF it cannot open unreadable', async () => {
    expect(await failure(Buffer.from('%PDF-1.7\nnot really a pdf'))).toBe('IMPORT_UNREADABLE');
  });

  it('asks for the password of an AES-256 PDF, refuses a wrong one and reads it with the right one', async () => {
    const locked = encryptedPdf('aes256');
    expect(await failure(locked)).toBe('IMPORT_PASSWORD_PROTECTED');
    expect(await failure(locked, 'wrong')).toBe('IMPORT_WRONG_PASSWORD');
    expect(pickStatementAdapter(await readPdf(locked, ENCRYPTED_PASSWORD))?.id).toBe('hdfc');
  });

  it('reads the right rows from a decrypted PDF', async () => {
    const sheet = await readPdf(encryptedPdf('aes256'), ENCRYPTED_PASSWORD);
    expect(pickStatementAdapter(sheet)!.parse(sheet).rows.map((r) => [r.date, r.amountPaise, r.direction])).toEqual([
      ['2026-10-01', 7_500_000, 'credit'],
      ['2026-10-02', 48_600, 'debit'],
    ]);
  });

  it('reads a PDF with only an owner password without asking', async () => {
    const sheet = await readPdf(encryptedPdf('owner-only'));
    expect(pickStatementAdapter(sheet)!.parse(sheet).rows).toHaveLength(2);
  });

  it('refuses a PDF with too many pages before parsing it', async () => {
    const pages = Array.from({ length: MAX_PDF_PAGES + 1 }, () => [[30, 800, 'x']] as [number, number, string][]);
    expect(await failure(makePdf(pages))).toBe('IMPORT_TOO_MANY_ROWS');
  });

  it('counts page objects, not the page tree', () => {
    expect(countPageObjects(Buffer.from('<< /Type /Pages /Kids [3 0 R 4 0 R] >> << /Type /Page >> << /Type/Page /Parent 2 0 R >>'))).toBe(2);
  });

  it('converts pdf.js points to top-down page units and drops blank runs', () => {
    const run = (str: string, x: number, y: number, width: number) => ({ str, dir: 'ltr', transform: [9, 0, 0, 9, x, y], width, height: 9, fontName: 'F1', hasEOL: false });
    expect(pdfTextItems(1, 842, [run('Date', 32, 810, 32), run(' ', 70, 810, 3)])).toEqual([{ page: 1, x: 2, y: 2, width: 2, text: 'Date' }]);
  });
});
