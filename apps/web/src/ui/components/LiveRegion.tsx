import type { JSX } from 'preact';

/** A visually hidden region that screen readers announce when its text changes (NFR-09). */
export function LiveRegion({ text }: { text: string }): JSX.Element {
  return (
    <div class="sr-only" role="status" aria-live="polite" aria-atomic="true">
      {text}
    </div>
  );
}
