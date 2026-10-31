import { parseAmount, parseDate } from './cells';
import { balanceBreaks } from './balance';
import { parseNarration } from './narration';
import { mapColumns } from './table';

describe('parseAmount', () => {
  it.each([
    ['1,23,456.78', { paise: 12345678 }],
    ['₹ 486', { paise: 48600 }],
    ['486.5 Dr', { paise: 48650, side: 'debit' }],
    ['18,766.00 CR', { paise: 1876600, side: 'credit' }],
    ['(1,200.00)', { paise: 120000, side: 'debit' }],
    ['-75.25', { paise: 7525, side: 'debit' }],
    ['1.2345E3', { paise: 123450 }],
    ['0.1', { paise: 10 }],
    ['10.999', { paise: 1099 }],
  ])('%s', (raw, expected) => expect(parseAmount(raw)).toEqual(expected));

  it.each(['', '-', '0.00', 'abc', '12.3.4'])('rejects %p', (raw) => expect(parseAmount(raw)).toBeNull());
});

describe('parseDate', () => {
  it.each([
    ['31/10/26', '2026-10-31'],
    ['01-10-2026', '2026-10-01'],
    ['31-Oct-2026', '2026-10-31'],
    ['5 Oct 26', '2026-10-05'],
    ['2026-10-31', '2026-10-31'],
    ['2026-10-31T00:00:00.000Z', '2026-10-31'],
    ['46326', '2026-10-31'],
  ])('%s', (raw, expected) => expect(parseDate(raw)).toBe(expected));

  it.each(['', '31/02/26', '13/13/2026', 'Opening Balance'])('rejects %p', (raw) => expect(parseDate(raw)).toBeNull());
});

describe('parseNarration', () => {
  it('reads HDFC UPI', () => {
    expect(parseNarration('UPI-SWIGGY LIMITED-SWIGGYUPI@AXISBANK-UTIB0000100-427512345678-PAYMENT')).toEqual({
      counterparty: 'Swiggy Limited',
      referenceNo: '427512345678',
    });
  });
  it('reads slash UPI', () => {
    expect(parseNarration('UPI/412345678901/SWIGGY/swiggy@icici/Payment')).toEqual({ counterparty: 'Swiggy', referenceNo: '412345678901' });
  });
  it('reads NEFT credit', () => {
    expect(parseNarration('NEFT CR-HDFC0000001-ACME CORP PVT LTD-SALARY OCT-N123456789').counterparty).toBe('Acme Corp Pvt Ltd');
  });
  it('reads ATM', () => expect(parseNarration('NWD-416021XXXXXX1234-S1ANBG12-BLR').counterparty).toBe('ATM withdrawal'));
  it('keeps other text', () => expect(parseNarration('CREDIT INTEREST').counterparty).toBe('Credit Interest'));
});

describe('mapColumns', () => {
  it('needs date, narration and an amount', () => {
    expect(mapColumns(['Date', 'Narration', 'Closing Balance'])).toBeNull();
    expect(mapColumns(['Txn Date', 'Particulars', 'Debit', 'Credit', 'Balance'])).toMatchObject({ date: 0, narration: 1, debit: 2, credit: 3, balance: 4 });
  });
  it('does not take value date as the date', () => {
    expect(mapColumns(['Value Date', 'Txn Date', 'Description', 'Amount', 'Dr/Cr'])).toMatchObject({ date: 1, amount: 3, drCr: 4 });
  });
});

describe('balanceBreaks', () => {
  const row = (rowNo: number, amountPaise: number, direction: 'debit' | 'credit', balancePaise: number) => ({ rowNo, date: '2026-10-01', amountPaise, direction, narration: '', balancePaise });
  it('accepts oldest-first and newest-first', () => {
    const rows = [row(1, 100, 'debit', 900), row(2, 50, 'credit', 950)];
    expect(balanceBreaks(rows)).toEqual([]);
    expect(balanceBreaks([...rows].reverse().map((r, i) => ({ ...r, rowNo: i + 1 })))).toEqual([]);
  });
  it('reports a break', () => {
    expect(balanceBreaks([row(1, 100, 'debit', 900), row(2, 50, 'credit', 999), row(3, 9, 'debit', 990)])).toEqual([2]);
  });
});
