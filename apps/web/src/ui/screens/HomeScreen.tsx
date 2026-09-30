import type { JSX } from 'preact';
import { levelStatuses, nextLevel } from '../../game/unlocks';
import { Screen } from '../components/Screen';
import { useStore } from '../hooks/useStore';
import { useServices, useT } from '../services';

/** The front door: continue, levels, songbook and settings (the daily joins in its own issue). */
export function HomeScreen(): JSX.Element {
  const { content, progress, config } = useServices();
  const t = useT();
  const currentProgress = useStore(progress);
  const { disabledLevels } = useStore(config);
  const next = nextLevel(
    levelStatuses(content.manifest().levelOrder, new Set(disabledLevels), currentProgress),
  );

  return (
    <Screen title={t('app.title')}>
      <nav class="stack home-nav">
        <a class="btn btn-primary" href={next ? `/play/${next}` : '/map'}>
          {t('home.continue')}
        </a>
        <a class="btn" href="/map">
          {t('home.map')}
        </a>
        <a class="btn" href="/songbook">
          {t('home.songbook')}
        </a>
        <a class="btn" href="/settings">
          {t('home.settings')}
        </a>
      </nav>
    </Screen>
  );
}
