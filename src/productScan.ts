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
 * something added blindly. Recognizes English and Dutch text (labels sold
 * in the Netherlands are almost always Dutch, sometimes mixed with English
 * brand names).
 *
 * A name that wraps onto a second line ("VOLLE" / "MELK" stacked, rather
 * than "VOLLE MELK" on one) would otherwise lose half of itself, since only
 * one line can be "the tallest". So after finding the tallest candidate,
 * this also absorbs immediately-adjacent lines that are close to it both in
 * height and in vertical position — a wrapped headline has little space
 * between its own lines, unlike the gap to an unrelated brand name or
 * subtitle elsewhere on the packaging.
 */

/** Words that mark a line as packaging fine print rather than the product name (English + Dutch). */
const NOISE = new RegExp(
  [
    // English
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
    // Dutch
    'ingredi[eë]nten',
    'voedingswaarde',
    'houdbaar',
    'netto\\s?gewicht',
    'ten minste houdbaar',
    'gefabriceerd',
    'vervaardigd',
    'gedistribueerd',
    'verpakt',
    'bevat',
    'allergenen',
    'bewaren',
    'streepjescode',
    'klantenservice',
    'kcal',
  ].join('|'),
  'i',
);

export async function scanProduct(
  file: File,
  onProgress?: (fraction: number) => void,
): Promise<string | null> {
  const { createWorker, PSM } = await import('tesseract.js');
  const worker = await createWorker('eng+nld', undefined, {
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

interface Candidate {
  text: string;
  height: number;
  y0: number;
  y1: number;
}

/** How close two lines' heights and the gap between them must be, relative to the anchor's height, to count as the same wrapped headline. */
const MIN_HEIGHT_RATIO = 0.4;
const MAX_GAP_RATIO = 0.4;

/** Pick the tallest plausible line, absorbing adjacent lines that look like a wrapped continuation of it — exported separately so it's testable without OCR. */
export function pickProductName(lines: readonly LineLike[]): string | null {
  const candidates: Candidate[] = lines
    .map((line) => ({
      text: cleanupLine(line.text),
      height: line.bbox.y1 - line.bbox.y0,
      y0: line.bbox.y0,
      y1: line.bbox.y1,
    }))
    .filter((c): c is Candidate => isPlausibleName(c.text))
    .sort((a, b) => a.y0 - b.y0); // reading order, top to bottom

  if (candidates.length === 0) return null;

  const anchorIdx = candidates.reduce((best, c, i) => (c.height > candidates[best]!.height ? i : best), 0);
  const anchor = candidates[anchorIdx]!;
  const canAbsorb = (candidate: Candidate, gap: number): boolean =>
    gap <= anchor.height * MAX_GAP_RATIO && candidate.height >= anchor.height * MIN_HEIGHT_RATIO;

  let start = anchorIdx;
  while (start > 0) {
    const above = candidates[start - 1]!;
    if (!canAbsorb(above, candidates[start]!.y0 - above.y1)) break;
    start--;
  }

  let end = anchorIdx;
  while (end < candidates.length - 1) {
    const below = candidates[end + 1]!;
    if (!canAbsorb(below, below.y0 - candidates[end]!.y1)) break;
    end++;
  }

  const cluster = candidates.slice(start, end + 1);
  return titleCase(cluster.map((c) => c.text).join(' '));
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
