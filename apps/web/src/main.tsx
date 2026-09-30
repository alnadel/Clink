import type { RemoteConfig } from '@clink/rules';
import { render } from 'preact';
import defaultConfig from '../../../content/config.json';
import { App } from './app';
import { createAudioEngine } from './audio/engine';
import { loadContent } from './content/store';
import { createI18n } from './i18n/i18n';
import { createStore } from './lib/store';
import {
  createConsoleAdapter,
  createHttpAdapter,
  createMemoryAdapter,
  createNullAdapter,
} from './ops/adapters';
import { createAnalytics } from './ops/analytics';
import { loadRemoteConfig, startConfigRefresh } from './ops/config';
import {
  createAnalyticsErrorReporter,
  installErrorHandlers,
  reportError,
  setErrorReporter,
} from './ops/errors';
import { type ResolvedFlags, resolveFlags } from './ops/flags';
import { browserOf, platformOf, shouldStartSession } from './ops/session';
import { createSaveStore, idbBackend } from './save/store';
import type { Profile, Progress } from './save/types';
import './styles/global.css';
import { createHaptics } from './platform/haptics';
import { captureInstallPrompt } from './platform/install';
import { registerServiceWorker, whenControlled } from './platform/sw';
import { installTestHook, registerTestTarget } from './testing/hook';
import { unlockProgress } from './testing/unlock';
import { showToast } from './ui/components/Toast';
import type { Services } from './ui/services';
import { createHintClient } from './workers/hint-client';

if (import.meta.env.MODE === 'e2e') installTestHook();

// First, so errors during bootstrap are caught and held until a reporter exists (FR-37).
installErrorHandlers();

const root = document.getElementById('app');
if (!root) throw new Error('#app not found');

/** Bootstrap order: docs/architecture/05 §13. */
async function bootstrap(): Promise<void> {
  const backend = idbBackend();
  const save = createSaveStore(backend);
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

  const fallbackConfig = defaultConfig as unknown as RemoteConfig;
  const [content, remoteConfig] = await Promise.all([
    loadContent(),
    loadRemoteConfig({ backend, fallback: fallbackConfig }),
  ]);

  const profileStore = createStore<Profile>(
    profile,
    (next) => void save.saveProfile(next).catch(reportError),
  );
  const progressStore = createStore<Progress>(
    progress,
    (next) => void save.saveProgress(next).catch(reportError),
  );
  // End-to-end builds only: `?unlock=<levelId|all>` skips the levels before it.
  const unlock = import.meta.env.MODE === 'e2e' ? params.get('unlock') : null;
  if (unlock) {
    progressStore.update((p) => unlockProgress(p, content.manifest().levelOrder, unlock));
  }
  const configStore = createStore(remoteConfig);
  const flagsStore = createStore<ResolvedFlags>(resolveFlags(remoteConfig, profile.deviceId));

  // Testers are excluded at the source in production. Without a collector address (DEC-7), production sends nothing.
  const collector = import.meta.env.VITE_ANALYTICS_URL;
  const memory =
    import.meta.env.MODE === 'e2e' && params.get('analytics') === 'memory' ? createMemoryAdapter() : null;
  const adapter =
    memory ??
    (profile.tester
      ? createNullAdapter()
      : import.meta.env.DEV
        ? createConsoleAdapter()
        : collector
          ? createHttpAdapter(collector)
          : createNullAdapter());
  const analytics = createAnalytics({ adapter, profile: profileStore, backend, appVersion: __APP_VERSION__ });
  await analytics.init();
  setErrorReporter(createAnalyticsErrorReporter(analytics));
  if (import.meta.env.MODE === 'e2e' && memory) registerTestTarget({ events: () => memory.events() });
  if (params.get('debug') === 'throw') setTimeout(() => reportError(new Error('clink test error')), 1000);

  const audio = createAudioEngine({ enabled: profile.settings.sound });
  audio.onStatusChange((state) => {
    analytics.track('audio_state', { state, sound_on: profileStore.get().settings.sound });
  });

  // Sessions start on launch and after 30 minutes idle; flags are resolved once per session (D27, FR-39).
  const startSession = (): void => {
    const current = profileStore.get();
    flagsStore.set(resolveFlags(configStore.get(), current.deviceId));
    analytics.startSession({
      platform: platformOf(navigator.userAgent, navigator.maxTouchPoints),
      browser: browserOf(navigator.userAgent),
      installed:
        matchMedia('(display-mode: standalone)').matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true,
      locale: i18n.locale,
      sound_on: current.settings.sound,
      app_version: __APP_VERSION__,
      ab_flags: flagsStore.get().assignments,
      source: current.source,
      tester: current.tester,
    });
  };
  startSession();
  setInterval(() => void analytics.flush(), 10_000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void analytics.flush();
    else if (shouldStartSession(profileStore.get().lastActiveAt, Date.now())) startSession();
  });
  window.addEventListener('pagehide', () => void analytics.flush());
  document.addEventListener('pointerdown', () => analytics.touch(), { capture: true });
  startConfigRefresh(configStore, { backend, fallback: fallbackConfig });

  const services: Services = {
    save,
    audio,
    analytics,
    i18n: createStore(i18n),
    content,
    hints: createHintClient(),
    config: configStore,
    flags: flagsStore,
    profile: profileStore,
    progress: progressStore,
    haptics: createHaptics(() => profileStore.get().settings.vibration),
  };
  render(<App services={services} />, root as HTMLElement);

  captureInstallPrompt(() =>
    analytics.track('install', { platform: platformOf(navigator.userAgent, navigator.maxTouchPoints) }),
  );
  registerServiceWorker(() => showToast(services.i18n.get().t('app.updated')));
  // Cache every level pack a few seconds after start, once the service worker is in charge (FR-35).
  void whenControlled().then(() => {
    setTimeout(() => {
      void content.warm().then(() => {
        if (import.meta.env.MODE === 'e2e') registerTestTarget({ warmed: () => true });
      });
    }, 5000);
  });
  // Ask the browser not to evict our saves, after the first user gesture (NFR-08).
  document.addEventListener('pointerdown', () => void save.requestPersistence(), { once: true });
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
