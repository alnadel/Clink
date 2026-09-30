import type { JSX } from 'preact';
import { ImportCode } from '../components/RestorePanel';
import { Screen } from '../components/Screen';
import { useT } from '../services';

/** /restore#CODE: opens the import with the code already filled in (FR-33). */
export function RestoreScreen(): JSX.Element {
  const t = useT();
  const code = decodeURIComponent(window.location.hash.slice(1));
  return (
    <Screen title={t('restore.title')} back="/">
      <ImportCode initialCode={code} />
    </Screen>
  );
}
