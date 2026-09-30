import { copyFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import {
  type ContentManifest,
  fnv1a32,
  hex8,
  type LevelJson,
  type PackFile,
  type PackId,
  type PackRef,
} from '@clink/rules';
import { checkContent, formatFinding } from './check';
import { writeJson } from './io';
import { loadContent } from './load';

export interface BuildPacksOptions {
  contentDir: string;
  /** Folder that receives `manifest.json` and `packs/`. Emptied first. */
  outDir: string;
  /** Where to copy content/config.json (served as /config.json). Skipped when omitted. */
  configOut?: string;
  /** Injected for reproducible tests. */
  now: Date;
}

/**
 * Turns content/ into hashed, immutable pack files and a manifest (FR-18).
 * Throws, writing nothing, when the content checker reports any error.
 * Spec: docs/architecture/03-content-pipeline.md §6.
 */
export function buildPacks(options: BuildPacksOptions): ContentManifest {
  const report = checkContent({ contentDir: options.contentDir });
  const errors = report.findings.filter((finding) => finding.severity === 'error');
  if (errors.length > 0) {
    throw new Error(
      `content has ${errors.length} errors:\n${errors.map((e) => formatFinding(e, options.contentDir)).join('\n')}`,
    );
  }

  const content = loadContent(options.contentDir);
  const { tunes, schedule, guides, config } = content;
  if (!tunes || !schedule || !guides || !config) throw new Error('content files are missing');

  const groups: Record<PackId, LevelJson[]> = { w1: [], w2: [], w3: [], daily: [] };
  const levelHashes: Record<string, string> = {};
  for (const file of content.levels) {
    const level = file.json as LevelJson;
    const pack: PackId = file.kind === 'daily' ? 'daily' : (`w${level.world}` as PackId);
    groups[pack].push(level);
    levelHashes[level.id] = hex8(fnv1a32(JSON.stringify(level)));
  }

  rmSync(options.outDir, { recursive: true, force: true });
  mkdirSync(join(options.outDir, 'packs'), { recursive: true });

  const packs: PackRef[] = [];
  for (const id of ['w1', 'w2', 'w3', 'daily'] as const) {
    const levels = groups[id].sort((a, b) => a.id.localeCompare(b.id));
    if (levels.length === 0) continue;
    const pack: PackFile = { schemaVersion: 1, id, levels };
    const text = JSON.stringify(pack);
    const hash = hex8(fnv1a32(text));
    const fileName = `${id}.${hash}.json`;
    writeFileSync(join(options.outDir, 'packs', fileName), text);
    packs.push({ id, file: fileName, hash, levelIds: levels.map((level) => level.id) });
  }

  const manifest: ContentManifest = {
    schemaVersion: 1,
    builtAt: options.now.toISOString(),
    packs,
    levelOrder: groups.w1
      .concat(groups.w2, groups.w3)
      .map((level) => level.id)
      .sort(),
    levelHashes,
    tunes: Object.fromEntries(
      Object.entries(tunes.tunes).map(([id, tune]) => [id, { title: tune.title, origin: tune.origin }]),
    ),
    schedule,
    guides,
  };
  writeJson(join(options.outDir, 'manifest.json'), manifest);

  if (options.configOut) {
    mkdirSync(dirname(options.configOut), { recursive: true });
    copyFileSync(join(options.contentDir, basename('config.json')), options.configOut);
  }
  return manifest;
}
