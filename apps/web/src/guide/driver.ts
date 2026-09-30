import type { GuideStep } from '@clink/rules';
import { createGuideRunner, type GuideEvent, type GuideInput, type GuideRunner } from './runner';
import type { GuideScript } from './select';

export interface GuideFeedResult {
  /** The step completed by this input, as sent in ftue_step ("<script>:<step>"), or null. */
  completedStep: string | null;
  /** The script that finished with that step (to record as seen), or null. */
  finishedScript: string | null;
}

export interface GuideDriver {
  /** The step to show now, or null when nothing is active. */
  current(): GuideStep | null;
  allows(input: GuideInput): boolean;
  /** Feeds the events of one accepted input in order; a step completes at most once per input. */
  feed(events: readonly GuideEvent[]): GuideFeedResult;
}

/** Runs several guide scripts one after another. */
export function createGuideDriver(scripts: readonly GuideScript[]): GuideDriver {
  const runners: GuideRunner[] = scripts.map((script) => createGuideRunner(script.scriptId, script.steps));
  const active = (): GuideRunner | undefined => runners.find((runner) => runner.current() !== null);
  return {
    current: () => active()?.current() ?? null,
    allows: (input) => active()?.allows(input) ?? true,
    feed(events) {
      const runner = active();
      if (!runner) return { completedStep: null, finishedScript: null };
      for (const event of events) {
        const step = runner.notify(event);
        if (step) {
          return {
            completedStep: `${runner.scriptId}:${step.id}`,
            finishedScript: runner.current() === null ? runner.scriptId : null,
          };
        }
      }
      return { completedStep: null, finishedScript: null };
    },
  };
}
