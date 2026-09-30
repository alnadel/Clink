import type { JSX } from 'preact';
import { useLocation } from 'preact-iso';
import { Button } from './components/Button';
import { Modal } from './components/Modal';
import { useStore } from './hooks/useStore';
import { useServices, useT } from './services';

/**
 * The first-launch choice (FR-14). "Play with sound" unlocks audio synchronously inside the click
 * handler, so iOS accepts it; "Play muted" never creates an AudioContext.
 */
export function SoundChoice(): JSX.Element | null {
  const { audio, profile, progress, content, analytics } = useServices();
  const t = useT();
  const location = useLocation();
  const current = useStore(profile);
  if (current.soundChoiceMade) return null;

  const choose = (sound: boolean) => {
    if (sound) void audio.unlock();
    audio.setEnabled(sound);
    analytics.track('setting_change', { setting: 'sound', value: String(sound) });
    profile.update((p) => ({ ...p, soundChoiceMade: true, settings: { ...p.settings, sound } }));
    const isLink = location.path.startsWith('/d/');
    const first = content.manifest().levelOrder[0];
    if (!isLink && first && Object.keys(progress.get().levels).length === 0) location.route(`/play/${first}`);
  };

  return (
    <Modal title={t('sound.title')}>
      <div class="stack">
        <Button variant="primary" onClick={() => choose(true)}>
          {t('sound.withSound')}
        </Button>
        <Button onClick={() => choose(false)}>{t('sound.muted')}</Button>
      </div>
    </Modal>
  );
}
