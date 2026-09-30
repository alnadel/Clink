/**
 * CONTRACT FILE. Spec: docs/architecture/10-i18n-a11y.md §1.
 * Every user-visible string goes through t(). Keys live in en.json and ar.json.
 */
export type Locale = 'en' | 'ar';

export interface I18n {
  readonly locale: Locale;
  readonly dir: 'ltr' | 'rtl';
  /** Looks up `key` and replaces {name} placeholders. Missing key -> returns the key and logs once. */
  t(key: string, vars?: Record<string, string | number>): string;
}
