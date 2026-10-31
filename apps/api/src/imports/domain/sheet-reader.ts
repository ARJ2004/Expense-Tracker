import ExcelJS from 'exceljs';
import Papa from 'papaparse';
import type { Sheet } from '@et/parsers';
import { PdfError, readPdf, type PdfFailure } from './pdf-reader';

/** More rows than any monthly or yearly personal statement; guards against oversized sheets. */
export const MAX_SHEET_ROWS = 20_000;

export class SheetError extends Error {
  constructor(readonly code: 'IMPORT_UNREADABLE' | 'IMPORT_TOO_MANY_ROWS' | PdfFailure) {
    super(code);
  }
}

/**
 * Every cell as text. CSV via papaparse (any delimiter); XLSX via exceljs, cell values only; PDF
 * via its text layer, laid back out into columns (the password opens an encrypted PDF).
 */
export async function readSheet(bytes: Buffer, format: 'csv' | 'xlsx' | 'pdf', password?: string): Promise<Sheet> {
  const sheet = format === 'csv' ? readCsv(bytes) : format === 'xlsx' ? await readXlsx(bytes) : await readPdfSheet(bytes, password);
  if (sheet.length > MAX_SHEET_ROWS) throw new SheetError('IMPORT_TOO_MANY_ROWS');
  return sheet;
}

async function readPdfSheet(bytes: Buffer, password?: string): Promise<Sheet> {
  try {
    return await readPdf(bytes, password);
  } catch (e) {
    throw e instanceof PdfError ? new SheetError(e.code) : e;
  }
}

function readCsv(bytes: Buffer): Sheet {
  const text = bytes.toString('utf8').replace(/^\uFEFF/, '');
  const parsed = Papa.parse<string[]>(text, { skipEmptyLines: false, preview: MAX_SHEET_ROWS + 1 });
  if (parsed.data.length === 0) throw new SheetError('IMPORT_UNREADABLE');
  return parsed.data.map((row) => row.map((c) => c ?? ''));
}

async function readXlsx(bytes: Buffer): Promise<Sheet> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(bytes as unknown as ArrayBuffer);
  } catch {
    throw new SheetError('IMPORT_UNREADABLE');
  }
  // The statement is the worksheet with the most rows (some banks add a cover sheet).
  const worksheet = [...workbook.worksheets].sort((a, b) => b.rowCount - a.rowCount)[0];
  if (!worksheet || worksheet.rowCount === 0) throw new SheetError('IMPORT_UNREADABLE');
  if (worksheet.rowCount > MAX_SHEET_ROWS) throw new SheetError('IMPORT_TOO_MANY_ROWS');
  const sheet: Sheet = [];
  for (let r = 1; r <= worksheet.rowCount; r++) {
    const row = worksheet.getRow(r);
    const cells: string[] = [];
    for (let c = 1; c <= row.cellCount; c++) cells.push(cellText(row.getCell(c).value));
    sheet.push(cells);
  }
  return sheet;
}

/** A cell's stored value as text. Formulas are never evaluated: their cached result is used. */
function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '');
  if (typeof value === 'string' || typeof value === 'boolean') return String(value);
  if ('richText' in value) return value.richText.map((t) => t.text).join('');
  if ('result' in value) return value.result === undefined ? '' : cellText(value.result as ExcelJS.CellValue);
  if ('text' in value) return String(value.text);
  return '';
}
