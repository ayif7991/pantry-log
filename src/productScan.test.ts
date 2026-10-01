import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pickProductName, scanProduct } from './productScan';

interface LineFixture {
  text: string;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

/**
 * A fresh line-builder per test that auto-stacks lines top to bottom, since
 * pickProductName now uses vertical position (not just height) to decide
 * whether adjacent lines belong together. The default 60px gap is well
 * above any realistic merge threshold for these heights, so tests that
 * don't care about position get lines that are unambiguously separate;
 * pass a small `gapBefore` to simulate a tightly wrapped headline.
 */
function lineStack(): (text: string, height: number, gapBefore?: number) => LineFixture {
  let cursorY = 0;
  return (text, height, gapBefore = 60) => {
    const y0 = cursorY + gapBefore;
    const y1 = y0 + height;
    cursorY = y1;
    return { text, bbox: { x0: 0, y0, x1: 100, y1 } };
  };
}

describe('pickProductName', () => {
  it('picks the tallest plausible line (the biggest text on the label)', () => {
    const line = lineStack();
    const lines = [line('Premium Quality', 11), line('BASMATI RICE', 39), line('Product of India', 10)];
    expect(pickProductName(lines)).toBe('Basmati Rice');
  });

  it('ignores packaging fine print regardless of height', () => {
    const line = lineStack();
    const lines = [
      line('Ingredients: rice, water', 50), // taller, but noise
      line('Basmati Rice', 39),
      line('Net Wt: 5kg', 10),
      line('Best before 12 months', 45), // also taller, also noise
    ];
    expect(pickProductName(lines)).toBe('Basmati Rice');
  });

  it('ignores lines that are mostly numbers or symbols', () => {
    const line = lineStack();
    const lines = [line('123456789012', 60), line('Turmeric Powder', 30)];
    expect(pickProductName(lines)).toBe('Turmeric Powder');
  });

  it('ignores blank lines', () => {
    const line = lineStack();
    const lines = [line('   ', 80), line('Turmeric Powder', 30)];
    expect(pickProductName(lines)).toBe('Turmeric Powder');
  });

  it('returns null when nothing plausible is found', () => {
    const line = lineStack();
    expect(pickProductName([line('Ingredients: salt', 40), line('www.brand.com', 20)])).toBeNull();
  });

  it('returns null for an empty line list', () => {
    expect(pickProductName([])).toBeNull();
  });

  it('title-cases the winning line', () => {
    expect(pickProductName([lineStack()('MANGO PICKLE', 30)])).toBe('Mango Pickle');
  });

  it('ignores Dutch packaging fine print too', () => {
    const line = lineStack();
    const lines = [
      line('Ingrediënten: tarwebloem, water', 40),
      line('Volkoren Brood', 32),
      line('Houdbaar tot: zie deksel', 12),
      line('Bewaren beneden 4 graden', 38),
    ];
    expect(pickProductName(lines)).toBe('Volkoren Brood');
  });

  it('merges a name that wraps onto a second, adjacent line ("VOLLE" / "MELK")', () => {
    // Real measurements from an actual OCR pass over a Melkan milk carton:
    // the second line came back shorter than the first despite being the
    // same design size, which is exactly the kind of OCR bbox noise the
    // height-ratio tolerance needs to absorb.
    const line = lineStack();
    const lines = [
      line('Melkan', 25, 50), // brand, well above — should not be absorbed
      line('verse', 14, 6),
      line('VOLLE', 67, 30),
      line('MELK', 37, 17), // tight gap after VOLLE -> same headline
    ];
    expect(pickProductName(lines)).toBe('Volle Melk');
  });

  it('does not merge a large line that sits far away (unrelated big text elsewhere)', () => {
    const line = lineStack();
    const lines = [
      line('CHICKEN MASALA', 50, 20),
      line('Est. 1990 heritage brand', 48, 200), // also big, but far below and unrelated
    ];
    expect(pickProductName(lines)).toBe('Chicken Masala');
  });

  it('does not merge an adjacent line that is much smaller (a subtitle sitting close by)', () => {
    const line = lineStack();
    const lines = [line('VOLLE MELK', 67, 30), line('Sinds 1980', 12, 5)];
    expect(pickProductName(lines)).toBe('Volle Melk');
  });

  it('merges three stacked lines of a longer wrapped name', () => {
    const line = lineStack();
    const lines = [line('EXTRA', 40, 30), line('VIRGIN', 40, 8), line('OLIVE OIL', 40, 8)];
    expect(pickProductName(lines)).toBe('Extra Virgin Olive Oil');
  });
});

vi.mock('tesseract.js', () => ({
  createWorker: vi.fn(),
  PSM: { AUTO: '3' },
}));

import { createWorker } from 'tesseract.js';

describe('scanProduct', () => {
  const line = lineStack();
  const worker = {
    setParameters: vi.fn(),
    recognize: vi.fn(),
    terminate: vi.fn(),
  };

  beforeEach(() => {
    worker.setParameters.mockReset().mockResolvedValue(undefined);
    worker.recognize.mockReset();
    worker.terminate.mockReset().mockResolvedValue(undefined);
    vi.mocked(createWorker).mockReset().mockResolvedValue(worker as never);
  });

  it('sets Auto page segmentation and returns the picked name', async () => {
    worker.recognize.mockResolvedValue({
      data: { lines: [line('Basmati Rice', 39), line('Product of India', 10)] },
    });

    const name = await scanProduct(new File(['x'], 'p.jpg'));

    expect(createWorker).toHaveBeenCalledWith('eng+nld', undefined, expect.any(Object));
    expect(worker.setParameters).toHaveBeenCalledWith({ tessedit_pageseg_mode: '3' });
    expect(name).toBe('Basmati Rice');
  });

  it('always terminates the worker, even when recognition throws', async () => {
    worker.recognize.mockRejectedValue(new Error('ocr failed'));

    await expect(scanProduct(new File(['x'], 'p.jpg'))).rejects.toThrow('ocr failed');
    expect(worker.terminate).toHaveBeenCalled();
  });

  it('forwards OCR progress (only "recognizing text" updates) to onProgress', async () => {
    type Logger = (m: { status: string; progress: number }) => void;
    let capturedLogger: Logger | undefined;

    vi.mocked(createWorker).mockImplementation(async (_langs, _oem, options) => {
      capturedLogger = (options as { logger?: Logger } | undefined)?.logger;
      return worker as never;
    });
    worker.recognize.mockImplementation(async () => {
      capturedLogger?.({ status: 'loading tesseract core', progress: 0 });
      capturedLogger?.({ status: 'recognizing text', progress: 0.7 });
      return { data: { lines: [line('Rice', 20)] } };
    });

    const progress: number[] = [];
    await scanProduct(new File(['x'], 'p.jpg'), (p) => progress.push(p));

    expect(progress).toEqual([0.7]);
  });
});
