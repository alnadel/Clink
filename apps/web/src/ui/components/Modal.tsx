import type { ComponentChildren, JSX } from 'preact';
import { useEffect, useRef } from 'preact/hooks';

interface ModalProps {
  title: string;
  children: ComponentChildren;
  /** Omit for a modal that must be answered (e.g. the first-launch sound choice). */
  onClose?: () => void;
}

const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

/** An accessible dialog: traps focus, closes on Escape, and returns focus to its trigger. */
export function Modal({ title, children, onClose }: ModalProps): JSX.Element {
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const root = dialog.current;
    root?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && onClose) {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !root) return;
      const items = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)];
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previous?.focus?.();
    };
  }, [onClose]);

  return (
    <div class="modal-backdrop">
      <div class="modal" role="dialog" aria-modal="true" aria-label={title} ref={dialog}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}
