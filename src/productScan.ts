/**
 * Read a photo of a single product and guess its name from the label.
 *
 * A receipt is a column of same-sized line items, so the default "assume one
 * uniform block of text" page segmentation (what {@link import('./receiptScan').scanReceipt}
 * relies on) works fine there. A product label is the opposite: one name in
 * a much bigger font than the ingredients/net-weight/barcode text around it,
 * arranged however the packaging designer liked. That default segmentation
 * mode garbles large headline text on this kind of image, so this uses
 * Tesseract's more permissive "Auto" segmentation instead, then picks
 * whichever recognized line has the tallest bounding box — a proxy for "the
 * biggest text on the packaging", which is usually the product name.
 *
 * Like receipt scanning, this is a guess for the user to confirm/edit, not
 * something added blindly.
 */

/** Words that mark a line as packaging fine print rather than the product name. */
const NOISE = new RegExp(
  [
    'ingredients?',
    'nutrition',
    'net\\s?wt',
    'net\\s?weight',
    'best\\s?before',
    'use\\s?by',
    'exp(?:iry|ires)?',
    'manufactured',
    'distributed',
    'packed\\s?by',
    'www\\.',
    'http',
    'barcode',
    'contains',
    'allergen',
    'storage',
    'refrigerat',
    'serving size',
    'calories',
    'upc',
    'lot\\s?no',
    'batch',
    'fssai',
    'customer care',
  ].join('|'),
  'i',
);

export async function scanProduct(
  file: File,
  onProgress?: (fraction: number) => void,
): Promise<string | null> {
  const { createWorker, PSM } = await import('tesseract.js');
  const worker = await createWorker('eng', undefined, {
    logger: (m) => {
      if (m.status === 'recognizing text' && typeof m.progress === 'number') {
        onProgress?.(m.progress);
      }
    },
  });

  try {
    await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO });
    const { data } = await worker.recognize(file);
    return pickProductName(data.lines);
  } finally {
    await worker.terminate();
  }
}

interface LineLike {
  text: string;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

/** Pick the tallest plausible line — exported separately so it's testable without OCR. */
export function pickProductName(lines: readonly LineLike[]): string | null {
  const candidates = lines
    .map((line) => ({ text: cleanupLine(line.text), height: line.bbox.y1 - line.bbox.y0 }))
    .filter((line): line is { text: string; height: number } => isPlausibleName(line.text));

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => b.height - a.height);
  return titleCase(candidates[0]!.text);
}

function cleanupLine(raw: string): string {
  return raw
    .replace(/\s+/g, ' ')
    .replace(/^[^a-z0-9]+|[^a-z0-9)]+$/gi, '')
    .trim();
}

function isPlausibleName(text: string): boolean {
  if (text.length < 2 || text.length > 40) return false;
  if (!/[a-z]{2,}/i.test(text)) return false;
  if (NOISE.test(text)) return false;

  const letters = (text.match(/[a-z]/gi) ?? []).length;
  return letters / text.length >= 0.5;
}

function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
}
