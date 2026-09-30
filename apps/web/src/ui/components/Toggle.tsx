import type { JSX } from 'preact';

interface ToggleProps {
  label: string;
  checked: boolean;
  onChange(next: boolean): void;
}

/** An on/off switch with a visible label, at least 44 px tall. */
export function Toggle({ label, checked, onChange }: ToggleProps): JSX.Element {
  return (
    <label class="row">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange((event.currentTarget as HTMLInputElement).checked)}
      />
    </label>
  );
}
