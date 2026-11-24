import { memberNameKey, netBalances, simplifyDebts, splitEqually, validateExactSplit, type BalanceExpense } from './groups';

describe('splitEqually', () => {
  it('gives leftover paise to the first members so shares add up exactly', () => {
    expect(splitEqually(100_00, ['a', 'b', 'c'])).toEqual([
      { memberId: 'a', sharePaise: 3334 },
      { memberId: 'b', sharePaise: 3333 },
      { memberId: 'c', sharePaise: 3333 },
    ]);
    expect(splitEqually(1, ['a', 'b', 'c']).map((s) => s.sharePaise)).toEqual([1, 0, 0]);
    expect(splitEqually(3600_00, ['a', 'b', 'c', 'd']).map((s) => s.sharePaise)).toEqual([900_00, 900_00, 900_00, 900_00]);
  });

  it('always sums to the amount', () => {
    for (let amount = 0; amount < 2000; amount += 7) {
      for (let n = 1; n <= 12; n++) {
        const ids = Array.from({ length: n }, (_, i) => `m${i}`);
        const shares = splitEqually(amount, ids);
        expect(shares.reduce((s, x) => s + x.sharePaise, 0)).toBe(amount);
        expect(Math.max(...shares.map((s) => s.sharePaise)) - Math.min(...shares.map((s) => s.sharePaise))).toBeLessThanOrEqual(1);
      }
    }
  });

  it('refuses no members and bad amounts', () => {
    expect(() => splitEqually(100, [])).toThrow(RangeError);
    expect(() => splitEqually(1.5, ['a'])).toThrow(RangeError);
  });
});

describe('validateExactSplit', () => {
  it('says how much is left or over', () => {
    expect(validateExactSplit(1800_00, [{ memberId: 'a', sharePaise: 1800_00 }])).toEqual({ ok: true });
    expect(
      validateExactSplit(1800_00, [
        { memberId: 'a', sharePaise: 600_00 },
        { memberId: 'b', sharePaise: 600_00 },
        { memberId: 'c', sharePaise: 480_00 },
      ]),
    ).toEqual({ ok: false, diffPaise: 120_00 });
    expect(validateExactSplit(100, [{ memberId: 'a', sharePaise: 115 }])).toEqual({ ok: false, diffPaise: -15 });
  });
});

describe('netBalances and simplifyDebts', () => {
  const members = ['you', 'ravi', 'priya', 'arjun'];
  const dinner: BalanceExpense = {
    paidById: 'priya',
    amountPaise: 3600_00,
    shares: members.map((memberId) => ({ memberId, sharePaise: 900_00 })),
  };
  const cab: BalanceExpense = {
    paidById: 'you',
    amountPaise: 1200_00,
    shares: [
      { memberId: 'you', sharePaise: 600_00 },
      { memberId: 'ravi', sharePaise: 600_00 },
    ],
  };

  it('works out the Goa trip example from the design doc', () => {
    const net = netBalances(members, [dinner, cab], []);
    expect(Object.fromEntries(net)).toEqual({ you: -300_00, ravi: -1500_00, priya: 2700_00, arjun: -900_00 });
    expect(simplifyDebts(net)).toEqual([
      { fromId: 'ravi', toId: 'priya', amountPaise: 1500_00 },
      { fromId: 'arjun', toId: 'priya', amountPaise: 900_00 },
      { fromId: 'you', toId: 'priya', amountPaise: 300_00 },
    ]);
  });

  it('counts payments, and settles to nothing to pay', () => {
    const net = netBalances(members, [dinner, cab], [
      { fromId: 'ravi', toId: 'priya', amountPaise: 1500_00 },
      { fromId: 'arjun', toId: 'priya', amountPaise: 900_00 },
      { fromId: 'you', toId: 'priya', amountPaise: 300_00 },
    ]);
    expect([...net.values()].every((v) => v === 0)).toBe(true);
    expect(simplifyDebts(net)).toEqual([]);
  });

  it('always sums to 0 and settles everyone in at most n − 1 payments', () => {
    let seed = 7;
    const rand = (n: number) => {
      seed = (seed * 1103515245 + 12345) % 2 ** 31;
      return seed % n;
    };
    for (let round = 0; round < 200; round++) {
      const n = 2 + rand(8);
      const ids = Array.from({ length: n }, (_, i) => `m${i}`);
      const expenses: BalanceExpense[] = Array.from({ length: 1 + rand(6) }, () => {
        const sharers = ids.filter(() => rand(2) === 0);
        const amount = 1 + rand(500_000);
        return { paidById: ids[rand(n)] as string, amountPaise: amount, shares: splitEqually(amount, sharers.length ? sharers : ids) };
      });
      const net = netBalances(ids, expenses, []);
      expect([...net.values()].reduce((a, b) => a + b, 0)).toBe(0);
      const transfers = simplifyDebts(net);
      expect(transfers.length).toBeLessThanOrEqual(n - 1);
      const after = netBalances(ids, expenses, transfers);
      expect([...after.values()].every((v) => v === 0)).toBe(true);
    }
  });
});

describe('memberNameKey', () => {
  it('ignores case and extra spaces', () => {
    expect(memberNameKey('  Ravi   Kumar ')).toBe('ravi kumar');
  });
});
