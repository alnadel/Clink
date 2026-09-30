import type { JSX } from 'preact';
import { useT } from '../services';

/** The one short line of guidance for the current onboarding or intro step. */
export function GuideBanner({ textKey }: { textKey: string | null }): JSX.Element | null {
  const t = useT();
  if (!textKey) return null;
  return (
    <p class="guide-banner" role="status">
      {t(textKey)}
    </p>
  );
}
