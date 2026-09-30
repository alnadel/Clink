import { describe, expect, it, vi } from 'vitest';
import { shareResult } from './share';

const input = { puzzleNo: 42, moves: 6, par: 5, stars: 2 as const, origin: 'https://clink.example' };
const TEXT = 'Clink #42 ⭐⭐\n💧💧💧💧💧💧 6/5\nhttps://clink.example/d/42?src=share';

describe('shareResult', () => {
  it('uses the Web Share API when available', async () => {
    const share = vi.fn(async () => {});
    expect(await shareResult(input, { nav: { share, clipboard: undefined as never } })).toBe('share');
    expect(share).toHaveBeenCalledWith({ text: TEXT });
  });

  it('a cancelled share sheet is reported as cancelled', async () => {
    const share = vi.fn(async () => {
      throw new DOMException('cancelled', 'AbortError');
    });
    expect(await shareResult(input, { nav: { share, clipboard: undefined as never } })).toBe('cancelled');
  });

  it('falls back to the clipboard', async () => {
    const writeText = vi.fn(async () => {});
    const clipboard = { writeText } as unknown as Clipboard;
    expect(await shareResult(input, { nav: { clipboard } })).toBe('clipboard');
    expect(writeText).toHaveBeenCalledWith(TEXT);
  });

  it('reports failure when neither exists or the clipboard rejects', async () => {
    expect(await shareResult(input, { nav: {} })).toBe('failed');
    const clipboard = {
      writeText: async () => {
        throw new Error('denied');
      },
    } as unknown as Clipboard;
    expect(await shareResult(input, { nav: { clipboard } })).toBe('failed');
  });
});
