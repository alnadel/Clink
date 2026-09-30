# 03 · Content pipeline (`content/`, `packages/content-tools`)

Every file the game plays from is JSON in `content/`. The formats are defined in
`packages/rules/src/types.ts` (`LevelJson`) and `packages/rules/src/formats.ts`
(everything else). Four Node CLIs in `packages/content-tools` check, prove, generate and
package that content.

## 1. Files

| File | Format type | Notes |
|---|---|---|
| `content/levels/w{1,2,3}/w{W}-{NN}.json` | `LevelJson` | 60 campaign levels, `w1-01` to `w3-20`. The file name equals `id` plus `.json`. |
| `content/daily/d{NNN}.json` | `LevelJson` | Daily puzzles, `d001` and up (D15). `world` sets which mechanics they may use. |
| `content/tunes.json` | `TunesFile` | Titles, Songbook origins, rights status, phrase transcriptions. |
| `content/bands.json` | `BandsFile` | World constraints and difficulty bands (generator, warnings). |
| `content/schedule.json` | `ScheduleFile` | Launch date (2026-11-30) and daily order. |
| `content/guides.json` | `GuidesFile` | Onboarding, intros, link tutorial ([05 §8](05-web-app.md)). |
| `content/config.json` | `RemoteConfig` | Published as `/config.json` ([09 §3](09-ops.md)). |
| `content/candidates/**` | `LevelJson` | Generator output. Git-ignored. |

**Canonical formatting:** every content file is exactly `JSON.stringify(value, null, 2) + '\n'`.
Biome does not touch `content/`, and tools write files with
`writeJson(path, value)` from `packages/content-tools/src/io.ts`.

## 2. Commands

The issues that build each CLI add these scripts to the root `package.json`:

```json
"levels:check": "tsx packages/content-tools/src/cli/check.ts",
"levels:prove": "tsx packages/content-tools/src/cli/prove.ts",
"levels:gen":   "tsx packages/content-tools/src/cli/gen.ts",
"packs:build":  "tsx packages/content-tools/src/cli/packs.ts"
```

Every CLI is a thin wrapper around a library function in `packages/content-tools/src/` that
takes the content directory as a parameter. That lets unit tests run the functions on
temporary directories. Paths come from `src/paths.ts`.

## 3. `levels:check` (FR-19)

`pnpm levels:check [--release]`. The library function is
`checkContent({ contentDir, release }): CheckReport`.

```ts
interface Finding { severity: 'error' | 'warn'; code: string; file: string; message: string }
interface CheckReport { levelsChecked: number; findings: Finding[] }
```

Output is one line per finding, then a summary, and the exit code is 1 if there is any error:

```
ERROR E_PAR content/levels/w1/w1-08.json: par is 6 in the file but the solver found 5
WARN  W_WORLD_PHRASE content/levels/w1/w1-08.json: 7 notes; world 1 expects 3-5
levels:check: 61 levels, 1 error, 1 warning
```

Checks, in order, per level file:

| Code | Severity | Check |
|---|---|---|
| E_JSON | error | The file parses as JSON |
| E_ID | error | `id` matches the file name. Campaign ids match `/^w[1-3]-\d{2}$/`, sit in the folder of their world, and `world` equals the id's digit. Daily ids match `/^d\d{3}$/` in `daily/`. |
| (LevelError code) | error | `compileLevel` succeeds. Report its code, e.g. `E_OFF_SCALE`. |
| E_TOOLS_WORLD | error | Tools only when `world >= 2` (rule 8) |
| E_ICE_WORLD | error | Ice only when `world === 3` (rule 9) |
| E_AUDIO_RANGE | error | `scale.range` lies within C3..A5 (FR-10: the instrument covers C3–A5) |
| E_TUNE | error | `melody.tuneId` exists in `tunes.json` and `melody.title` equals its title |
| E_TUNED_AT_START | error | The start state is not already tuned |
| E_TOO_MANY_STATES | error | `explore(level, { maxStates: 100_000 })` is not truncated |
| E_UNSOLVABLE | error | `par !== null` |
| E_PAR | error | The file's `par` equals the solver's |
| E_OPTIMAL | error | The file's `optimalSolutions` equals the solver's |
| E_REPLAY | error | Replaying `solutionPath` tunes on exactly the last move (FR-04) |
| E_RIGHTS | error, only with `--release` | The tune's `rights` is `'cleared'` |
| W_WORLD_GLASSES, W_WORLD_PHRASE, W_WORLD_SCALE, W_WORLD_PAR | warn | Campaign levels within `bands.json` world limits (D14). Scale kinds: see `ScaleKind`. |
| W_FORMAT | warn | The file text is canonical (§1) |

Whole-content checks:

