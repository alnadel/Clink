import type { ComponentChildren, JSX } from 'preact';
import { useServices, useT } from '../services';

interface ScreenProps {
  title: string;
  /** Where the back button goes; omit for no back button. */
  back?: string;
  children: ComponentChildren;
}

/** A page with a header and an optional back button. */
export function Screen({ title, back, children }: ScreenProps): JSX.Element {
  const t = useT();
  useServices();
  return (
    <div class="screen">
      <header class="screen-header">
        {back ? (
          <a class="icon-btn back-link" href={back} aria-label={t('play.back')}>
            ‹
          </a>
        ) : null}
        <h1>{title}</h1>
      </header>
      <main class="screen-body">{children}</main>
    </div>
  );
}
