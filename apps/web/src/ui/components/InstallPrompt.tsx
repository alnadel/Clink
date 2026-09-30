import type { JSX } from 'preact';
import { canPromptNatively, isIosSafari, promptInstall } from '../../platform/install';
import { useT } from '../services';
import { Button } from './Button';
import { Modal } from './Modal';

/** Invites the player to install: the browser's own dialog, or Add to Home Screen steps on iOS (FR-34). */
export function InstallPrompt({ onClose }: { onClose(): void }): JSX.Element {
  const t = useT();
  const native = canPromptNatively();
  return (
    <Modal title={t('install.title')} onClose={onClose}>
      <div class="stack">
        <p>{t('install.why')}</p>
        {native ? (
          <Button
            variant="primary"
            onClick={() => {
              void promptInstall().then(onClose);
            }}
          >
            {t('install.button')}
          </Button>
        ) : isIosSafari() ? (
          <ol class="steps">
            <li>{t('install.ios1')}</li>
            <li>{t('install.ios2')}</li>
            <li>{t('install.ios3')}</li>
          </ol>
        ) : null}
        <Button onClick={onClose}>{t('install.later')}</Button>
      </div>
    </Modal>
  );
}
