import type { ExportRow } from '../../ingest';
import { csvHeader, csvLine, EXPORT_COLUMNS } from './export-csv';

function row(overrides: Partial<ExportRow> = {}): ExportRow {
  return {
    // 2026-10-31 18:30 UTC = 2026-11-01 00:00 IST, so the IST day rolls to the 1st.
    occurredAt: new Date('2026-10-20T06:30:00.000Z'),
    amountPaise: 123456,
    direction: 'debit',
    type: 'expense',
    category: 'Food & Dining',
    merchantName: 'Swiggy',
    account: 'HDFC Bank ••4821',
    note: null,
    sources: ['statement'],
    ...overrides,
  };
}

describe('export-csv', () => {
  it('writes the header row in column order, CRLF-terminated', () => {
    expect(csvHeader()).toBe(EXPORT_COLUMNS.join(',') + '\r\n');
  });

  it('formats paise as a plain rupee string with two decimals, no symbol or grouping', () => {
    expect(csvLine(row({ amountPaise: 123456 }))).toContain(',1234.56,');
    expect(csvLine(row({ amountPaise: 5 }))).toContain(',0.05,');
    expect(csvLine(row({ amountPaise: 100000000 }))).toContain(',1000000.00,');
  });

  it('keeps a sign for negative amounts (e.g. a correction) without a float divide', () => {
    expect(csvLine(row({ amountPaise: -2550 }))).toContain(',-25.50,');
  });

  it('uses the IST calendar day', () => {
    // 20:00 UTC on the 20th is 01:30 IST on the 21st.
    expect(csvLine(row({ occurredAt: new Date('2026-10-20T20:00:00.000Z') }))).toMatch(/^2026-10-21,/);
  });

  it('quotes fields containing commas or quotes and doubles inner quotes', () => {
    const line = csvLine(row({ merchantName: 'Patel, Sons "Grocers"' }));
    expect(line).toContain('"Patel, Sons ""Grocers"""');
  });

  it('leaves blanks for null merchant, account and note', () => {
    const line = csvLine(row({ merchantName: null, account: null, note: null, sources: [] }));
    // date,amount,debit,expense,category,,,, then empty sources
    expect(line).toBe('2026-10-20,1234.56,debit,expense,Food & Dining,,,,\r\n');
  });

  it('joins multiple sources with a pipe', () => {
    expect(csvLine(row({ sources: ['sms', 'statement'] }))).toContain(',sms|statement\r\n');
  });
});
