/** What an upload is, judged from its first bytes; the file name and Content-Type are not trusted. */
export type SniffedFormat = 'csv' | 'xlsx' | 'pdf' | 'unsupported';

export function sniffFormat(bytes: Buffer): SniffedFormat {
  if (bytes.length === 0) return 'unsupported';
  if (bytes.subarray(0, 5).toString('latin1') === '%PDF-') return 'pdf';
  // ZIP local file header: XLSX (and other OOXML) files.
  if (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) return 'xlsx';
  // OLE2 compound file: legacy .xls / .doc, not supported.
  if (bytes.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))) return 'unsupported';
  return looksLikeText(bytes) ? 'csv' : 'unsupported';
}

/** UTF-8 text with no NUL bytes and few control characters in the first 4 KB. */
function looksLikeText(bytes: Buffer): boolean {
  const head = bytes.subarray(0, 4096);
  let control = 0;
  for (const b of head) {
    if (b === 0) return false;
    if (b < 0x09 || (b > 0x0d && b < 0x20)) control++;
  }
  return control <= head.length * 0.01;
}
