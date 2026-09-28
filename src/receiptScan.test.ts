import { beforeEach, describe, expect, it, vi } from 'vitest';
import { extractItemLines, scanReceipt } from './receiptScan';

vi.mock('tesseract.js', () => ({
  default: { recognize: vi.fn() },
}));

// eslint-disable-next-line import/first -- must follow vi.mock per Vitest hoisting rules
import Tesseract from 'tesseract.js';

type RecognizeResult = Awaited<ReturnType<typeof Tesseract.recognize>>;

function mockResult(text: string): RecognizeResult {
  return { data: { text } } as unknown as RecognizeResult;
}

describe('extractItemLines', () => {
  it('keeps items and drops the header, address, and totals block', () => {
    const receipt = [
      'WHOLE FOODS MARKET',
      '123 Main St, Anytown',
      'Tel: 555-0100',
      '',
      'ORGANIC BANANAS          1.29 F',
      'MILK 2% 1GAL             3.99 F',
      'BREAD WHEAT              2.50 F',
      'EGGS LARGE 12CT          4.19 F',
      '0079273510 CHEDDAR       6.99 F',
      'QTY 3 YOGURT PLAIN       3.00 F',
      '',
      'SUBTOTAL                21.95',
      'TAX                      1.75',
      'TOTAL                   23.70',
      'VISA DEBIT              23.70',
    ].join('\n');

    expect(extractItemLines(receipt)).toEqual([
      'Organic Bananas',
      'Milk 2% 1gal',
      'Bread Wheat',
      'Eggs Large 12ct',
      'Cheddar',
      'Yogurt Plain x3',
    ]);
  });

  it('drops "N @ price" lines and member-savings noise', () => {
    const receipt = [
      "Trader Joe's #514",
      'OPEN 8AM-9PM',
      '',
      'BANANA               0.23',
      '2 @ 0.23',
      'APPLE HONEYCRISP     1.49',
      'CAULIFLOWER          2.99',
      '   MEMBER SAVINGS    0.50',
      'SUB-TOTAL           10.28',
      'BALANCE DUE         10.28',
      'CASH               20.00',
      'CHANGE              9.72',
    ].join('\n');

    expect(extractItemLines(receipt)).toEqual(['Banana', 'Apple Honeycrisp', 'Cauliflower']);
  });

  it('drops a standalone discount/coupon line (negative price), a product line is never negative', () => {
    const receipt = ['MILK                     3.99', 'COUPON SAVE 0.50        -0.50', 'TOTAL      3.49'].join(
      '\n',
    );
    expect(extractItemLines(receipt)).toEqual(['Milk']);
  });

  it('drops a discount line even when OCR misspells the discount keyword', () => {
    // Real OCR garbling ("COUPON" -> "COUBON") means keyword matching alone
    // would miss this; the negative price itself is the reliable signal.
    const receipt = ['MILK                     3.99', 'COUBON SAVE 0.50        -0.50', 'TOTAL      3.49'].join(
      '\n',
    );
    expect(extractItemLines(receipt)).toEqual(['Milk']);
  });

  it('drops a trailing-minus style negative price too', () => {
    const receipt = ['MILK       3.99', 'INSTANT REBATE   1.00-', 'TOTAL      2.99'].join('\n');
    expect(extractItemLines(receipt)).toEqual(['Milk']);
  });

  it('strips a price with no leading digit before the decimal (".88" style)', () => {
    expect(extractItemLines('AVOCADO HASS EA .88 F')).toEqual(['Avocado Hass Ea']);
  });

  it('strips a trailing decimal size/quantity token into "Name" (no unit parsing here)', () => {
    // Size stays attached to the name; parseBulkInput is what turns "2kg" into qty+unit later.
    expect(extractItemLines('BASMATI RICE 2KG 7.49 F')).toEqual(['Basmati Rice 2kg']);
  });

  it('deduplicates repeated lines case-insensitively', () => {
    const receipt = ['MILK 2.99', 'milk 2.99', 'TOTAL 5.98'].join('\n');
    expect(extractItemLines(receipt)).toEqual(['Milk']);
  });

  it('returns an empty array when nothing looks like a purchase', () => {
    expect(extractItemLines('SUBTOTAL 0.00\nTOTAL 0.00')).toEqual([]);
    expect(extractItemLines('')).toEqual([]);
  });

  it('caps output at 60 lines', () => {
    const lines = Array.from({ length: 80 }, (_, i) => `ITEM NUMBER ${i} 1.00`);
    expect(extractItemLines(lines.join('\n')).length).toBe(60);
  });

  it('does not lose earlier items when the very first item\'s price is OCR-garbled', () => {
    // Regression test: previously, `start` was found only by locating the
    // first well-formed price. If OCR mangles that first price entirely
    // (a very real occurrence — see the "Register 3" line below acting as
    // a second, independent boundary signal), every line above the next
    // successfully-matched price was silently dropped, including real items.
    const receipt = [
      'FRESH MART GROCERY',
      '1420 Riverside Ave',
      'Store #0142 Register 3',
      'GREAT VALUE MILK 1GAL ERT', // price OCR'd as garbage, not a number at all
      'BANANAS',
      '  2.14 lb @ 0.58/lb        1.24 F',
      'BREAD WHEAT                1.98 F',
      'SUBTOTAL                   4.70',
    ].join('\n');

    expect(extractItemLines(receipt)).toEqual(['Great Value Milk 1gal Ert', 'Bananas', 'Bread Wheat']);
  });

  it('handles a Dutch receipt (comma decimals, euro sign, Dutch total/discount/footer wording)', () => {
    // Based on a real OCR pass over a synthetic Albert Heijn-style receipt,
    // including the OCR quirks that actually showed up ("BTA 94" for
    // "BTW 9%", "BINNEN" for "PINNEN", "xg" for "kg").
    const receipt = [
      'ALBERT HEIJN',
      'Winkel 1421 Kassa 3',
      'Coolsingel 12, Rotterdam',
      'Datum: 28-09-2026 09:14',
      'AH VOLLE MELK 1L 1,39',
      'BRUINE BOLLEN 6ST 2,29',
      'JONAGOLD APPELS',
      '0,68 xg @ 2,29/kg 1,56',
      'AH BASMATI RIJST 1KG 2,99',
      'ROOMBOTER 250G 2,49',
      'HAGELSLAG PUUR 400G 2,19',
      'KORTING -0,30',
      'STATIEGELD FLES 0,15',
      'SUBTOTAAL 12,76',
      'BTA 9% 1,05',
      'TOTAAL 12,76',
      'BINNEN 12,76',
      'Bedankt voor uw bezoek!',
      'Tot ziens bij Albert Heijn',
      'Spaar mee voor korting',
      'Bonuskaart: 1234 5678',
      'Openingstijden ma-za 8-22',
    ].join('\n');

    expect(extractItemLines(receipt)).toEqual([
      'Ah Volle Melk 1l',
      'Bruine Bollen 6st',
      'Jonagold Appels',
      'Ah Basmati Rijst 1kg',
      'Roomboter 250g',
      'Hagelslag Puur 400g',
    ]);
  });

  it('folds an inline "N x price" multiplier into an xN suffix', () => {
    // European/Dutch receipts often show the per-unit price inline after
    // the name (distinct from the US "N @ price" style), separate from the
    // line's own trailing total.
    expect(extractItemLines('PISTACHIOS 2 x 3.14   6.28')).toEqual(['Pistachios x2']);
    expect(extractItemLines('SNACK MIX 2 × 0.78   1.56')).toEqual(['Snack Mix x2']);
  });

  it('handles a real Dutch supermarket receipt: inline multipliers, per-line ' +
    'promo discounts, and receipt-summary words (Aantal/Omschrijving/Bankpas)', () => {
    // Taken from an actual Jumbo receipt layout: a right-aligned price
    // column, "Actieprijs" (promo price) shown as its own negative-priced
    // line directly under the item it discounts, and multi-buy items
    // priced inline as "2 x 3,14" ahead of the line's own total.
    const receipt = [
      'OMSCHRIJVING                    EUR',
      'Coquilles in zak              10,99 B',
      '    Actieprijs                 -3,00',
      'Pistachenoten Calif. 2 x 3,14  6,28 B',
      '    Actieprijs                 -1,30',
      'Boerenkool                     1,89 B',
      '    Actieprijs                 -0,60',
      'Verse rookworst                1,99 B',
      'Scharreleieren 12st.            2,39 B',
      'Margarine                       1,79 B',
      'Bananen                         1,41 B',
      '  1,182 kg x 1,19   EUR',
      'Multi Color sla                 1,19 B',
      'Slamix              2 x 1,19    2,38 B',
      'Chocolade kruidnoten 2 x 0,78   1,56 B',
      '------------------------------------',
      'Aantal              24art.',
      '',
      'Totaal                         44,16',
      'Bankpas                        44,16',
      '------------------------------------',
      "Customer's receipt",
    ].join('\n');

    expect(extractItemLines(receipt)).toEqual([
      'Coquilles In Zak',
      'Pistachenoten Calif x2',
      'Boerenkool',
      'Verse Rookworst',
      'Scharreleieren 12st',
      'Margarine',
      'Bananen',
      'Multi Color Sla',
      'Slamix x2',
      'Chocolade Kruidnoten x2',
    ]);
  });
});

