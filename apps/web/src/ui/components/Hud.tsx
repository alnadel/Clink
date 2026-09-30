import type { JSX } from 'preact';
import { IconButton } from '../components/IconButton';
import { useT } from '../services';

interface HudProps {
  title: string;
  back: string;
  moves: number;
  par: number;
  canUndo: boolean;
  canRestart: boolean;
  hintReady: boolean;
  onUndo(): void;
  onRestart(): void;
  onHint(): void;
}

/** The bar above the board: back, title, moves against par, undo, restart and hint (all 44 px or more). */
export function Hud(props: HudProps): JSX.Element {
  const t = useT();
  return (
    <header class="hud">
      <a class="icon-btn" href={props.back} aria-label={t('play.back')}>
        ‹
      </a>
      <div class="hud-title">
        <h1>{props.title}</h1>
        <p class="hud-moves">{t('play.moves', { moves: props.moves, par: props.par })}</p>
      </div>
      <IconButton label={t('play.undo')} onClick={props.onUndo} disabled={!props.canUndo}>
        ↶
      </IconButton>
      <IconButton label={t('play.restart')} onClick={props.onRestart} disabled={!props.canRestart}>
        ⟳
      </IconButton>
      <IconButton label={t('play.hint')} onClick={props.onHint} disabled={!props.hintReady}>
        ?
      </IconButton>
    </header>
  );
}
