import type { ToolName } from '@clink/rules';

export type KeyAction =
  | { type: 'glass'; index: number }
  | { type: 'tool'; tool: ToolName }
  | { type: 'melody' }
  | { type: 'undo' };

export interface KeyInput {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  /** The tag name of the focused element, upper case (e.g. "BUTTON"). */
  targetTag?: string;
  isContentEditable?: boolean;
}

const TEXT_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);
const CONTROL_TAGS = new Set(['BUTTON', 'A', ...TEXT_TAGS]);

/**
 * Desktop keys for the play screen (docs/architecture/10 §5): 1-5 tap glasses, F the faucet, S the sink,
 * Space plays the melody, Z undoes. Ignored while typing, with a modifier held, and (for Space) on a control.
 */
export function actionForKey(input: KeyInput): KeyAction | null {
  if (input.ctrlKey || input.metaKey || input.altKey) return null;
  const tag = input.targetTag ?? '';
  if (TEXT_TAGS.has(tag) || input.isContentEditable) return null;
  const key = input.key.toLowerCase();
  if (/^[1-5]$/.test(key)) return { type: 'glass', index: Number(key) - 1 };
  if (key === 'f') return { type: 'tool', tool: 'faucet' };
  if (key === 's') return { type: 'tool', tool: 'sink' };
  if (key === 'z') return { type: 'undo' };
  if (key === ' ' && !CONTROL_TAGS.has(tag)) return { type: 'melody' };
  return null;
}
