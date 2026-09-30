import type { Analytics } from './events';

export interface ErrorContext {
  levelId: string | null;
}

/** Where errors go. The default reporter sends an analytics `error` event (no personal data). */
export interface ErrorReporter {
  report(error: Error, context: ErrorContext): void;
}

const MESSAGE_LIMIT = 500;
const STACK_LIMIT = 4000;
const DEDUPE_WINDOW_MS = 60_000;
const MAX_PER_SESSION = 20;

const truncate = (text: string, limit: number): string => (text.length > limit ? text.slice(0, limit) : text);

/** Drops repeats (same message and first stack line within 60 s) and caps errors at 20 per session. */
export function createErrorFilter(now: () => number = Date.now): {
  accept(message: string, stack: string): boolean;
} {
  const seen = new Map<string, number>();
  let accepted = 0;
  return {
    accept(message, stack) {
      const key = `${message}\n${stack.split('\n')[1] ?? stack.split('\n')[0] ?? ''}`;
      const current = now();
      const last = seen.get(key);
      if (last !== undefined && current - last < DEDUPE_WINDOW_MS) return false;
      if (accepted >= MAX_PER_SESSION) return false;
      seen.set(key, current);
      accepted++;
      return true;
    },
  };
}

/** Reports through analytics: message truncated to 500 characters and stack to 4,000 (FR-37). */
export function createAnalyticsErrorReporter(
  analytics: Analytics,
  filter = createErrorFilter(),
): ErrorReporter {
  return {
    report(error, context) {
      const stack = error.stack ?? '';
      if (!filter.accept(error.message, stack)) return;
      analytics.track('error', {
        message: truncate(error.message, MESSAGE_LIMIT),
        stack: truncate(stack, STACK_LIMIT),
        level_id: context.levelId,
      });
    },
  };
}

let currentLevelId: string | null = null;
let reporter: ErrorReporter | null = null;
const buffered: { error: Error; context: ErrorContext }[] = [];

/** The level being played, attached to any error reported while it is open. */
export function setCurrentLevelId(id: string | null): void {
  currentLevelId = id;
}

/** Reports an error, or holds it (up to 20) until a reporter is set. */
export function reportError(error: unknown, context: Partial<ErrorContext> = {}): void {
  const err = error instanceof Error ? error : new Error(String(error));
  const full = { levelId: context.levelId ?? currentLevelId };
  if (reporter) reporter.report(err, full);
  else if (buffered.length < MAX_PER_SESSION) buffered.push({ error: err, context: full });
}

/** Sets the reporter and delivers anything that happened before it existed (e.g. during bootstrap). */
export function setErrorReporter(next: ErrorReporter): void {
  reporter = next;
  for (const item of buffered.splice(0)) next.report(item.error, item.context);
}

/** Catches uncaught errors and unhandled rejections. Install this first, so bootstrap errors are caught. */
export function installErrorHandlers(): () => void {
  const onError = (event: ErrorEvent): void => reportError(event.error ?? new Error(event.message));
  const onRejection = (event: PromiseRejectionEvent): void => reportError(event.reason);
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);
  return () => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
  };
}
