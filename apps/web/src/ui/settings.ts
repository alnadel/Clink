import { createI18n } from '../i18n/i18n';
import type { Settings } from '../save/types';
import type { Services } from './services';

/** Applies the side effects a settings change needs, live and without a reload. */
export function applySettingEffects(services: Services, previous: Settings, next: Settings): void {
  if (previous.sound !== next.sound) {
    // Turning sound on must unlock audio inside the user's gesture, so call this from the click handler.
    if (next.sound) void services.audio.unlock();
    services.audio.setEnabled(next.sound);
  }
  if (previous.language !== next.language) {
    const i18n = createI18n(next.language);
    document.documentElement.lang = i18n.locale;
    document.documentElement.dir = i18n.dir;
    services.i18n.set(i18n);
  }
}

/** Changes one setting: stores it, applies its effects and records the change (docs/architecture/05 §11). */
export function changeSetting<K extends keyof Settings>(
  services: Services,
  key: K,
  value: Settings[K],
): void {
  const previous = services.profile.get().settings;
  if (previous[key] === value) return;
  const next = { ...previous, [key]: value };
  services.profile.update((profile) => ({ ...profile, settings: next }));
  applySettingEffects(services, previous, next);
  services.analytics.track('setting_change', { setting: key, value: String(value) });
}

/** Replaces every setting at once (restore code import) and applies the effects. */
export function replaceSettings(services: Services, next: Settings): void {
  const previous = services.profile.get().settings;
  services.profile.update((profile) => ({ ...profile, settings: next }));
  applySettingEffects(services, previous, next);
}
