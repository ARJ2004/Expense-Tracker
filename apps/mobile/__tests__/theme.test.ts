import { altusDark, altusLight } from '../src/theme';

describe('Altus tokens', () => {
  it('light and dark define exactly the same keys', () => {
    expect(Object.keys(altusDark).sort()).toEqual(Object.keys(altusLight).sort());
  });

  it('keeps emerald text off light backgrounds', () => {
    expect(altusLight.accent).not.toBe('#2ECC71');
    expect(altusLight.income).not.toBe('#2ECC71');
  });
});
