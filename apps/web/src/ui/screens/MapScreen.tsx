import type { JSX } from 'preact';
import { levelStatuses } from '../../game/unlocks';
import { Screen } from '../components/Screen';
import { useStore } from '../hooks/useStore';
import { useServices, useT } from '../services';

const WORLDS = [1, 2, 3] as const;

/** Three worlds of levels that open one by one (FR-16). */
export function MapScreen(): JSX.Element {
  const { content, progress, config } = useServices();
  const t = useT();
  const currentProgress = useStore(progress);
  const { disabledLevels } = useStore(config);
  const statuses = levelStatuses(content.manifest().levelOrder, new Set(disabledLevels), currentProgress);

  return (
    <Screen title={t('map.title')} back="/">
      {WORLDS.map((world) => {
        const ids = [...statuses.keys()].filter((id) => id.startsWith(`w${world}-`));
        if (ids.length === 0) return null;
        const worldLocked = ids.every((id) => statuses.get(id) === 'locked');
        return (
          <section
            key={world}
            class={`world${worldLocked ? ' world-locked' : ''}`}
            aria-labelledby={`world-${world}`}
          >
            <h2 id={`world-${world}`}>{t(`map.world${world}`)}</h2>
            <ul class="level-grid">
              {ids.map((id) => {
                const status = statuses.get(id);
                const n = Number(id.split('-')[1]);
                const stars = currentProgress.levels[id]?.stars ?? 0;
                const label = t(
                  status === 'solved'
                    ? 'map.levelSolved'
                    : status === 'open'
                      ? 'map.levelOpen'
                      : 'map.levelLocked',
                  { n, stars },
                );
                return (
                  <li key={id}>
                    {status === 'locked' ? (
                      <span class="level-node locked" role="img" aria-label={label}>
                        🔒
                      </span>
                    ) : (
                      <a class={`level-node ${status}`} href={`/play/${id}`} aria-label={label}>
                        <span>{n}</span>
                        {stars > 0 ? <small aria-hidden="true">{'★'.repeat(stars)}</small> : null}
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </Screen>
  );
}
