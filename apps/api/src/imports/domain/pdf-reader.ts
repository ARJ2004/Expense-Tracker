import { layoutPdfText, type PdfTextItem, type Sheet } from '@et/parsers';
import type * as PdfJs from 'pdfjs-dist/legacy/build/pdf.mjs';

/**
 * pdf.js ships only as an ES module; Node 22.13+ loads one with require(). The require comes from
 * Node's own module builtin (not an import, which Jest would swap for its loader), so this also
 * works under Jest, which cannot load ES modules.
 */
const pdfjs = process.getBuiltinModule('node:module').createRequire(__filename)('pdfjs-dist/legacy/build/pdf.mjs') as typeof PdfJs;

/** layoutPdfText's tolerances are tuned for units of 16 pt; pdf.js reports points. */
const POINTS_PER_UNIT = 16;
/** Personal statements run to a few dozen pages; this bounds the parse job's work. */
export const MAX_PDF_PAGES = 300;
/** pdf.js PasswordResponses.INCORRECT_PASSWORD (NEED_PASSWORD is 1). */
const INCORRECT_PASSWORD = 2;

export type PdfFailure = 'IMPORT_UNREADABLE' | 'IMPORT_PASSWORD_PROTECTED' | 'IMPORT_WRONG_PASSWORD' | 'IMPORT_PDF_SCANNED' | 'IMPORT_TOO_MANY_ROWS';

export class PdfError extends Error {
  constructor(readonly code: PdfFailure) {
    super(code);
  }
}

/**
 * A text-based PDF statement as a Sheet, for the same adapters that read CSV and XLSX. Only the
 * text layer is read (no OCR): a scan has none and fails as IMPORT_PDF_SCANNED. A PDF that
 * needs a password fails as IMPORT_PASSWORD_PROTECTED without one and IMPORT_WRONG_PASSWORD with
 * the wrong one; one with only an owner password (print or copy restrictions) reads as is. The
 * bytes and the password stay in memory: nothing is written to disk or logged.
 */
export async function readPdf(bytes: Buffer, password?: string): Promise<Sheet> {
  // Cheap check before parsing: page objects visible in the file. Pages packed into compressed
  // object streams don't show here, so the page count after opening still applies.
  if (countPageObjects(bytes) > MAX_PDF_PAGES) throw new PdfError('IMPORT_TOO_MANY_ROWS');
  const task = pdfjs.getDocument({
    data: new Uint8Array(bytes),
    ...(password ? { password } : {}),
    // Text only: no font loading, no system fonts, errors only.
    disableFontFace: true,
    useSystemFonts: false,
    stopAtErrors: false,
    verbosity: 0,
  });
  try {
    let doc: PdfJs.PDFDocumentProxy;
    try {
      doc = await task.promise;
    } catch (e) {
      // pdf.js does not export PasswordException; its name and code are its contract. Not
      // instanceof Error: pdf.js may run in another realm (Jest).
      const { name, code } = (e ?? {}) as { name?: unknown; code?: unknown };
      if (name === 'PasswordException') throw new PdfError(code === INCORRECT_PASSWORD ? 'IMPORT_WRONG_PASSWORD' : 'IMPORT_PASSWORD_PROTECTED');
      throw new PdfError('IMPORT_UNREADABLE');
    }
    if (doc.numPages > MAX_PDF_PAGES) throw new PdfError('IMPORT_TOO_MANY_ROWS');
    const items: PdfTextItem[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      items.push(...pdfTextItems(n - 1, page.view[3] ?? 0, content.items));
      page.cleanup();
    }
    if (items.length === 0) throw new PdfError('IMPORT_PDF_SCANNED');
    return layoutPdfText(items);
  } catch (e) {
    throw e instanceof PdfError ? e : new PdfError('IMPORT_UNREADABLE');
  } finally {
    await task.destroy();
  }
}

/** "/Type /Page" objects (not "/Pages") written in the clear (exported for tests). */
export function countPageObjects(bytes: Buffer): number {
  return bytes.toString('latin1').match(/\/Type\s*\/Page(?![a-zA-Z])/g)?.length ?? 0;
}

type TextContentItem = Awaited<ReturnType<PdfJs.PDFPageProxy['getTextContent']>>['items'][number];

/**
 * pdf.js text runs as positioned items (exported for tests). pdf.js measures from the page's
 * bottom-left in points; layoutPdfText wants y growing down the page.
 */
export function pdfTextItems(page: number, pageHeight: number, items: readonly TextContentItem[]): PdfTextItem[] {
  return items.flatMap((item) => {
    if (!('str' in item) || item.str.trim() === '') return [];
    const [, , , , x = 0, y = 0] = item.transform as number[];
    return [
      {
        page,
        x: x / POINTS_PER_UNIT,
        y: (pageHeight - y) / POINTS_PER_UNIT,
        width: Number.isFinite(item.width) ? item.width / POINTS_PER_UNIT : 0,
        text: item.str,
      },
    ];
  });
}
