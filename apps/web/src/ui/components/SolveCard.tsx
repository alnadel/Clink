import type { JSX } from 'preact';
import { useT } from '../services';
import { Button } from './Button';
import { Modal } from './Modal';

interface SolveCardProps {
  stars: 1 | 2 | 3;
  moves: number;
  par: number;
  tuneTitle: string;
  tuneOrigin: string;
  kind: 'campaign' | 'daily';
  hasNext: boolean;
  onNext(): void;
  onReplay(): void;
  onRetry(): void;
  onMap(): void;
  onHome(): void;
  onShare?(): void;
}

/** The win card: stars, moves against par, and the tune the player just performed. */
export function SolveCard(props: SolveCardProps): JSX.Element {
  const t = useT();
  return (
    <Modal title={t('solve.title')}>
      <div class="stack solve-card">
        <p class="stars" role="img" aria-label={`${props.stars} / 3`}>
          {'★'.repeat(props.stars)}
          {'☆'.repeat(3 - props.stars)}
        </p>
        <p>{t('solve.moves', { moves: props.moves, par: props.par })}</p>
        <p class="tune">
          <strong>{props.tuneTitle}</strong>
          <br />
          <span class="muted">{props.tuneOrigin}</span>
        </p>
        {props.kind === 'campaign' ? (
          <>
            <Button variant="primary" onClick={props.hasNext ? props.onNext : props.onMap}>
              {props.hasNext ? t('solve.next') : t('solve.map')}
            </Button>
            <Button onClick={props.onReplay}>{t('solve.replay')}</Button>
            <Button onClick={props.onRetry}>{t('solve.retry')}</Button>
            {props.hasNext ? <Button onClick={props.onMap}>{t('solve.map')}</Button> : null}
          </>
        ) : (
          <>
            <Button variant="primary" onClick={props.onShare}>
              {t('solve.share')}
            </Button>
            <Button onClick={props.onReplay}>{t('solve.replay')}</Button>
            <Button onClick={props.onHome}>{t('solve.home')}</Button>
          </>
        )}
      </div>
    </Modal>
  );
}
