import type { GuideStep, GuideTrigger, ToolName } from '@clink/rules';

/** What the player is trying to do; checked against the current step's `allow`. */
export type GuideInput =
  | { kind: 'glass'; glass: number }
  | { kind: 'tool'; tool: ToolName }
  | { kind: 'melody' }
  | { kind: 'undo' }
  | { kind: 'hint' };

/** What just happened; matched against the current step's `until`. */
export type GuideEvent = GuideTrigger;

export interface GuideRunner {
  readonly scriptId: string;
  /** The step being shown, or null when the script has finished. */
  current(): GuideStep | null;
  /** False if the current step's `allow` excludes this input. Omitted `allow` fields mean allowed. */
  allows(input: GuideInput): boolean;
  /** Advances if the event matches the current step's `until`; returns the step it completed. */
  notify(event: GuideEvent): GuideStep | null;
}

/** An event matches when `on` is equal and every field set in `until` is equal in the event. `tap` matches anything. */
export function matches(until: GuideTrigger, event: GuideEvent): boolean {
  if (until.on === 'tap') return true;
  if (until.on !== event.on) return false;
  const wanted = until as Record<string, unknown>;
  const actual = event as Record<string, unknown>;
  return Object.keys(wanted).every(
    (key) => key === 'on' || wanted[key] === undefined || wanted[key] === actual[key],
  );
}

/** Runs one guide script (docs/architecture/05 §8). */
export function createGuideRunner(scriptId: string, steps: readonly GuideStep[]): GuideRunner {
  let index = 0;
  return {
    scriptId,
    current: () => steps[index] ?? null,
    allows(input) {
      const allow = steps[index]?.allow;
      if (!allow) return true;
      switch (input.kind) {
        case 'glass':
          return allow.glasses === undefined || allow.glasses.includes(input.glass);
        case 'tool':
          return allow.tools === undefined || allow.tools.includes(input.tool);
        case 'melody':
          return allow.melody !== false;
        case 'undo':
          return allow.undo !== false;
        case 'hint':
          return allow.hint !== false;
      }
    },
    notify(event) {
      const step = steps[index];
      if (!step || !matches(step.until, event)) return null;
      index++;
      return step;
    },
  };
}
