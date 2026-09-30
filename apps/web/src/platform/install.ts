import type { Profile } from '../save/types';

/** The (non-standard) event Chromium fires when the app can be installed. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;

/** Starts listening for the install event. Call once at startup; `onInstalled` fires after an install. */
export function captureInstallPrompt(onInstalled: () => void): void {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    onInstalled();
  });
}

export function isInstalled(): boolean {
  return (
    matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isIosSafari(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) && !/CriOS|FxiOS/.test(navigator.userAgent);
}

export const canPromptNatively = (): boolean => deferred !== null;

/** Shows the browser's install dialog. Resolves true if the player accepted. */
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  const event = deferred;
  deferred = null;
  await event.prompt();
  return (await event.userChoice).outcome === 'accepted';
}

/** Levels after whose first solve the install prompt is offered (D18). */
export const INSTALL_PROMPT_LEVELS: readonly string[] = ['w1-05', 'w1-15'];
/** The level after whose first solve the one-question survey is asked (D19). */
export const SURVEY_LEVEL = 'w1-10';

/** Install prompt: first solve of w1-05 or w1-15, not installed, shown at most twice (FR-34, D18). */
export function shouldShowInstallPrompt(
  levelId: string,
  firstSolve: boolean,
  profile: Pick<Profile, 'installPromptCount'>,
  installed: boolean,
): boolean {
  return (
    firstSolve && INSTALL_PROMPT_LEVELS.includes(levelId) && !installed && profile.installPromptCount < 2
  );
}

/** Survey: first solve of w1-10, once per device (D19). */
export function shouldShowSurvey(levelId: string, firstSolve: boolean, surveyAnswered: boolean): boolean {
  return firstSolve && levelId === SURVEY_LEVEL && !surveyAnswered;
}
