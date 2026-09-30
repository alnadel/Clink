import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Absolute paths used by every content CLI. Always resolve files through these. */
export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
export const CONTENT_DIR = resolve(REPO_ROOT, 'content');
export const LEVELS_DIR = resolve(CONTENT_DIR, 'levels');
export const DAILY_DIR = resolve(CONTENT_DIR, 'daily');
export const CANDIDATES_DIR = resolve(CONTENT_DIR, 'candidates');
export const TUNES_FILE = resolve(CONTENT_DIR, 'tunes.json');
export const BANDS_FILE = resolve(CONTENT_DIR, 'bands.json');
export const SCHEDULE_FILE = resolve(CONTENT_DIR, 'schedule.json');
/** Generated packs are written here and served by the web app at /content/. Git-ignored. */
export const WEB_CONTENT_OUT = resolve(REPO_ROOT, 'apps/web/public/content');
