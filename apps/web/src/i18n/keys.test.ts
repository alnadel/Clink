import { describe, expect, it } from 'vitest';
import ar from './ar.json';
import en from './en.json';

describe('translations (FR-31)', () => {
  it('Arabic has exactly the keys English has', () => {
    expect(Object.keys(ar).sort()).toEqual(Object.keys(en).sort());
  });

  it('no string is empty', () => {
    for (const [key, value] of [...Object.entries(en), ...Object.entries(ar)]) {
      expect(value.trim(), key).not.toBe('');
    }
  });

  it('Arabic keeps every {placeholder} its English string has', () => {
    const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(placeholders(ar[key]), key).toEqual(placeholders(en[key]));
    }
  });
});
