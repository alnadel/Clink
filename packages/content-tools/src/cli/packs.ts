import { join } from 'node:path';
import { buildPacks } from '../packs';
import { CONTENT_DIR, REPO_ROOT, WEB_CONTENT_OUT } from '../paths';

try {
  const manifest = buildPacks({
    contentDir: CONTENT_DIR,
    outDir: WEB_CONTENT_OUT,
    configOut: join(REPO_ROOT, 'apps/web/public/config.json'),
    now: new Date(),
  });
  console.log(`packs:build: ${manifest.packs.length} packs, ${manifest.levelOrder.length} campaign levels`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
