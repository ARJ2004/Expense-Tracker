import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Builds small, valid PDFs for tests: one page per entry, each text placed at (x, y) in PDF
 * points (origin bottom-left, as PDF content streams use). Helvetica 9 pt.
 */
export type PdfLine = readonly [x: number, y: number, text: string];

export function makePdf(pages: readonly (readonly PdfLine[])[]): Buffer {
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const objects: string[] = [];
  const add = (body: string) => objects.push(body) - 1 + 1; // 1-based object number
  const catalog = add('');
  const pagesObj = add('');
  const font = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const kids: number[] = [];
  for (const lines of pages) {
    const content = lines.map(([x, y, t]) => `BT /F1 9 Tf ${x} ${y} Td (${esc(t)}) Tj ET`).join('\n');
    const stream = add(`<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`);
    kids.push(
      add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 700 842] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${stream} 0 R >>`),
    );
  }
  objects[catalog - 1] = `<< /Type /Catalog /Pages ${pagesObj} 0 R >>`;
  objects[pagesObj - 1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`;

  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(out, 'latin1'));
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

/** Points from the left edge per character of Helvetica 9 pt (roughly). */
const CHAR = 4.6;

/** A statement column: its heading's left edge, and the right edge when values are right-aligned. */
export interface PdfColumn {
  title: string;
  x: number;
  right?: number;
}

/** A statement page: preamble lines, the header, then one line per row (cells in column order). */
export function statementPdf(preamble: readonly string[], columns: readonly PdfColumn[], rows: readonly (readonly string[])[]): Buffer {
  const lines: PdfLine[] = preamble.map((text, i) => [30, 800 - i * 15, text] as const);
  const headerY = 790 - preamble.length * 15;
  columns.forEach((c) => lines.push([c.x, headerY, c.title]));
  rows.forEach((cells, i) => {
    const y = headerY - 20 - i * 14;
    cells.forEach((text, j) => {
      const c = columns[j]!;
      if (text) lines.push([c.right === undefined ? c.x : c.right - text.length * CHAR, y, text]);
    });
  });
  return makePdf([lines]);
}

/**
 * An HDFC-style statement page: preamble, header, then rows with amounts right-aligned under
 * their headings. Rows are [date, narration, ref, withdrawal, deposit, balance].
 */
export function hdfcStatementPdf(rows: readonly (readonly [string, string, string, string, string, string])[]): Buffer {
  return statementPdf(
    ['HDFC BANK LIMITED', 'Account No :50100012346789'],
    [
      { title: 'Date', x: 30 },
      { title: 'Narration', x: 80 },
      { title: 'Chq./Ref.No.', x: 300 },
      { title: 'Value Dt', x: 385 },
      { title: 'Withdrawal Amt.', x: 440, right: 520 },
      { title: 'Deposit Amt.', x: 530, right: 590 },
      { title: 'Closing Balance', x: 600, right: 680 },
    ],
    rows.map(([date, narration, ref, debit, credit, balance]) => [date, narration, ref, date, debit, credit, balance]),
  );
}

/** An Axis-style page (Tran Date | CHQNO | PARTICULARS | DR | CR | BAL); rows are [date, particulars, dr, cr, bal]. */
export function axisStatementPdf(rows: readonly (readonly [string, string, string, string, string])[]): Buffer {
  return statementPdf(
    ['Name :- DEMO USER', 'Statement of Account No - 912010012345678 for the period (From : 01-10-2026 To : 31-10-2026)'],
    [
      { title: 'Tran Date', x: 30 },
      { title: 'CHQNO', x: 90 },
      { title: 'PARTICULARS', x: 140 },
      { title: 'DR', x: 460, right: 520 },
      { title: 'CR', x: 530, right: 590 },
      { title: 'BAL', x: 600, right: 680 },
    ],
    [['', '', 'OPENING BALANCE', '', '', '18,100.00'], ...rows.map(([date, particulars, dr, cr, bal]) => [date, '', particulars, dr, cr, bal])],
  );
}

/**
 * The two-row statement from ENCRYPTED_ROWS, encrypted by pypdf: AES-256 with a user password,
 * and AES-128 with only an owner password (opens without one). Regenerate with
 * hdfcStatementPdf(ENCRYPTED_ROWS) and pypdf's PdfWriter.encrypt.
 */
export const ENCRYPTED_PASSWORD = 'demo1234';
export const ENCRYPTED_ROWS = [
  ['01/10/26', 'NEFT CR-ICIC0000001-ACME CORP-SALARY OCT', '0000412345678901', '', '75,000.00', '85,000.00'],
  ['02/10/26', 'UPI-SWIGGY LIMITED-SWIGGYUPI@AXISBANK-427512345601-PAYMENT', '0000427512345601', '486.00', '', '84,514.00'],
] as const;
export const encryptedPdf = (kind: 'aes256' | 'owner-only'): Buffer => readFileSync(join(__dirname, 'fixtures', `hdfc-statement.${kind}.pdf`));
