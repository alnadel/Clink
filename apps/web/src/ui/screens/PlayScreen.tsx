import type { JSX } from 'preact';
import { Screen } from '../components/Screen';
import { useT } from '../services';

interface PlayScreenProps {
  levelId?: string;
  kind?: 'campaign' | 'daily';
}

// Placeholder: replaced by the play screen issue.
export function PlayScreen({ levelId = '', kind = 'campaign' }: PlayScreenProps): JSX.Element {
  const t = useT();
  return (
    <Screen title={t('play.level', { n: levelId })} back="/map">
      <div data-screen="play" data-kind={kind} data-level={levelId} />
    </Screen>
  );
}
