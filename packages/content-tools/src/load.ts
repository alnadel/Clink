import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { BandsFile, GuidesFile, RemoteConfig, ScheduleFile, TunesFile } from '@clink/rules';
import { listJsonFiles, readJson } from './io';

export interface LevelFile {
  path: string;
  kind: 'campaign' | 'daily';
  text: string;
  json: unknown;
  parseError: string | null;
}

export interface LoadedContent {
  contentDir: string;
  tunes: TunesFile | null;
  bands: BandsFile | null;
  schedule: ScheduleFile | null;
  guides: GuidesFile | null;
  config: RemoteConfig | null;
  /** content/levels/**.json (campaign) then content/daily/*.json (daily), sorted by path. */
  levels: LevelFile[];
  /** Missing or unparsable top-level files, or files whose schemaVersion is not 1. */
  fileErrors: { file: string; message: string }[];
}

function loadTopLevel<T extends { schemaVersion: number }>(
  contentDir: string,
  name: string,
  errors: LoadedContent['fileErrors'],
): T | null {
  const file = join(contentDir, name);
  try {
    const value = readJson(file) as T;
    if (value?.schemaVersion !== 1) {
      errors.push({ file, message: 'schemaVersion must be 1' });
      return null;
    }
    return value;
  } catch (error) {
    errors.push({ file, message: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

function loadLevelFiles(dir: string, kind: LevelFile['kind']): LevelFile[] {
  return listJsonFiles(dir).map((path) => {
    const text = readFileSync(path, 'utf8');
    try {
      return { path, kind, text, json: JSON.parse(text) as unknown, parseError: null };
    } catch (error) {
      return {
        path,
        kind,
        text,
        json: null,
        parseError: error instanceof Error ? error.message : String(error),
      };
    }
  });
}

/**
 * Loads the whole content folder. Top-level files are cast to their types after a schemaVersion check;
 * deep validation belongs to the checker. Loading never throws for a broken level file.
 */
export function loadContent(contentDir: string): LoadedContent {
  const fileErrors: LoadedContent['fileErrors'] = [];
  return {
    contentDir,
    tunes: loadTopLevel<TunesFile>(contentDir, 'tunes.json', fileErrors),
    bands: loadTopLevel<BandsFile>(contentDir, 'bands.json', fileErrors),
    schedule: loadTopLevel<ScheduleFile>(contentDir, 'schedule.json', fileErrors),
    guides: loadTopLevel<GuidesFile>(contentDir, 'guides.json', fileErrors),
    config: loadTopLevel<RemoteConfig>(contentDir, 'config.json', fileErrors),
    levels: [
      ...loadLevelFiles(join(contentDir, 'levels'), 'campaign'),
      ...loadLevelFiles(join(contentDir, 'daily'), 'daily'),
    ],
    fileErrors,
  };
}
