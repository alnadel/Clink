import type { JSX } from 'preact';
import { Screen } from '../components/Screen';
import { useT } from '../services';

// Placeholder: replaced by the issue that owns this screen.
export function SongbookScreen(): JSX.Element {
  const t = useT();
  return (
    <Screen title={t('app.title')}>
      <div data-screen="songbook" />
    </Screen>
  );
}
