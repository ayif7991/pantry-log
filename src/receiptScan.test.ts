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
      'COCA COLA 12PK          -1.00',
      '',
      'SUBTOTAL                24.95',
      'TAX                      1.75',
      'TOTAL                   26.70',
      'VISA DEBIT              26.70',
    ].join('\n');

    expect(extractItemLines(receipt)).toEqual([
      'Organic Bananas',
      'Milk 2% 1gal',
      'Bread Wheat',
      'Eggs Large 12ct',
      'Cheddar',
      'Yogurt Plain x3',
      'Coca Cola 12pk',
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
});

describe('scanReceipt', () => {
  beforeEach(() => {
    vi.mocked(Tesseract.recognize).mockReset();
  });

  it('OCRs the file in English and returns the extracted item lines', async () => {
    vi.mocked(Tesseract.recognize).mockResolvedValue(mockResult('MILK 2.99\nBREAD 1.50\nTOTAL 4.49'));
    const file = new File(['x'], 'receipt.jpg', { type: 'image/jpeg' });

    const lines = await scanReceipt(file);

    expect(Tesseract.recognize).toHaveBeenCalledWith(
      file,
      'eng',
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
