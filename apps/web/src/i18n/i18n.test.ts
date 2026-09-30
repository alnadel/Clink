import { describe, expect, it } from 'vitest';
import { createI18n, resolveLocale } from './i18n';

describe('createI18n', () => {
  it('fills placeholders and returns the key when missing', () => {
    const { t } = createI18n('en', 'en-US');
    expect(t('play.moves', { moves: 3, par: 5 })).toBe('Moves 3 · Par 5');
    expect(t('home.daily', { n: 42 })).toBe('Daily #42');
    expect(t('no.such.key')).toBe('no.such.key');
  });

  it('leaves unknown placeholders alone', () => {
    expect(createI18n('en', 'en').t('play.moves', { moves: 1 })).toBe('Moves 1 · Par {par}');
  });

  it('system follows the browser language; explicit settings win', () => {
    expect(createI18n('system', 'ar-SA').dir).toBe('rtl');
    expect(createI18n('system', 'en-GB').dir).toBe('ltr');
    expect(createI18n('en', 'ar').locale).toBe('en');
    expect(resolveLocale('ar', 'en')).toBe('ar');
  });

  it('uses the Arabic strings when Arabic is chosen', () => {
    expect(createI18n('ar', 'en').t('play.undo')).toBe('تراجع');
  });
});
