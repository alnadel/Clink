import type { JSX } from 'preact';
import { Screen } from '../components/Screen';
import { useT } from '../services';

/** A plain-language privacy notice (NFR-10). */
export function PrivacyScreen(): JSX.Element {
  const t = useT();
  return (
    <Screen title={t('privacy.title')} back="/settings">
      <div class="stack prose">
        <p>{t('privacy.body1')}</p>
        <p>{t('privacy.body2')}</p>
        <p>{t('privacy.body3')}</p>
      </div>
    </Screen>
  );
}
