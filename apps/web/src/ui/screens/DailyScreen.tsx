import type { JSX } from 'preact';
import { todaysPuzzle } from '../../daily/today';
import { Screen } from '../components/Screen';
import { useStore } from '../hooks/useStore';
import { useServices, useT } from '../services';
import { PlayScreen } from './PlayScreen';

/** Today's puzzle, the same for everyone (rule 17). Opens the play screen on it. */
export function DailyScreen(): JSX.Element {
  const { content, config } = useServices();
  const t = useT();
  const { dailyOverrides } = useStore(config);
  const today = todaysPuzzle(new Date(), content.manifest().schedule, dailyOverrides);
  if (!today) {
    return (
      <Screen title={t('home.dailyTitle')} back="/">
        <p class="muted center">{t('daily.none')}</p>
      </Screen>
    );
  }
  return (
    <PlayScreen kind="daily" target={{ kind: 'daily', levelId: today.levelId, puzzleNo: today.puzzleNo }} />
  );
}
