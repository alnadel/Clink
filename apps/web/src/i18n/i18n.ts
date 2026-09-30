import type { LanguageSetting } from '../save/types';
import ar from './ar.json';
import en from './en.json';
import type { I18n, Locale } from './types';

const STRINGS: Record<Locale, Record<string, string>> = { en, ar };
const warned = new Set<string>();

/** Picks the locale for a language setting; `system` follows the browser language. */
export function resolveLocale(setting: LanguageSetting, navigatorLanguage = 'en'): Locale {
  if (setting === 'en' || setting === 'ar') return setting;
  return navigatorLanguage.toLowerCase().startsWith('ar') ? 'ar' : 'en';
}

/**
 * Creates the translator. `t` looks a key up in the locale, then in English, then falls back to the
 * key itself (logged once). `{name}` placeholders are replaced with `String(vars[name])`.
 */
export function createI18n(
  setting: LanguageSetting,
  navigatorLanguage: string = typeof navigator === 'undefined' ? 'en' : navigator.language,
): I18n {
  const locale = resolveLocale(setting, navigatorLanguage);
  return {
    locale,
    dir: locale === 'ar' ? 'rtl' : 'ltr',
    t(key, vars) {
      const template = STRINGS[locale][key] ?? STRINGS.en[key];
      if (template === undefined) {
        if (import.meta.env?.DEV && !warned.has(key)) {
          warned.add(key);
          console.warn(`missing i18n key: ${key}`);
        }
        return key;
      }
      return template.replace(/\{(\w+)\}/g, (whole, name: string) => {
        const value = vars?.[name];
        return value === undefined ? whole : String(value);
      });
    },
  };
}