| Code | Severity | Check |
|---|---|---|
| E_FILE | error | `tunes.json`, `bands.json`, `schedule.json`, `guides.json` and `config.json` parse and have `schemaVersion: 1` |
| E_MISSING | error with `--release`, warn otherwise | All 60 campaign ids `w1-01`…`w3-20` exist |
| E_SCHEDULE | error | `launchDate` is a valid date; every id in `puzzles` has a daily file |
| E_GUIDE | error | Every key of `guides.levels` is `<levelId>` or `<levelId>:<variant>` (A/B onboarding, 09 §4) for an existing campaign level; every `linkTutorial` id is an existing campaign level; every `textKey` exists in `apps/web/src/i18n/en.json` |
| E_CONFIG | error | Every `disabledLevels` id exists; every `dailyOverrides` value is a daily id; each experiment's weights sum to 100 and name only existing variants |

The CI workflow runs `pnpm levels:check`. The release deploy runs `pnpm levels:check --release`.

## 4. `levels:prove` (writes par)

`pnpm levels:prove [--write] [levelId ...]`. With no ids it proves every level file. It prints:

```
w1-08  reachable=18  par=5  optimal=1   (file: par=5 optimal=1)  ok
w2-03  reachable=911 par=7  optimal=2   (file: par=6 optimal=2)  CHANGED
```

With `--write`, it sets `par` and `optimalSolutions` and rewrites the file canonically. It
never changes any other field.

## 5. `levels:gen` (FR-20)

```
pnpm levels:gen --tune <tuneId> --phrase <phraseId> --world <1|2|3> --band <bandId>
                [--count 20] [--seed 1] [--attempts 20000]
pnpm levels:gen --a2 [--seed 1]
```

The library function is `generate(options): Candidate[]`. Randomness comes only from a seeded
**mulberry32** RNG (`src/random.ts`), so the same arguments always give the same output.

```ts
function mulberry32(seed: number): () => number {    // returns floats in [0, 1)
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
randInt(lo, hi) = lo + Math.floor(rng() * (hi - lo + 1))   // inclusive
```

Algorithm:

```
rules  = bands.worlds[world]; band = rules.bands[id]; phrase = tunes[tune].phrases[id]
fail if the phrase's scale kind is not in rules.scales
probe  = compileLevel(a 2-glass dummy level with the phrase's scale) → positions P, targets T
repeat `attempts` times:
    g      = randInt(max(rules.glasses[0], T.length), rules.glasses[1])
    for each glass i: capacity = randInt(2, 12)
                      emptyPos = randInt(capacity, P.length - 1)
                      water    = randInt(0, capacity)
    tools  = world 1: none
             world 2/3: each tool of rules.tools with probability 0.5; world 2 needs at least one
    ice    = n = randInt(rules.ice[0], rules.ice[1]) cubes,
             each { glass: randInt(0, g - 1), countdown: randInt(1, 8) }
    skip unless every target t has a glass with emptyPos - capacity <= t <= emptyPos
    build LevelJson (id "cand", ids "A".."E", melody from the phrase); compileLevel (skip on error)
    skip if tuned at start
    s = solve(level, { maxStates: 100_000 }); skip if truncated, par null, or par outside band.par
    skip duplicates (same glasses + tools + ice)
    metrics: par, reachable, optimalSolutions,
             backwardSteps = moves on solutionPath after which the found count went down
sort by optimalSolutions asc, then backwardSteps desc, then reachable desc; keep `count`
write content/candidates/<tune>/w<world>-<band>-<NN>.json with par and optimalSolutions filled in
print a table: file, glasses, par, reachable, optimal, backward
```

`--a2` (assumption A2, Gate 2) runs the generator with `count 3` and `attempts 5000` for every
world × band × fitting tune phrase. It prints a table of distinct valid candidates per
(world, band), and exits 1 if any band has fewer than 3.

## 6. `packs:build` (FR-18)

`pnpm packs:build`. It runs automatically before `pnpm dev` and `pnpm build`, via
`predev` / `prebuild` in `apps/web/package.json`.

1. Run `checkContent`. On any error, print the findings and exit 1.
2. Empty `apps/web/public/content/`.
3. For each pack (`w1`, `w2`, `w3` from campaign levels by world, and `daily` from all
   dailies), with levels sorted by id:
   - `text = JSON.stringify({ schemaVersion: 1, id, levels })`
   - `hash = hex8(fnv1a32(text))`
   - write `apps/web/public/content/packs/<id>.<hash>.json`
4. `levelHashes[id] = hex8(fnv1a32(JSON.stringify(levelJson)))`.
5. Write `apps/web/public/content/manifest.json`, a `ContentManifest` with:
   - `levelOrder`: campaign ids sorted;
   - `tunes`: `{ title, origin }` for every tune;
   - `schedule`, `guides`.
6. Copy `content/config.json` to `apps/web/public/config.json`.

The web app loads the manifest network-first and the packs cache-first, since packs are
immutable because their names are hashed ([07](07-platform.md)). A new pack therefore
appears on the next launch without an app update, and saves still load because they
reference levels by id (FR-18, D23).
