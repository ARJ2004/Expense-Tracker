import { cell } from './cells';
import { mapColumns, type ColumnMap } from './table';
import type { Sheet } from './types';

/**
 * One run of text on a PDF page, as a PDF text extractor reports it. Positions are in any one
 * unit (the API's reader uses pdf2json's page units), top-left origin: y grows down the page.
 */
export interface PdfTextItem {
  /** 0-based page number. */
  page: number;
  x: number;
  y: number;
  /** Rendered width in the same unit as x; 0 when unknown. */
  width: number;
  text: string;
}

export interface PdfLayoutOptions {
  /** Items whose y differ by at most this sit on one line. */
  lineTolerance?: number;
  /** Items on a line closer than this are one cell ("Withdrawal" + "Amt." → "Withdrawal Amt."). */
  joinGap?: number;
}

interface Span {
  start: number;
  end: number;
  text: string;
}

interface Line {
  page: number;
  /** Raw items, left to right. */
  items: Span[];
  /** Items joined into cells by proximity. */
  runs: Span[];
}

const DEFAULTS: Required<PdfLayoutOptions> = { lineTolerance: 0.3, joinGap: 0.25 };
/** A statement amount as banks print it: always two decimals, maybe "Cr" / "Dr". */
const AMOUNT_WORD = /^-?[\d,]+\.\d{2}(Cr|Dr)?$/i;
const PAGE_MARK = /^(page\s*)?\d+\s*(of|\/)\s*\d+$|^page\s*\d+$/i;

/**
 * Rebuilds the statement table from positioned PDF text, so the same StatementAdapters that read
 * CSV and XLSX read PDFs too. Text is grouped into lines by y; the first line that names a date,
 * a narration and an amount column is the header, and every later item goes to the header
 * column it overlaps most (amounts are usually right-aligned under their heading). A text
 * extractor may merge a cell with the amount right after it ("TRANSFER TO 4897 1,842.00"); when
 * such a run ends inside an amount column, its trailing amounts go to that column. Lines above
 * the header stay as plain cells for the preamble (account number). On later pages, a repeated
 * header and everything above it, and "Page 2 of 5" marks, are dropped.
 *
 * Returns plain lines (no columns) when no header is found; the adapters then find nothing and
 * the import fails as unreadable.
 */
export function layoutPdfText(items: readonly PdfTextItem[], options: PdfLayoutOptions = {}): Sheet {
  const { lineTolerance, joinGap } = { ...DEFAULTS, ...options };
  const lines = toLines(items, lineTolerance, joinGap);
  const headerAt = lines.findIndex((l) => mapColumns(l.runs.map((r) => r.text)) !== null);
  if (headerAt < 0) return lines.map((l) => l.runs.map((r) => r.text));

  const header = lines[headerAt]!.runs;
  const columns = mapColumns(header.map((r) => r.text))!;
  const amountColumns = new Set(amountColumnsOf(columns));
  const headerKey = textKey(header);
  const headerPage = lines[headerAt]!.page;
  // Pages after the first that repeat the header: everything above that repeat is page furniture.
  const repeatAt = new Map<number, number>();
  lines.forEach((l, i) => {
    if (i > headerAt && l.page !== headerPage && !repeatAt.has(l.page) && textKey(l.runs) === headerKey) repeatAt.set(l.page, i);
  });

  const sheet: Sheet = lines.slice(0, headerAt).map((l) => l.runs.map((r) => r.text));
  sheet.push(header.map((r) => r.text));
  for (let i = headerAt + 1; i < lines.length; i++) {
    const line = lines[i]!;
    const repeat = repeatAt.get(line.page);
    if (repeat !== undefined && i <= repeat) continue;
    if (PAGE_MARK.test(line.runs.map((r) => r.text).join(' '))) continue;
    const perColumn: Span[][] = header.map(() => []);
    for (const item of line.items) for (const [span, column] of place(item, header, amountColumns)) perColumn[column]!.push(span);
    sheet.push(perColumn.map((spans) => joinSpans(spans, joinGap).map((s) => s.text).join(' ')));
  }
  return sheet;
}

