import type { JSX } from 'preact';
import { ExportCode, ImportCode } from '../components/RestorePanel';
import { Screen } from '../components/Screen';
import { SegmentedControl } from '../components/SegmentedControl';
import { Toggle } from '../components/Toggle';
import { useStore } from '../hooks/useStore';
import { useServices, useT } from '../services';
import { changeSetting } from '../settings';

/** Every setting in one place, applied live, plus the restore code (FR-33) and the privacy notice. */
export function SettingsScreen(): JSX.Element {
  const services = useServices();
  const t = useT();
  const { settings } = useStore(services.profile);
  const set = <K extends keyof typeof settings>(key: K, value: (typeof settings)[K]) =>
    changeSetting(services, key, value);

  return (
    <Screen title={t('settings.title')} back="/">
      <div class="stack settings">
        <Toggle label={t('settings.sound')} checked={settings.sound} onChange={(v) => set('sound', v)} />
        <Toggle
          label={t('settings.autoPlay')}
          checked={settings.autoPlaySong}
          onChange={(v) => set('autoPlaySong', v)}
        />
        <SegmentedControl
          label={t('settings.labels')}
          value={settings.labels}
          options={[
            { value: 'none', label: t('settings.labels.none') },
            { value: 'letters', label: t('settings.labels.letters') },
            { value: 'solfege', label: t('settings.labels.solfege') },
          ]}
          onChange={(v) => set('labels', v)}
        />
        <SegmentedControl
          label={t('settings.reducedMotion')}
          value={settings.reducedMotion}
          options={[
            { value: 'system', label: t('settings.system') },
            { value: 'on', label: t('settings.on') },
            { value: 'off', label: t('settings.off') },
          ]}
          onChange={(v) => set('reducedMotion', v)}
        />
        <SegmentedControl
          label={t('settings.language')}
          value={settings.language}
          options={[
            { value: 'system', label: t('settings.system') },
            { value: 'en', label: 'English' },
            { value: 'ar', label: 'العربية' },
          ]}
          onChange={(v) => set('language', v)}
        />
        {'vibrate' in navigator ? (
          <Toggle
            label={t('settings.vibration')}
            checked={settings.vibration}
            onChange={(v) => set('vibration', v)}
          />
        ) : null}

        <h2>{t('settings.export')}</h2>
        <ExportCode />
        <ImportCode />

        <p>
          <a href="/privacy">{t('settings.privacy')}</a>
        </p>
        <p class="muted">{t('settings.version', { version: __APP_VERSION__ })}</p>
      </div>
    </Screen>
  );
}
