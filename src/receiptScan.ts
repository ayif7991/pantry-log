/**
 * Read a photo of a receipt and pull out candidate item lines.
 *
 * OCR runs fully in the browser via tesseract.js (loaded on demand — the
 * engine + English model are fetched from a CDN the first time a receipt is
 * scanned). The raw text is then filtered down to lines that look like
 * purchases, with prices stripped and "2 @ 1.99" style quantities folded into
 * the `xN` form that {@link parseBulkInput} understands.
 *
 * Grocery receipts abbreviate heavily, so the output is meant to be shown to
 * the user for review, not added blindly.
 */

const MAX_LINES = 60;

/** Words that mark a line as receipt chrome rather than a product. */
const NOISE = new RegExp(
  [
    'sub\\s?total',
    'total',
    'balance',
    'change',
    'tax',
    'hst',
    'gst',
    'pst',
    'vat',
    'cash',
    'credit',
    'debit',
    'visa',
    'mastercard',
    'amex',
    'interac',
    'card',
    'tender',
    'approv',
    'auth',
    'ref\\s?#',
    'aid',
    'tvr',
    'tsi',
    'reference',
    'invoice',
    'receipt',
    'cashier',
    'register',
    'lane',
    'store\\s?#',
    'transaction',
    'survey',
    'thank\\s?you',
    'items?\\s?sold',
    'loyalty',
    'points',
    'savings',
    'coupon',
    'account',
    'tel[:.]',
    'phone',
    'www\\.',
    'http',
    'return policy',
    'customer copy',
  ].join('|'),
  'i',
);

export async function scanReceipt(
  file: File,
  onProgress?: (fraction: number) => void,
): Promise<string[]> {
  const { default: Tesseract } = await import('tesseract.js');
  const { data } = await Tesseract.recognize(file, 'eng', {
    logger: (m) => {
      if (m.status === 'recognizing text' && typeof m.progress === 'number') {
        onProgress?.(m.progress);
      }
    },
  });
  return extractItemLines(data.text);
}

export function extractItemLines(text: string): string[] {
  const rawLines = text.split(/\r?\n/);

  // Purchases sit between the first priced line (the header/logo/address block
  // above it has no prices) and the totals block (subtotal, tax, payment…).
  let start = rawLines.findIndex((line) => /\d[.,]\d{2}(?!\d)/.test(line));
  if (start < 0) start = 0;

  let end = rawLines.findIndex(
    (line, i) => i >= start && /\b(sub\s?total|total|amount due|balance due)\b/i.test(line),
  );
  if (end < 0) end = rawLines.length;

  const seen = new Set<string>();
  const lines: string[] = [];

  for (let i = start; i < end; i++) {
    const line = cleanupLine(rawLines[i] ?? '');
    if (line === null) continue;

    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    lines.push(line);
    if (lines.length >= MAX_LINES) break;
  }

  return lines;
}

function cleanupLine(raw: string): string | null {
  let line = raw.replace(/\s+/g, ' ').trim();
  if (!line) return null;

  // "2 @ $1.99" / "2 @ 1.99 ea" -> remember the quantity, drop the pricing.
  let qty: number | null = null;
  const atMatch = line.match(/(\d+)\s*@\s*\$?\d+[.,]\d{2}\s*(?:ea\b)?/i);
  if (atMatch && atMatch[1]) {
    qty = Number.parseInt(atMatch[1], 10);
    line = line.replace(atMatch[0], ' ');
  }

  // Leading "QTY 2" / "2 " quantity prefixes (small counts only, so street
  // numbers and the like don't get mistaken for a quantity).
  const qtyPrefix = line.match(/^(?:qty\s*)?(\d{1,2})\s+(?=[a-z])/i);
  if (qty === null && qtyPrefix && qtyPrefix[1]) {
    const n = Number.parseInt(qtyPrefix[1], 10);
    if (n >= 1 && n <= 24) {
      qty = n;
      line = line.slice(qtyPrefix[0].length);
    }
  }

  // Long numeric prefixes are PLU / barcode noise.
  line = line.replace(/^\d{4,}\s+/, '');

  // Trailing price(s), optionally with a tax-code letter: "3.99", "$3.99 F", "-1.00".
  line = line.replace(/\s*-?\$?\d+[.,]\d{2}\s*[A-Z]?$/g, '').trim();
  line = line.replace(/\s*-?\$?\d+[.,]\d{2}\s*[A-Z]?$/g, '').trim();

  // Drop stray leftover symbols at the ends.
  line = line.replace(/^[^a-z0-9]+|[^a-z0-9)]+$/gi, '').trim();

  if (!isProbablyItem(line)) return null;

  const name = titleCase(line);
  return qty && qty > 1 ? `${name} x${qty}` : name;
}

function isProbablyItem(line: string): boolean {
  if (line.length < 2 || line.length > 60) return false;
  if (!/[a-z]{2,}/i.test(line)) return false;
  if (NOISE.test(line)) return false;

  const letters = (line.match(/[a-z]/gi) ?? []).length;
  return letters / line.length >= 0.4;
}

function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
}
