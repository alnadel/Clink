import { compileLevel, type GuideStep, type GuidesFile } from '@clink/rules';
import { describe, expect, it } from 'vitest';
import { fxToolsJson, w108Json } from '../../test/fixtures';
import { createGuideDriver } from './driver';
import { createGuideRunner, matches } from './runner';
import { selectScripts } from './select';

const step = (id: string, extra: Partial<GuideStep> = {}): GuideStep => ({
  id,
  textKey: null,
  until: { on: 'tap' },
  ...extra,
});

describe('matches', () => {
  it('needs the same event, and every set field equal', () => {
    expect(matches({ on: 'pour' }, { on: 'pour', from: 2, to: 1 })).toBe(true);
    expect(matches({ on: 'pour', from: 2 }, { on: 'pour', from: 2, to: 1 })).toBe(true);
    expect(matches({ on: 'pour', from: 2 }, { on: 'pour', from: 0, to: 1 })).toBe(false);
    expect(matches({ on: 'ring', glass: 2 }, { on: 'pour', from: 2, to: 1 })).toBe(false);
    expect(matches({ on: 'found', target: 0 }, { on: 'found', target: 1 })).toBe(false);
  });

  it('a tap step matches any event', () => {
    expect(matches({ on: 'tap' }, { on: 'melody' })).toBe(true);
    expect(matches({ on: 'tap' }, { on: 'tuned' })).toBe(true);
  });
});

describe('createGuideRunner', () => {
  it('advances on a matching event and finishes after the last step', () => {
    const runner = createGuideRunner('s', [
      step('a', { until: { on: 'ring', glass: 2 } }),
      step('b', { until: { on: 'pour' } }),
    ]);
    expect(runner.current()?.id).toBe('a');
    expect(runner.notify({ on: 'pour', from: 0, to: 1 })).toBeNull();
    expect(runner.notify({ on: 'ring', glass: 2 })?.id).toBe('a');
    expect(runner.notify({ on: 'pour', from: 2, to: 1 })?.id).toBe('b');
    expect(runner.current()).toBeNull();
    expect(runner.notify({ on: 'tap' })).toBeNull();
  });

  it('filters input by allow, and allows everything when allow is omitted', () => {
    const open = createGuideRunner('s', [step('a')]);
    expect(open.allows({ kind: 'glass', glass: 4 })).toBe(true);
    const narrow = createGuideRunner('s', [
      step('a', { allow: { glasses: [2], melody: false, undo: false } }),
    ]);
    expect(narrow.allows({ kind: 'glass', glass: 2 })).toBe(true);
    expect(narrow.allows({ kind: 'glass', glass: 0 })).toBe(false);
    expect(narrow.allows({ kind: 'melody' })).toBe(false);
    expect(narrow.allows({ kind: 'undo' })).toBe(false);
    expect(narrow.allows({ kind: 'hint' })).toBe(true);
    expect(narrow.allows({ kind: 'tool', tool: 'faucet' })).toBe(true);
  });

  it('everything is allowed once the script has finished', () => {
    const runner = createGuideRunner('s', [step('a', { allow: { glasses: [2] } })]);
    runner.notify({ on: 'tap' });
    expect(runner.allows({ kind: 'glass', glass: 0 })).toBe(true);
  });
});

describe('createGuideDriver', () => {
  it('runs scripts in order and reports completions and finished scripts', () => {
    const driver = createGuideDriver([
      { scriptId: 'one', steps: [step('a'), step('b')] },
      { scriptId: 'two', steps: [step('c')] },
    ]);
    expect(driver.current()?.id).toBe('a');
    expect(driver.feed([{ on: 'tap' }])).toEqual({ completedStep: 'one:a', finishedScript: null });
    expect(driver.feed([{ on: 'tap' }])).toEqual({ completedStep: 'one:b', finishedScript: 'one' });
    expect(driver.current()?.id).toBe('c');
    expect(driver.feed([{ on: 'tap' }])).toEqual({ completedStep: 'two:c', finishedScript: 'two' });
    expect(driver.current()).toBeNull();
    expect(driver.feed([{ on: 'tap' }])).toEqual({ completedStep: null, finishedScript: null });
  });

  it('completes at most one step per input', () => {
    const driver = createGuideDriver([{ scriptId: 's', steps: [step('a'), step('b')] }]);
    const result = driver.feed([{ on: 'ring', glass: 0 }, { on: 'tap' }]);
    expect(result.completedStep).toBe('s:a');
    expect(driver.current()?.id).toBe('b');
  });
});

describe('selectScripts', () => {
  const guides: GuidesFile = {
    schemaVersion: 1,
    levels: { 'w1-08': [step('own')], 'w1-08:b': [step('variant-b')] },
    intros: { faucet: [step('f')], sink: [step('s')], ice: [step('i')] },
    linkTutorial: [],
  };
  const plain = compileLevel(w108Json());
  const tools = compileLevel(fxToolsJson());

  it('an unseen level script wins, preferring the A/B variant', () => {
    expect(selectScripts('w1-08', plain, guides, [], 'a')).toEqual([
      { scriptId: 'level:w1-08', steps: [step('own')] },
    ]);
    expect(selectScripts('w1-08', plain, guides, [], 'b')[0]?.steps[0]?.id).toBe('variant-b');
  });

  it('a seen level script is skipped, and a level with no mechanics gets nothing', () => {
    expect(selectScripts('w1-08', plain, guides, ['level:w1-08'], 'a')).toEqual([]);
  });

  it('a faucet and sink level gets the faucet intro then the sink intro', () => {
    const scripts = selectScripts('fx-tools', tools, guides, [], 'a');
    expect(scripts.map((s) => s.scriptId)).toEqual(['intro:faucet', 'intro:sink']);
    expect(selectScripts('fx-tools', tools, guides, ['intro:faucet'], 'a').map((s) => s.scriptId)).toEqual([
      'intro:sink',
    ]);
  });
});
