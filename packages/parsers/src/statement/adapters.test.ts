import { pickStatementAdapter } from './adapters';
import type { Sheet } from './types';

describe('bank adapters', () => {
  it('reads the ICICI emailed statement layout and drops the B/F line', () => {
    const sheet: Sheet = [
      ['ICICI Bank Limited'],
      ['Account Number XXXXXXXX4567'],
      ['DATE', 'MODE**', 'PARTICULARS', 'DEPOSITS', 'WITHDRAWALS', 'BALANCE'],
      ['01-10-2026', '', 'B/F', '', '', '15,200.00'],
      ['02-10-2026', '', 'UPI/ZOMATO LTD/zomato-order@ptybl/Pay/PAYTM/427712345602/ICI2c7e', '', '612.00', '14,588.00'],
      ['03-10-2026', '', 'NEFT-SBIN0001234-ACME SOFTWARE PVT LTD-SALARY', '92,000.00', '', '1,06,588.00'],
      ['TOTAL', '', '', '92,000.00', '612.00', ''],
    ];
    const adapter = pickStatementAdapter(sheet);
    expect(adapter?.id).toBe('icici');
    expect(adapter!.parse(sheet)).toMatchObject({
      bank: 'ICICI Bank',
      accountLast4: '4567',
      skipped: 0,
      rows: [
        { date: '2026-10-02', amountPaise: 61_200, direction: 'debit', counterparty: 'Zomato Ltd' },
        { date: '2026-10-03', amountPaise: 9_200_000, direction: 'credit', counterparty: 'Acme Software Pvt Ltd' },
      ],
    });
  });

  it('leaves an SBI-shaped table from another bank to the generic adapter', () => {
    const sheet: Sheet = [
      ['Account Number : 1234567890'],
      ['Txn Date', 'Value Date', 'Description', 'Ref No./Cheque No.', 'Debit', 'Credit', 'Balance'],
      ['1 Oct 2026', '1 Oct 2026', 'CREDIT INTEREST', '', '', '312.00', '10,312.00'],
    ];
    expect(pickStatementAdapter(sheet)?.id).toBe('generic');
  });
});
