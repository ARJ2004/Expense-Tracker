import { EqualSplit, ExactSplit, SPLIT_STRATEGIES } from './split-strategies';

const order = ['you', 'ravi', 'priya'];

describe('split strategies', () => {
  it('registers one strategy per mode', () => {
    expect(SPLIT_STRATEGIES.map((s) => s.mode)).toEqual(['equal', 'exact']);
  });

  it('equal: splits in member order whatever order the request used', () => {
    expect(new EqualSplit().compute({ amountPaise: 100_00, memberOrder: order, memberIds: ['priya', 'you'] })).toEqual({
      ok: true,
      shares: [
        { memberId: 'you', sharePaise: 5000 },
        { memberId: 'priya', sharePaise: 5000 },
      ],
    });
  });

  it('equal: refuses nobody, duplicates and strangers', () => {
    const equal = new EqualSplit();
    expect(equal.compute({ amountPaise: 100, memberOrder: order, memberIds: [] })).toMatchObject({ ok: false, code: 'VALIDATION_FAILED' });
    expect(equal.compute({ amountPaise: 100, memberOrder: order, memberIds: ['you', 'you'] })).toMatchObject({ ok: false });
    expect(equal.compute({ amountPaise: 100, memberOrder: order, memberIds: ['eve'] })).toMatchObject({ ok: false, code: 'GROUP_UNKNOWN_MEMBER' });
  });

  it('exact: keeps non-zero shares in member order, and refuses a total that does not match', () => {
    const exact = new ExactSplit();
    const shares = [
      { memberId: 'priya', sharePaise: 300 },
      { memberId: 'ravi', sharePaise: 0 },
      { memberId: 'you', sharePaise: 700 },
    ];
    expect(exact.compute({ amountPaise: 1000, memberOrder: order, shares })).toEqual({
      ok: true,
      shares: [
        { memberId: 'you', sharePaise: 700 },
        { memberId: 'priya', sharePaise: 300 },
      ],
    });
    expect(exact.compute({ amountPaise: 1200, memberOrder: order, shares })).toMatchObject({ ok: false, code: 'GROUP_SPLIT_MISMATCH' });
  });
});
