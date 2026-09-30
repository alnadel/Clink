import { compileLevel, type LevelJson } from '@clink/rules';
import { describe, expect, it } from 'vitest';
import { loadContent } from '../src/load';
import { CONTENT_DIR } from '../src/paths';
import { buildGuides, PHRASES, planCampaign, planDaily } from '../src/seed';
import { tempContent } from './helpers';

const bands = () => {
  const content = loadContent(tempContent());
  if (!content.bands || !content.tunes) throw new Error('content missing');
  return { bands: content.bands, tunes: content.tunes };
};

describe('seed plan', () => {
  it('plans 60 campaign levels (20 per world) and 60 dailies with unique ids', () => {
    const campaign = planCampaign();
    expect(campaign).toHaveLength(60);
    for (const world of [1, 2, 3]) expect(campaign.filter((s) => s.world === world)).toHaveLength(20);
    const ids = [...campaign, ...planDaily()].map((s) => s.id);
    expect(new Set(ids).size).toBe(120);
    expect(planDaily()).toHaveLength(60);
  });

  it('every slot points at a phrase that exists and fits the world (so generation cannot crash)', () => {
    const { bands: b, tunes } = bands();
    for (const slot of [...planCampaign(), ...planDaily()]) {
      const [tuneId, phraseId] = slot.phrases[0] ?? ['', ''];
      const phrase =
        PHRASES[tuneId]?.find((p) => p.id === phraseId) ??
        tunes.tunes[tuneId]?.phrases.find((p) => p.id === phraseId);
      expect(phrase, `${slot.id}: ${tuneId}/${phraseId}`).toBeDefined();
      if (!phrase) continue;
      const rules = b.worlds[String(slot.world) as '1' | '2' | '3'];
      const targets = new Set(phrase.notes).size;
      expect(targets, `${slot.id} needs ${targets} glasses`).toBeLessThanOrEqual(rules.glasses[1]);
      expect(phrase.notes.length).toBeGreaterThanOrEqual(3);
      expect(phrase.notes.length).toBeLessThanOrEqual(8);
    }
  });

  it('World 1 campaign phrases respect the 3-5 note limit so the checker stays quiet', () => {
    for (const slot of planCampaign().filter((s) => s.world === 1)) {
      const [tuneId, phraseId] = slot.phrases[0] ?? ['', ''];
      const phrase = PHRASES[tuneId]?.find((p) => p.id === phraseId);
      expect(phrase?.notes.length, slot.id).toBeLessThanOrEqual(5);
    }
  });

  it('every phrase compiles on its own scale and stays in the glass instrument range', () => {
    for (const [tuneId, phrases] of Object.entries(PHRASES)) {
      for (const phrase of phrases) {
        const json: LevelJson = {
          schemaVersion: 1,
          id: 'probe',
          world: 1,
          scale: phrase.scale,
          melody: { tuneId, title: tuneId, notes: phrase.notes, beats: phrase.beats, bpm: phrase.bpm },
          glasses: ['A', 'B', 'C', 'D', 'E'].map((id) => ({ id, capacity: 2, emptyNote: 'A5', water: 0 })),
          tools: [],
          ice: [],
          par: 0,
          optimalSolutions: 0,
        };
        expect(() => compileLevel(json), `${tuneId}/${phrase.id}`).not.toThrow();
        expect(phrase.beats).toHaveLength(phrase.notes.length);
      }
    }
  });
});

describe('guides', () => {
  it('builds scripts for levels 1-3 and the three mechanic intros', () => {
    const guides = buildGuides(CONTENT_DIR);
    expect(Object.keys(guides.levels)).toEqual(['w1-01', 'w1-02', 'w1-03']);
    expect(Object.keys(guides.intros).sort()).toEqual(['faucet', 'ice', 'sink']);
  });
});
