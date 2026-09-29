/**
 * Read a photo of a receipt and pull out candidate item lines.
 *
 * OCR runs fully in the browser via tesseract.js (loaded on demand — the
 * engine + English/Dutch models are fetched from a CDN the first time a
 * receipt is scanned). The raw text is then filtered down to lines that look
 * like purchases, with prices stripped and "2 @ 1.99" style quantities
 * folded into the `xN` form that {@link parseBulkInput} understands.
 *
 * Grocery receipts abbreviate heavily, so the output is meant to be shown to
 * the user for review, not added blindly.
 */

const MAX_LINES = 60;

/**
 * A price token to strip out: "$3.99", "3,99", "€3.99", "3.99€". Allows a
 * missing leading digit ("*.88" style: ".88") since some receipts print
 * sub-unit prices without the leading 0.
 */
const PRICE = String.raw`[$€]?\d*[.,]\d{2}\s?[$€]?`;

/** Words that mark a line as receipt chrome rather than a product (English + Dutch). */
const NOISE = new RegExp(
  [
    // English
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
    'discount',
    'promo',
    'you pay',
    'account',
    'tel[:.]',
    'phone',
    'www\\.',
    'http',
    'return policy',
    'customer copy',
    // Dutch
    'sub\\s?totaal',
    'totaal',
    'te betalen',
    'verschuldigd',
    '\\bbtw\\b',
    'korting',
    'statiegeld',
    'contant',
    '\\bpin(?:nen)?\\b',
    'bedankt',
    'tot ziens',
    'kassa(?:bon)?',
    '\\bwinkel\\b',
    '\\bbon(?:uskaart)?\\b',
    'klantenkaart',
    'spaarpunten',
    'filiaal',
    'retour',
    'artikelen',
    'openingstijden',
    '\\baantal\\b',
    'omschrijving',
    'bankpas',
    'actieprijs',
  ].join('|'),
  'i',
);

/** Lines that mark roughly where the header ends and the item list begins. */
const HEADER_MARKER = /\b(register|cashier|op\s?#|trans\s?#|store\s?#|kassa|winkel)\b/i;

/**
 * The end-of-items marker: subtotal/total, in English or Dutch. Dutch
 * "totaal" isn't "total" with a suffix tacked on — the extra letter sits in
 * the middle (t-o-t-a-a-l vs t-o-t-a-l) — so it needs its own alternative
 * rather than a `total(?:aal)?` shortcut, which would never match it.
 */
const TOTAL_MARKER = /\b(?:sub\s?)?(?:totaal|total)\b|amount due|balance due|te betalen|verschuldigd/i;

/** A negative price ("-0.50", "-€0,30") — a coupon/discount adjustment, never a product. */
const NEGATIVE_PRICE = /-\s?[$€]?\d+[.,]\d{2}(?!\d)|\d+[.,]\d{2}\s?-(?:\s|$)/;

export async function scanReceipt(
  file: File,
  onProgress?: (fraction: number) => void,
): Promise<string[]> {
  const { default: Tesseract } = await import('tesseract.js');
  const { data } = await Tesseract.recognize(file, 'eng+nld', {
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
  const start = findStart(rawLines);

  let end = rawLines.findIndex((line, i) => i >= start && TOTAL_MARKER.test(line));
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

/**
 * Purchases sit between the header (logo/address/register info) and the
 * totals block. The first well-formed price is usually the first item — but
 * if OCR garbles that specific price (common: a large or bold price is
 * exactly the kind of thing OCR misreads), everything above the *next*
 * lucky price match would otherwise be lost, including real items.
 *
 * So instead of trusting that first price match outright, walk backward
 * from it and keep absorbing lines that still look like plausible items
 * (has letters, not obvious receipt chrome). The walk stops as soon as it
 * hits something that clearly isn't an item — a blank line, a
 * register/kassa line, a date/transaction line (mostly digits) — which in
 * practice is always at most a line or two above the true first item.
 */
function findStart(lines: readonly string[]): number {
  const priceIdx = lines.findIndex((line) => /\d[.,]\d{2}(?!\d)/.test(line));
  if (priceIdx < 0) return 0;

  let start = priceIdx;
  while (start > 0) {
    const prev = (lines[start - 1] ?? '').replace(/\s+/g, ' ').trim();
    if (!prev || HEADER_MARKER.test(prev) || !isProbablyItem(prev)) break;
    start--;
  }
  return start;
}

function cleanupLine(raw: string): string | null {
  let line = raw.replace(/\s+/g, ' ').trim();
  if (!line) return null;
  if (NEGATIVE_PRICE.test(line)) return null; // coupon/discount adjustment, not a product

  // "2 @ $1.99" / "2 @ 1,99 ea" (US-style) or "2 x 3,14" (the inline
  // per-unit price Dutch/European receipts print after the item name,
  // separate from the line's own trailing total) -> remember the quantity,
  // drop the per-unit pricing.
  let qty: number | null = null;
  const atMatch = line.match(new RegExp(String.raw`(\d+)\s*(?:@|x|×)\s*${PRICE}\s*(?:ea\b)?`, 'i'));
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

  // Trailing price(s), optionally with a tax-code letter: "3.99", "3,99", "$3.99 F".
  const trailingPrice = new RegExp(`\\s*${PRICE}\\s*[A-Z]?$`);
  line = line.replace(trailingPrice, '').trim();
  line = line.replace(trailingPrice, '').trim();

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
