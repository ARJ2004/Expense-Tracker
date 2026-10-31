import ExcelJS from 'exceljs';
import { pickStatementAdapter } from '@et/parsers';
import { sniffFormat } from './file-sniff';
import { readSheet, SheetError } from './sheet-reader';

async function xlsx(rows: ExcelJS.CellValue[][], sheets: string[] = ['Statement']): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  for (const name of sheets) wb.addWorksheet(name);
  const ws = wb.getWorksheet(sheets[sheets.length - 1]!)!;
  rows.forEach((r) => ws.addRow(r));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

describe('sniffFormat', () => {
  it('reads the first bytes, not the name', async () => {
    expect(sniffFormat(Buffer.from('%PDF-1.7'))).toBe('pdf');
    expect(sniffFormat(await xlsx([['a']]))).toBe('xlsx');
    expect(sniffFormat(Buffer.from('Date,Narration\n01/10/26,UPI'))).toBe('csv');
    expect(sniffFormat(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))).toBe('unsupported');
    expect(sniffFormat(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 1, 2]))).toBe('unsupported');
    expect(sniffFormat(Buffer.alloc(0))).toBe('unsupported');
  });
});

describe('readSheet', () => {
  it('reads an XLSX statement: dates, numbers and formula results as text', async () => {
    const bytes = await xlsx(
      [
        ['Account No :50100012346789'],
        ['Date', 'Narration', 'Chq./Ref.No.', 'Value Dt', 'Withdrawal Amt.', 'Deposit Amt.', 'Closing Balance'],
        [new Date(Date.UTC(2026, 9, 2)), 'UPI-SWIGGY LIMITED-SWIGGYUPI@AXISBANK-UTIB0000100-427512345678-PAYMENT', '0000427512345678', '02/10/26', 486, null, { formula: 'G4-E3', result: 109514 }],
        [new Date(Date.UTC(2026, 9, 3)), 'NEFT CR-UTIB0000001-ACME SOFTWARE PVT LTD-SALARY', 'X', '03/10/26', null, 85000.5, 194514.5],
      ],
      ['Cover', 'Statement'],
    );
    const sheet = await readSheet(bytes, 'xlsx');
    expect(sheet[2]).toEqual(['2026-10-02', expect.stringContaining('SWIGGY'), '0000427512345678', '02/10/26', '486', '', '109514']);
    expect(sheet[3]![5]).toBe('85000.5');
    const parsed = pickStatementAdapter(sheet)!.parse(sheet);
    expect(parsed).toMatchObject({ adapter: 'hdfc', accountLast4: '6789' });
    expect(parsed.rows.map((r) => [r.date, r.amountPaise, r.direction])).toEqual([
      ['2026-10-02', 48600, 'debit'],
      ['2026-10-03', 8500050, 'credit'],
    ]);
  });

  it('strips a UTF-8 BOM and reads semicolon CSV', async () => {
    const sheet = await readSheet(Buffer.from('﻿Date;Description;Debit;Credit\n01/10/26;Tea;10;\n'), 'csv');
    expect(sheet[0]).toEqual(['Date', 'Description', 'Debit', 'Credit']);
  });

  it('refuses a broken XLSX', async () => {
    await expect(readSheet(Buffer.from('PK\u0003\u0004 not really a zip'), 'xlsx')).rejects.toBeInstanceOf(SheetError);
  });
});
