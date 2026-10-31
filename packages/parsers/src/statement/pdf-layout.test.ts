import { pickStatementAdapter } from './adapters';
import { balanceBreaks } from './balance';
import { layoutPdfText, type PdfTextItem } from './pdf-layout';

/** Roughly Helvetica 9 pt in the PDF reader's units (16 pt): ~0.3 units a character. */
const W = 0.3;
const at = (page: number, y: number, x: number, text: string): PdfTextItem => ({ page, x, y, width: text.length * W, text });
/** Right-aligned: the text ends at `right`. */
const right = (page: number, y: number, rightEdge: number, text: string): PdfTextItem => at(page, y, rightEdge - text.length * W, text);

const COLS = { date: 2, narration: 5, ref: 17, value: 21.5, withdrawal: 24.5, deposit: 30, balance: 34.5 };
/** Right edges of the amount columns (amounts sit flush right under their headings). */
const EDGE = { withdrawal: 29, deposit: 34, balance: 39 };

/** Words of one heading as separate runs, a space (~2.5 pt) apart, as PDF writers often emit them. */
function words(page: number, y: number, x: number, text: string): PdfTextItem[] {
  const out: PdfTextItem[] = [];
  let cursor = x;
  for (const w of text.split(' ')) {
    out.push(at(page, y, cursor, w));
    cursor += w.length * W + 0.15;
  }
  return out;
}

function header(page: number, y: number): PdfTextItem[] {
  return [
    ...words(page, y, COLS.date, 'Date'),
    ...words(page, y, COLS.narration, 'Narration'),
    ...words(page, y, COLS.ref, 'Chq./Ref.No.'),
    ...words(page, y, COLS.value, 'Value Dt'),
    ...words(page, y, COLS.withdrawal, 'Withdrawal Amt.'),
    ...words(page, y, COLS.deposit, 'Deposit Amt.'),
    ...words(page, y, COLS.balance, 'Closing Balance'),
  ];
}

function row(page: number, y: number, date: string, narration: string, ref: string, debit: string, credit: string, balance: string): PdfTextItem[] {
  const out = [at(page, y, COLS.date, date), at(page, y, COLS.narration, narration), at(page, y, COLS.ref, ref), at(page, y, COLS.value, date)];
  if (debit) out.push(right(page, y, EDGE.withdrawal, debit));
  if (credit) out.push(right(page, y, EDGE.deposit, credit));
  out.push(right(page, y, EDGE.balance, balance));
  return out;
}

const preamble = (page: number): PdfTextItem[] => [at(page, 1, 2, 'HDFC BANK LIMITED'), at(page, 2, 2, 'Account No :50100012346789')];

/** A two-page HDFC-style statement with a wrapped narration and the header repeated on page 2. */
const ITEMS: PdfTextItem[] = [
  ...preamble(0),
  ...header(0, 4),
  ...row(0, 5, '01/10/26', 'NEFT CR-ICIC0000001-ACME CORP-SALARY OCT', '0000412345678901', '', '75,000.00', '85,000.00'),
  ...row(0, 6, '02/10/26', 'UPI-SWIGGY LIMITED-SWIGGYUPI@AXISBANK-UTIB0000100-', '0000427512345601', '486.00', '', '84,514.00'),
  at(0, 6.7, COLS.narration, '427512345601-PAYMENT'),
  at(0, 9, 30, 'Page 1 of 2'),
  ...preamble(1),
  ...header(1, 4),
  ...row(1, 5, '03/10/26', 'ATW-416021XXXXXX1234-S1ANBG12-BANGALORE', '0000000000001234', '2,000.00', '', '82,514.00'),
  at(1, 9, 30, 'Page 2 of 2'),
];

describe('layoutPdfText', () => {
  const sheet = layoutPdfText(ITEMS);
  const adapter = pickStatementAdapter(sheet);

  it('rebuilds a table the HDFC adapter reads', () => {
    expect(adapter?.id).toBe('hdfc');
  });

  it('puts right-aligned amounts under their own heading and joins a wrapped narration', () => {
    const parsed = adapter!.parse(sheet);
    expect(parsed.accountLast4).toBe('6789');
    expect(parsed.rows).toHaveLength(3);
    expect(parsed.rows[0]).toMatchObject({ date: '2026-10-01', amountPaise: 7_500_000, direction: 'credit', balancePaise: 8_500_000 });
    expect(parsed.rows[1]).toMatchObject({
      date: '2026-10-02',
      amountPaise: 48_600,
      direction: 'debit',
      counterparty: 'Swiggy Limited',
      referenceNo: '427512345601',
    });
    expect(parsed.rows[1]!.narration).toContain('427512345601-PAYMENT');
    expect(parsed.rows[2]).toMatchObject({ date: '2026-10-03', amountPaise: 200_000, direction: 'debit', counterparty: 'ATM withdrawal' });
  });

  it('drops the repeated header, page furniture and page marks', () => {
    const parsed = adapter!.parse(sheet);
    expect(parsed.skipped).toBe(0);
    expect(balanceBreaks(parsed.rows)).toEqual([]);
    expect(sheet.flat().join(' ')).not.toMatch(/Page \d of/);
  });

  it('keeps multi-word headings as one cell', () => {
    expect(sheet.find((r) => r.includes('Narration'))).toEqual(['Date', 'Narration', 'Chq./Ref.No.', 'Value Dt', 'Withdrawal Amt.', 'Deposit Amt.', 'Closing Balance']);
  });

  it('returns plain lines when no header exists, so no adapter matches', () => {
    const plain = layoutPdfText([at(0, 1, 2, 'Dear customer'), at(0, 2, 2, 'Your statement is attached')]);
    expect(plain).toEqual([['Dear customer'], ['Your statement is attached']]);
    expect(pickStatementAdapter(plain)).toBeUndefined();
  });

  it('returns nothing for a PDF with no text (a scan)', () => {
    expect(layoutPdfText([])).toEqual([]);
  });

  it('splits an amount the extractor merged into the cell before it', () => {
    const merged = 'TRANSFER TO 4897 1,842.00';
    const items = [
      ...header(0, 5),
      at(0, 6, COLS.date, '18/10/26'),
      at(0, 6, COLS.narration, 'UPI-BESCOM-429112345683-BILL'),
      // Starts under Chq./Ref.No. and ends flush right under Withdrawal Amt.
      at(0, 6, EDGE.withdrawal - merged.length * W, merged),
      right(0, 6, EDGE.balance, '95,022.00'),
    ];
    const sheet = layoutPdfText(items);
    const rows = pickStatementAdapter(sheet)!.parse(sheet).rows;
    expect(rows[0]).toMatchObject({ amountPaise: 184_200, direction: 'debit', balancePaise: 9_502_200 });
  });

  it('leaves a long narration that runs into the next column whole', () => {
    const items = [
      ...header(0, 5),
      at(0, 6, COLS.date, '18/10/26'),
      at(0, 6, COLS.narration, 'ATM WDL-ATM CASH 15523 MG ROAD BANGALORE 560001.00'),
      right(0, 6, EDGE.withdrawal, '5,000.00'),
      right(0, 6, EDGE.balance, '90,022.00'),
    ];
    const sheet = layoutPdfText(items);
    expect(sheet[sheet.length - 1]![1]).toBe('ATM WDL-ATM CASH 15523 MG ROAD BANGALORE 560001.00');
  });
});

