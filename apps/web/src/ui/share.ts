import { shareText } from '../daily/share';
import type { ShareCardInput } from '../daily/types';

export type ShareOutcome = 'share' | 'clipboard' | 'cancelled' | 'failed';

interface ShareDeps {
  nav: Pick<Navigator, 'share' | 'clipboard'> | { share?: undefined; clipboard?: Navigator['clipboard'] };
}

/**
 * Shares the spoiler-free result card (FR-22): the Web Share API where available, else the clipboard.
 * A cancelled share sheet is not an error and reports nothing.
 */
export async function shareResult(
  input: ShareCardInput,
  deps: ShareDeps = { nav: navigator },
): Promise<ShareOutcome> {
  const text = shareText(input);
  const { nav } = deps;
  if (typeof nav.share === 'function') {
    try {
      await nav.share({ text });
      return 'share';
    } catch {
      return 'cancelled';
    }
  }
  try {
    await nav.clipboard?.writeText(text);
    return nav.clipboard ? 'clipboard' : 'failed';
  } catch {
    return 'failed';
  }
}
