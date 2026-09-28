import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pickProductName, scanProduct } from './productScan';

function line(text: string, height: number): { text: string; bbox: { x0: number; y0: number; x1: number; y1: number } } {
  return { text, bbox: { x0: 0, y0: 0, x1: 100, y1: height } };
}

describe('pickProductName', () => {
  it('picks the tallest plausible line (the biggest text on the label)', () => {
    const lines = [line('Premium Quality', 11), line('BASMATI RICE', 39), line('Product of India', 10)];
    expect(pickProductName(lines)).toBe('Basmati Rice');
  });

  it('ignores packaging fine print regardless of height', () => {
    const lines = [
      line('Ingredients: rice, water', 50), // taller, but noise
      line('Basmati Rice', 39),
      line('Net Wt: 5kg', 10),
      line('Best before 12 months', 45), // also taller, also noise
    ];
    expect(pickProductName(lines)).toBe('Basmati Rice');
  });

  it('ignores lines that are mostly numbers or symbols', () => {
    const lines = [line('123456789012', 60), line('Turmeric Powder', 30)];
    expect(pickProductName(lines)).toBe('Turmeric Powder');
  });

  it('ignores blank lines', () => {
    const lines = [line('   ', 80), line('Turmeric Powder', 30)];
    expect(pickProductName(lines)).toBe('Turmeric Powder');
  });

  it('returns null when nothing plausible is found', () => {
    expect(pickProductName([line('Ingredients: salt', 40), line('www.brand.com', 20)])).toBeNull();
  });

  it('returns null for an empty line list', () => {
    expect(pickProductName([])).toBeNull();
  });

  it('title-cases the winning line', () => {
    expect(pickProductName([line('MANGO PICKLE', 30)])).toBe('Mango Pickle');
  });
});

vi.mock('tesseract.js', () => ({
  createWorker: vi.fn(),
  PSM: { AUTO: '3' },
}));

import { createWorker } from 'tesseract.js';

describe('scanProduct', () => {
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
