import type { RemoteConfig } from '@clink/rules';
import { render } from 'preact';
import defaultConfig from '../../../content/config.json';
import { App } from './app';
import { createAudioEngine } from './audio/engine';
import { loadContent } from './content/store';
import { createI18n } from './i18n/i18n';
import { createStore } from './lib/store';
import { createConsoleAnalytics } from './ops/console-analytics';
import type { ResolvedFlags } from './ops/flags';
import { createSaveStore } from './save/store';
import type { Profile, Progress } from './save/types';
import { installTestHook } from './testing/hook';
import './styles/global.css';
import type { Services } from './ui/services';
import { createHintClient } from './workers/hint-client';

if (import.meta.env.MODE === 'e2e') installTestHook();

const root = document.getElementById('app');
if (!root) throw new Error('#app not found');

/** Bootstrap order: docs/architecture/05 §13. Later issues add error handlers, remote config and flags. */
async function bootstrap(): Promise<void> {
  const save = createSaveStore();
  const initialProfile = await save.loadProfile();
  const params = new URLSearchParams(location.search);
  let profile: Profile = initialProfile;
  if (params.get('tester') === '1') profile = { ...profile, tester: true };
  const source = params.get('src');
  if (source && profile.source === null) profile = { ...profile, source };
  if (profile !== initialProfile) await save.saveProfile(profile);
  const progress = await save.loadProgress();

  const i18n = createI18n(profile.settings.language);
  document.documentElement.lang = i18n.locale;
  document.documentElement.dir = i18n.dir;

  const content = await loadContent();
  const audio = createAudioEngine({ enabled: profile.settings.sound });

  const profileStore = createStore<Profile>(profile, (next) => void save.saveProfile(next));
  const progressStore = createStore<Progress>(progress, (next) => void save.saveProgress(next));
  const services: Services = {
    save,
    audio,
    analytics: createConsoleAnalytics(),
    i18n: createStore(i18n),
    content,
    hints: createHintClient(),
    config: createStore(defaultConfig as RemoteConfig),
    flags: createStore<ResolvedFlags>({ assignments: {}, flags: {} }),
    profile: profileStore,
    progress: progressStore,
  };
  render(<App services={services} />, root as HTMLElement);
}

bootstrap().catch((error: unknown) => {
  console.error(error);
  const { t } = createI18n('system');
  const box = document.createElement('div');
  box.className = 'fatal';
  const message = document.createElement('p');
  message.textContent = t('app.offlineRetry');
  const retry = document.createElement('button');
  retry.className = 'btn btn-primary';
  retry.textContent = t('app.retry');
  retry.onclick = () => location.reload();
  box.append(message, retry);
  (root as HTMLElement).replaceChildren(box);
});
