import { isMonthKey, istMonthKey, istMonthRange, monthLabel, shiftMonth } from './months';

describe('IST months', () => {
  it('puts 31 Oct 23:30 IST in October and 1 Nov 00:10 IST in November', () => {
    expect(istMonthKey(new Date('2026-10-31T18:00:00Z'))).toBe('2026-10');
    expect(istMonthKey(new Date('2026-10-31T18:40:00Z'))).toBe('2026-11');
  });

  it('gives the UTC range of an IST month', () => {
    expect(istMonthRange('2026-10')).toEqual({ start: new Date('2026-09-30T18:30:00Z'), end: new Date('2026-10-31T18:30:00Z') });
    expect(istMonthRange('2026-12').end).toEqual(new Date('2026-12-31T18:30:00Z'));
  });

  it('shifts across years', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
  });

  it('validates and labels', () => {
    expect(isMonthKey('2026-10')).toBe(true);
    expect(isMonthKey('2026-13')).toBe(false);
    expect(isMonthKey('2026-1')).toBe(false);
    expect(monthLabel('2026-10', 2026)).toBe('October');
    expect(monthLabel('2025-12', 2026)).toBe('December 2025');
  });
});
