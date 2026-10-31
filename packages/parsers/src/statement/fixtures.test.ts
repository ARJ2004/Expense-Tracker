import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import Papa from 'papaparse';
import { balanceBreaks } from './balance';
import { pickStatementAdapter } from './adapters';
import type { Sheet } from './types';

/** Every fixtures/<bank>/<name>.csv has a <name>.expected.json; expected rows are checked field by field. */
const root = join(__dirname, '../../fixtures');
const cases = readdirSync(root).flatMap((bank) =>
  readdirSync(join(root, bank))
    .filter((f) => f.endsWith('.csv'))
    .map((f) => [`${bank}/${f}`, join(root, bank, f)] as const),
);

describe.each(cases)('fixture %s', (_name, path) => {
  const sheet = Papa.parse<string[]>(readFileSync(path, 'utf8'), { skipEmptyLines: false }).data as Sheet;
  const expected = JSON.parse(readFileSync(path.replace(/\.csv$/, '.expected.json'), 'utf8')) as {
    adapter: string;
    rows: Record<string, unknown>[];
  } & Record<string, unknown>;

  it('is read by the expected adapter with every row correct', () => {
    const adapter = pickStatementAdapter(sheet, path);
    expect(adapter?.id).toBe(expected.adapter);
    const parsed = adapter!.parse(sheet);
    const { rows, ...meta } = expected;
    expect(parsed).toMatchObject(meta);
    expect(parsed.rows).toHaveLength(rows.length);
    rows.forEach((row, i) => expect(parsed.rows[i]).toMatchObject(row));
  });

  it('has a running balance with no breaks', () => {
    expect(balanceBreaks(pickStatementAdapter(sheet)!.parse(sheet).rows)).toEqual([]);
  });
});
