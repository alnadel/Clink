import type { ComponentChildren, JSX } from 'preact';

interface ButtonProps {
  children: ComponentChildren;
  onClick?: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  type?: 'button' | 'submit';
  'aria-label'?: string;
}

/** A text button, at least 44 px tall (NFR-09). */
export function Button({
  children,
  variant = 'secondary',
  type = 'button',
  ...rest
}: ButtonProps): JSX.Element {
  return (
    <button type={type} class={`btn btn-${variant}`} {...rest}>
      {children}
    </button>
  );
}