describe('scanReceipt', () => {
  beforeEach(() => {
    vi.mocked(Tesseract.recognize).mockReset();
  });

  it('OCRs the file in English + Dutch and returns the extracted item lines', async () => {
    vi.mocked(Tesseract.recognize).mockResolvedValue(mockResult('MILK 2.99\nBREAD 1.50\nTOTAL 4.49'));
    const file = new File(['x'], 'receipt.jpg', { type: 'image/jpeg' });

    const lines = await scanReceipt(file);

    expect(Tesseract.recognize).toHaveBeenCalledWith(
      file,
      'eng+nld',
      expect.objectContaining({ logger: expect.any(Function) }),
    );
    expect(lines).toEqual(['Milk', 'Bread']);
  });

  it('forwards OCR progress (only "recognizing text" updates) to onProgress', async () => {
    vi.mocked(Tesseract.recognize).mockImplementation(async (_image, _langs, options) => {
      const logger = (options as { logger?: (m: { status: string; progress: number }) => void })?.logger;
      logger?.({ status: 'loading tesseract core', progress: 0 });
      logger?.({ status: 'recognizing text', progress: 0.5 });
      logger?.({ status: 'recognizing text', progress: 1 });
      return mockResult('MILK 2.99\nTOTAL 2.99');
    });

    const progress: number[] = [];
    await scanReceipt(new File(['x'], 'r.jpg'), (p) => progress.push(p));

    expect(progress).toEqual([0.5, 1]);
  });
});
