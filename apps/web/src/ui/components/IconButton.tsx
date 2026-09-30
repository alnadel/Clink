import type { ComponentChildren, JSX } from 'preact';

interface IconButtonProps {
  /** Required: the accessible name, since the visible content is an icon. */
  label: string;
  children: ComponentChildren;
  onClick?: () => void;
  disabled?: boolean;
}

/** A square icon button, at least 44 x 44 px (NFR-09). */
export function IconButton({ label, children, ...rest }: IconButtonProps): JSX.Element {
  return (
    <button type="button" class="icon-btn" aria-label={label} title={label} {...rest}>
      {children}
    </button>
  );
}
