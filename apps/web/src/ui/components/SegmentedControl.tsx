import type { JSX } from 'preact';

interface SegmentedControlProps<T extends string> {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange(next: T): void;
}

/** A group of native radio inputs styled as buttons for choosing one value. */
export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: SegmentedControlProps<T>): JSX.Element {
  return (
    <fieldset class="row segmented">
      <legend class="sr-only">{label}</legend>
      <span aria-hidden="true">{label}</span>
      <span class="segments">
        {options.map((option) => (
          <label key={option.value} class={`segment${option.value === value ? ' selected' : ''}`}>
            <input
              class="sr-only"
              type="radio"
              name={label}
              value={option.value}
              checked={option.value === value}
              onChange={() => onChange(option.value)}
            />
            {option.label}
          </label>
        ))}
      </span>
    </fieldset>
  );
}
