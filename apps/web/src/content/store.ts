import { type ContentManifest, compileLevel, type Level, type LevelJson, type PackFile } from '@clink/rules';
import { reportError } from '../ops/errors';

export interface ContentStore {
  manifest(): ContentManifest;
  /** Fetches the pack that lists `id` (once) and returns that level's JSON. */
  levelJson(id: string): Promise<LevelJson>;
  /** compileLevel of levelJson, cached per id. */
  level(id: string): Promise<Level>;
  /** Fetches every pack not yet loaded. Never throws. */
  warm(): Promise<void>;
}

export interface LoadContentOptions {
  fetch?: typeof fetch;
  baseUrl?: string;
}

/** Loads the manifest and returns the store. Throws on a bad response or schemaVersion. Spec: 05 §12. */
export async function loadContent(options: LoadContentOptions = {}): Promise<ContentStore> {
  const doFetch = options.fetch ?? fetch.bind(globalThis);
  const baseUrl = options.baseUrl ?? '';
  const response = await doFetch(`${baseUrl}/content/manifest.json`);
  if (!response.ok) throw new Error(`manifest.json: HTTP ${response.status}`);
  const manifest = (await response.json()) as ContentManifest;
  if (manifest.schemaVersion !== 1) throw new Error('manifest.json: unsupported schemaVersion');

  const packLoads = new Map<string, Promise<PackFile>>();
  const compiled = new Map<string, Promise<Level>>();

  const loadPack = (file: string): Promise<PackFile> => {
    let load = packLoads.get(file);
    if (!load) {
      load = doFetch(`${baseUrl}/content/packs/${file}`).then(async (res) => {
        if (!res.ok) throw new Error(`pack ${file}: HTTP ${res.status}`);
        return (await res.json()) as PackFile;
      });
      // A failed load is reported, and may be retried.
      load.catch((error: unknown) => {
        reportError(error);
        packLoads.delete(file);
      });
      packLoads.set(file, load);
    }
    return load;
  };

  const levelJson = async (id: string): Promise<LevelJson> => {
    const ref = manifest.packs.find((pack) => pack.levelIds.includes(id));
    if (!ref) throw new Error(`unknown level ${id}`);
    const level = (await loadPack(ref.file)).levels.find((candidate) => candidate.id === id);
    if (!level) throw new Error(`unknown level ${id}`);
    return level;
  };

  return {
    manifest: () => manifest,
    levelJson,
    level(id) {
      let level = compiled.get(id);
      if (!level) {
        level = levelJson(id).then(compileLevel);
        level.catch(() => compiled.delete(id));
        compiled.set(id, level);
      }
      return level;
    },
    async warm() {
      await Promise.allSettled(manifest.packs.map((pack) => loadPack(pack.file)));
    },
  };
}
