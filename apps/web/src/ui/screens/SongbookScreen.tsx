import type { LevelJson } from '@clink/rules';
import type { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { solvedLevelIds, songbookEntries } from '../../game/songbook';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { useStore } from '../hooks/useStore';
import { useServices, useT } from '../services';

/** Every tune the player has solved, once each, replayable (FR-17). */
export function SongbookScreen(): JSX.Element {
  const { content, progress, config, audio } = useServices();
  const t = useT();
  const currentProgress = useStore(progress);
  const { dailyOverrides } = useStore(config);
  const [levels, setLevels] = useState<ReadonlyMap<string, LevelJson>>(new Map());

  const manifest = content.manifest();
  const ids = solvedLevelIds(currentProgress, manifest, dailyOverrides).join(',');
  useEffect(() => {
    let cancelled = false;
    const wanted = ids === '' ? [] : ids.split(',');
    void Promise.all(wanted.map((id) => content.levelJson(id).catch(() => null))).then((loaded) => {
      if (cancelled) return;
      setLevels(new Map(loaded.flatMap((level) => (level ? [[level.id, level] as const] : []))));
    });
    return () => {
      cancelled = true;
    };
  }, [ids, content]);

  const entries = songbookEntries(currentProgress, manifest, levels, dailyOverrides);

  const play = async (levelId: string): Promise<void> => {
    if (audio.status === 'locked') void audio.unlock();
    const level = await content.level(levelId);
    audio.playPhrase(
      level.melody.notes.map((pos) => level.positions[pos]?.hz ?? 440),
      level.melody.beats,
      level.melody.bpm,
    );
  };

  return (
    <Screen title={t('home.songbook')} back="/">
      {entries.length === 0 ? (
        <p class="muted center">{t('songbook.empty')}</p>
      ) : (
        <ul class="songbook">
          {entries.map((entry) => (
            <li key={entry.tuneId}>
              <div>
                <strong>{entry.title}</strong>
                <br />
                <span class="muted">{entry.origin}</span>
              </div>
              <Button
                onClick={() => void play(entry.levelId)}
                aria-label={`${t('songbook.play')} ${entry.title}`}
              >
                ▶
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Screen>
  );
}