function amountColumnsOf(c: ColumnMap): number[] {
  return [c.debit, c.credit, c.amount, c.balance].filter((i): i is number => i !== undefined);
}

/**
 * The column(s) an item goes to. Normally one; an item that starts in one column and ends in an
 * amount column with amounts as its last words is split, the words placed by their share of the
 * item's characters and the last amount in the column where the item ends (its right edge is exact).
 */
function place(item: Span, header: readonly Span[], amountColumns: ReadonlySet<number>): [Span, number][] {
  const column = columnFor(item, header);
  if (item.end <= item.start) return [[item, column]];
  // Columns of the left and right edges alone (a zero-width span goes where its edge falls).
  const startColumn = columnFor({ ...item, end: item.start }, header);
  const endColumn = columnFor({ ...item, start: item.end - 0.01, end: item.end - 0.01 }, header);
  if (endColumn === startColumn || !amountColumns.has(endColumn)) return [[item, column]];
  const words = item.text.split(' ');
  let keep = words.length;
  while (keep > 1 && AMOUNT_WORD.test(words[keep - 1]!)) keep--;
  if (keep === words.length) return [[item, column]];

  const perChar = (item.end - item.start) / item.text.length;
  const at = (from: number, text: string): Span => ({ start: item.start + from * perChar, end: item.start + (from + text.length) * perChar, text });
  const head = words.slice(0, keep).join(' ');
  const out: [Span, number][] = [[at(0, head), columnFor(at(0, head), header)]];
  let offset = head.length + 1;
  words.slice(keep).forEach((word, i, tail) => {
    const span = at(offset, word);
    out.push([span, i === tail.length - 1 ? endColumn : columnFor(span, header)]);
    offset += word.length + 1;
  });
  return out;
}

function textKey(runs: readonly Span[]): string {
  return runs.map((r) => r.text.toLowerCase()).join('|');
}

function toLines(items: readonly PdfTextItem[], tolerance: number, joinGap: number): Line[] {
  const sorted = items
    .map((i) => ({ ...i, text: cell(i.text) }))
    .filter((i) => i.text !== '')
    .sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x);
  const groups: { page: number; y: number; items: Span[] }[] = [];
  for (const item of sorted) {
    const span = { start: item.x, end: item.x + Math.max(0, item.width || 0), text: item.text };
    const last = groups[groups.length - 1];
    if (last && last.page === item.page && item.y - last.y <= tolerance) last.items.push(span);
    else groups.push({ page: item.page, y: item.y, items: [span] });
  }
  return groups.map((g) => {
    const lineItems = [...g.items].sort((a, b) => a.start - b.start);
    return { page: g.page, items: lineItems, runs: joinSpans(lineItems, joinGap) };
  });
}

/** Left to right, joining spans that nearly touch; a space goes between words, not inside one. */
function joinSpans(spans: readonly Span[], joinGap: number): Span[] {
  const out: Span[] = [];
  for (const s of spans) {
    const prev = out[out.length - 1];
    const gap = prev ? s.start - prev.end : Infinity;
    if (prev && prev.end > prev.start && gap <= joinGap) {
      prev.text = `${prev.text}${gap > joinGap / 4 ? ' ' : ''}${s.text}`;
      prev.end = Math.max(prev.end, s.end);
    } else {
      out.push({ ...s });
    }
  }
  return out;
}

/**
 * Column i spans from its heading's left edge to the next heading's left edge. An item goes to
 * the column it overlaps most; an item with no width goes to the column its left edge falls in.
 */
function columnFor(item: Span, header: readonly Span[]): number {
  const spans = header.map((h, i) => ({ from: i === 0 ? -Infinity : h.start, to: i + 1 < header.length ? header[i + 1]!.start : Infinity }));
  if (item.end > item.start) {
    let best = -1;
    let bestOverlap = 0;
    spans.forEach((s, i) => {
      const overlap = Math.min(item.end, s.to) - Math.max(item.start, s.from);
      if (overlap > bestOverlap) {
        best = i;
        bestOverlap = overlap;
      }
    });
    if (best >= 0) return best;
  }
  const i = spans.findIndex((s) => item.start >= s.from && item.start < s.to);
  return i >= 0 ? i : header.length - 1;
}
