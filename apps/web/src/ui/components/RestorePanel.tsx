import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import {
  decodeRestoreCode,
  encodeRestoreCode,
  mergeRestoreData,
  progressToRestoreData,
  type RestoreData,
} from '../../save/restore-code';
import { useStore } from '../hooks/useStore';
import { useServices, useT } from '../services';
import { replaceSettings } from '../settings';
import { Button } from './Button';
import { showToast } from './Toast';

/** Shows the player's restore code (with copy buttons). */
export function ExportCode(): JSX.Element {
  const { content, progress, profile } = useServices();
  const t = useT();
  const currentProgress = useStore(progress);
  const { settings } = useStore(profile);
  const code = encodeRestoreCode(
    progressToRestoreData(currentProgress, content.manifest().levelOrder, settings),
  );
  const link = `${window.location.origin}/restore#${code}`;
  const copy = (text: string) => {
    void navigator.clipboard?.writeText(text).then(() => showToast(t('settings.copied')));
  };
  return (
    <div class="stack">
      <p class="muted">{t('settings.exportHelp')}</p>
      <output class="code" data-testid="restore-code">
        {code}
      </output>
      <div class="row-buttons">
        <Button onClick={() => copy(code)}>{t('settings.copy')}</Button>
        <Button onClick={() => copy(link)}>{t('settings.copyLink')}</Button>
      </div>
    </div>
  );
}

/** A field to paste a restore code, a summary of what it holds, and a Confirm button. */
export function ImportCode({ initialCode = '' }: { initialCode?: string }): JSX.Element {
  const services = useServices();
  const t = useT();
  const [text, setText] = useState(initialCode);
  const [pending, setPending] = useState<RestoreData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const check = (value: string) => {
    const result = decodeRestoreCode(value);
    if (result.ok) {
      setPending(result.data);
      setError(null);
    } else {
      setPending(null);
      setError(t(`restore.error.${result.error}`));
    }
  };

  const confirm = () => {
    if (!pending) return;
    const { content, progress } = services;
    progress.update((p) => mergeRestoreData(p, pending, content.manifest().levelOrder));
    replaceSettings(services, pending.settings);
    setPending(null);
    setText('');
    showToast(t('restore.done'));
  };

  const levels = pending?.levelStars.filter((s) => s > 0).length ?? 0;
  const dailies = pending?.dailyStars.filter((s) => s > 0).length ?? 0;

  return (
    <div class="stack">
      <label class="stack">
        <span>{t('settings.import')}</span>
        <input
          class="text-input"
          type="text"
          value={text}
          placeholder={t('settings.importPlaceholder')}
          autoCapitalize="characters"
          autoComplete="off"
          spellcheck={false}
          onInput={(event) => setText((event.currentTarget as HTMLInputElement).value)}
        />
      </label>
      <Button onClick={() => check(text)}>{t('settings.importCheck')}</Button>
      {error ? (
        <p class="error" role="alert">
          {error}
        </p>
      ) : null}
      {pending ? (
        <div class="stack" role="status">
          <p>{t('restore.summary', { levels, dailies })}</p>
          <Button variant="primary" onClick={confirm}>
            {t('restore.confirm')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
