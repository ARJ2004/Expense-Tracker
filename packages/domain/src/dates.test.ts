import { formatISTDate, formatISTDateTime, formatISTRelative, formatISTTime, istDateKey } from './dates';

describe('IST helpers', () => {
  it('rolls over to the next day after 18:30 UTC', () => {
    expect(istDateKey(new Date('2026-10-31T18:29:00Z'))).toBe('2026-10-31');
    expect(istDateKey(new Date('2026-10-31T18:30:00Z'))).toBe('2026-11-01');
  });

  it('formats wall-clock time in IST', () => {
    expect(formatISTTime(new Date('2026-10-31T07:42:00Z'))).toBe('1:12 pm');
    expect(formatISTTime(new Date('2026-10-31T18:30:00Z'))).toBe('12:00 am');
  });
});

describe('IST date formatting', () => {
  const at = new Date('2026-10-31T07:42:00Z'); // 1:12 pm IST

  it('formats date and time in IST', () => {
    expect(formatISTDateTime(at)).toBe('31 Oct 2026, 1:12 pm');
    expect(formatISTDate(at, { year: false })).toBe('31 Oct');
  });

  it('labels today and yesterday by the IST calendar day', () => {
    const now = new Date('2026-10-31T18:00:00Z'); // 11:30 pm IST, still 31 Oct
    expect(formatISTRelative(at, now)).toBe('Today, 1:12 pm');
    expect(formatISTRelative(new Date('2026-10-30T19:00:00Z'), now)).toBe('Today, 12:30 am');
    expect(formatISTRelative(new Date('2026-10-30T12:00:00Z'), now)).toBe('Yesterday, 5:30 pm');
    expect(formatISTRelative(new Date('2026-10-28T13:10:00Z'), now)).toBe('28 Oct, 6:40 pm');
  });
});
