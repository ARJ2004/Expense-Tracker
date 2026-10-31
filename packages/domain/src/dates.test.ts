import { formatISTTime, istDateKey } from './dates';

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
