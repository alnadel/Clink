# 05 · Web app (`apps/web`)

A Preact single-page app. The play area is a PixiJS canvas, and everything else is
accessible DOM.

## 1. Folders

```
src/
  main.tsx              bootstrap (§13)
  app.tsx               providers + router (§2)
  lib/                  small pure helpers (store, not-implemented)
  content/              manifest and pack loading (§12)
  game/                 session.ts (pure, §3), playalong.ts (pure, §6), unlocks.ts (pure, §9)
  board/                layout.ts (pure, §4.2), pixi/ (drawing, §4.1), types.ts (contract)
  audio/                engine (06)
  save/                 IndexedDB store, restore code (08)
  daily/                dates, share, streak (08)
  ops/                  analytics, errors, config, flags (09)
  guide/                guide runner (pure, §8)
  i18n/                 en.json, ar.json, i18n.ts (10)
  theme/                note colours and glyphs (10 §3)
  workers/              hint worker + client (§7)
  ui/
    screens/            one file per route
    components/         Button, IconButton, Modal, Toast, Hud, ...
    services.tsx        ServicesContext (§2.2)
```

## 2. Routes, screens and app state

### 2.1 Routes (`preact-iso` `LocationProvider` + `Router`)

| Path | Screen | Notes |
|---|---|---|
| `/` | `HomeScreen` | Continue (next open level), Daily #n (with streak), World map, Songbook, Settings |
| `/map` | `MapScreen` | §9 |
| `/play/:levelId` | `PlayScreen kind="campaign"` | Locked levels redirect to `/map` |
| `/daily` | `PlayScreen kind="daily"` | Today's puzzle (08 §3). Before launch or with nothing scheduled: "No puzzle today" |
| `/d/:n` | `LinkScreen` | Shared-link entry (§10) |
| `/songbook` | `SongbookScreen` | §11 |
| `/settings` | `SettingsScreen` | §11 |
| `/restore` | `RestoreScreen` | Reads the code from `location.hash` (08 §2) |
| `/privacy` | `PrivacyScreen` | Static text from i18n (NFR-10) |
| `/dev/level` | `DevLevelScreen` | Only when `import.meta.env.DEV`: paste a LevelJson and play it with solver info |

Paths route through an SPA fallback in production ([07](07-platform.md)).

### 2.2 Services and state

`main.tsx` builds one `Services` object and provides it through `ServicesContext`:

```ts
interface Services {
  save: SaveStore; audio: AudioEngine; analytics: Analytics; i18n: I18n;
  content: ContentStore; hints: HintClient; config: Store<RemoteConfig>; flags: Store<ResolvedFlags>;
  profile: Store<Profile>; progress: Store<Progress>;
}
```

`Store<T>` (`lib/store.ts`) is a minimal observable:
`{ get(): T; set(next: T): void; update(fn: (t: T) => T): void; subscribe(fn): () => void }`.
Components read it with `useStore(store)`, built from `useState` and `useEffect`. Stores that
mirror IndexedDB (`profile`, `progress`) write through to `save` on every `set`. Do not add
another state library.

### 2.3 First launch (FR-14)

While `profile.soundChoiceMade` is false, `SoundChoice` shows as a full-screen modal above any
route. It has two buttons: "Play with sound" and "Play muted".

- **With sound:** in the click handler, synchronously, call `audio.unlock()`. Then set
  `settings.sound = true` and `soundChoiceMade = true`.
- **Muted:** set `settings.sound = false` and `soundChoiceMade = true`. No AudioContext is ever
  created.
- Then: if the route is `/d/:n`, continue the link flow (§10). Otherwise, if no campaign level
  is solved, navigate to `/play/w1-01`.

## 3. Game session (`game/session.ts`): the exact behaviour

Contract: `game/types.ts`. Acceptance tests: `apps/web/test/acceptance/session.test.ts`.

The session keeps `history: State[]` (history[0] is the start), `moves: Move[]`, `selected`,
and the counters. `tuned` is `isTuned(level, current)`. When `tuned` is true, the board is
**locked**: `tapGlass`, `tapTool`, `undo` and `restart` all return `[]`.

### 3.1 Tap table (rules 6 and 7, D10)

| Situation | `tapGlass(g)` returns |
|---|---|
| locked, or `g` not an index | `[]` |
| nothing selected | `[ring(g), select(g)]` |
| `g` is selected | `[ring(g), select(null)]` |
| `s` selected, pour `s → g` refused | `[shake(s if reason is 'empty', else g, reason), select(null)]` |
| `s` selected, pour ok | `[select(null), move, found, tuned?]` |

`ring(g)` is `{ type: 'ring', glass: g, pos: ringing(level, current)[g] }`.

### 3.2 Tools (rule 8, D9)

| Situation | `tapTool(tool)` returns |
|---|---|
| locked, or the level lacks the tool | `[]` |
| nothing selected | `[{ type: 'need-selection', tool }]` |
| `s` selected, refused | `[shake(s, reason), select(null)]` |
| `s` selected, ok | `[select(null), move, found, tuned?]` |

### 3.3 Effects after a move

- `move`: `{ type:'move', move, moveNo: moves.length, units, events, state }`, with the
  values from `applyMove`.
- `found`: `{ type:'found', found, gained, lost }`. `gained` and `lost` are target indices,
  compared with the state before the move.
- `tuned`: appended only if the new state is tuned.

### 3.4 Undo and restart (rule 13)

- `undo()`: `[]` if locked or there are no moves. Otherwise `[select(null) if something was
  selected, { type:'undo', state }, found]`, and `undos += 1`.
- `restart()`: `[]` if locked or there are no moves. Otherwise `[select(null) if selected,
  { type:'restart', state: start }, found]`, and `restarts += 1`.
- `noteHintShown(hint)`: `hinted = true`, `hints += 1`. Neither undo nor restart resets them
  (D3).

### 3.5 Resume (FR-32)

`options.resumeMoves` is replayed with `applyMove` on creation. Replay stops at the first
refused move, and the rest are dropped. Counters come from `options`. A replay that ends
tuned leaves the session locked.

## 4. Board (`board/`)

Contract: `board/types.ts` (`BoardView`, `BoardLayout`).

### 4.1 Visual spec (Pixi, `board/pixi/`)

- **Application:** `new Application()` then `await app.init({ resizeTo: container,
  backgroundAlpha: 0, antialias: true, resolution: Math.min(devicePixelRatio, 2),
  autoDensity: true })`. Import `'pixi.js/unsafe-eval'` first, because the strict CSP forbids
  eval ([07](07-platform.md)). The world backdrop is a CSS background behind the canvas.
- **Input:** one `pointerdown` listener on the stage. A glass hit is any point inside
  `layout.glasses[i].hit`, a melody hit is inside `melodyBar`, and a tool hit is inside
  `layout.tools[t]`. Sound fires on `pointerdown`, not `click`, to keep latency low (NFR-04).
- **Glass:** an outline with rounded bottom corners (3 px, white at 90% alpha) and a faint
  fill (white at 8%).
- **Water:** a rectangle from `fillLineY[water]` to `fillLineY[0]`, coloured with the note
  colour of the glass's current ringing position, at 85% alpha.
- **Fill marks (rule 4):** for each water level `w = 0..capacity`, the glyph of
  `ringing(w) = emptyPos - w` sits at `x = body.x + 10`, `y = fillLineY[w]`.
  - Target positions: 14 px glyph, full note colour, with a thin ring.
  - Other positions: 9 px glyph at 45% alpha.
  - With note labels on (FR-28), a small label sits to the right of each target mark.
- **Current note:** a 20 px glyph (and label, if on) centred above the glass at
  `body.y - 14`.
- **Melody bar:** a rounded rectangle (white at 10%). One chip per phrase note at
  `melodyNotes[i]`, showing the note's glyph (20 px) in its colour. A found target is at full
  opacity with a soft glow; an unfound one is at 35% (rule 10). The cursor (`setMelodyCursor`)
  draws an underline under the current note.
- **Ice:** a 26 px rounded square (white at 70%) floating at the water surface of its glass,
  with the countdown centred (14 px bold). Hidden once melted.
- **Tools:** placeholder vector icons in `layout.tools` rects (a tap for the faucet, a drain
  for the sink). The artist replaces them with sprites later; keep the rects.
- **Selected glass:** lifted 10 px. With reduced motion: a 5 px outline instead.
- **Shake:** ±6 px horizontally, 3 cycles in 240 ms. With reduced motion: the outline flashes
  red for 240 ms.
- **`animateMove`:** each `unit` event takes 110 ms. The source level drops one unit and the
  target rises one unit, with a thin stream between them (none in low-effects mode). The
  source tilts up to 15° toward the target (not with reduced motion, where levels cross-fade).
  - `onStep(event, i)` is called at the **start** of each event's segment, so sound and
    picture stay in sync (FR-11).
  - A `melt` takes 220 ms (the cube shrinks, then the water rises); a `spill` takes 220 ms
    (the cube fades).
  - If `animateMove` or `show` is called while an animation runs, the running one snaps to
    its end state first. **The board never blocks input.**
- **Hint:** for a pour, an arrow from the source glass to the target glass; for a tool, a
  pulse on the tool and the selected glass. It stays until `showHint(null)`.
- **Glow (play-along):** the outline pulses at scale 1 → 1.06 once per beat (`60 / bpm` s).
  With reduced motion, only the opacity pulses.
- **Guide highlight:** a pulsing ring around the target (glass, melody bar or tool).
- **Frame budget:** 60 fps on the reference phones, never below 30 (NFR-03). Low-effects mode
  drops the particles and the tilt.

### 4.2 Layout algorithm (`board/layout.ts`, pure)

Tested by `apps/web/test/acceptance/layout.test.ts`. All values are CSS px.

```
P = 16; GAP = 12; BAR_H = 56; NOTE_H = 44; NOTE_GAP = 6; TOOL = 64; LABEL = 20; RIM = 12; BOTTOM = 6

melodyBar   = { x: P, y: P, width: W - 2P, height: BAR_H }
n           = melody.notes.length
noteW       = min(48, floor((melodyBar.width - (n - 1) * NOTE_GAP) / n))
total       = n * noteW + (n - 1) * NOTE_GAP
note i      = { x: melodyBar.x + (melodyBar.width - total) / 2 + i * (noteW + NOTE_GAP),
                y: melodyBar.y + (BAR_H - NOTE_H) / 2, width: noteW, height: NOTE_H }

toolY       = H - P - TOOL
tools.faucet = { x: P, y: toolY, width: TOOL, height: TOOL }            (only if the level has a faucet)
tools.sink   = { x: W - P - TOOL, y: toolY, width: TOOL, height: TOOL } (only if it has a sink)

areaTop     = melodyBar.y + BAR_H + 24
areaBottom  = (faucet or sink) ? toolY - 16 : H - P
g           = glasses.length
gw          = min(72, floor((W - 2P - (g - 1) * GAP) / g))
x0          = (W - (g * gw + (g - 1) * GAP)) / 2
unit        = max(6, min(28, floor((areaBottom - areaTop - LABEL - RIM) / maxCapacity)))

glass i:  h            = capacity * unit + RIM
          body         = { x: x0 + i * (gw + GAP), y: areaBottom - h, width: gw, height: h }
          fillLineY[w] = areaBottom - BOTTOM - w * unit            for w = 0..capacity
          hit          = { x: body.x - GAP / 2, y: areaTop, width: gw + GAP, height: areaBottom - areaTop }
```

The play screen gives the board the full viewport minus the HUD (§5), and calls `resize()`
on `ResizeObserver` changes.

## 5. Play screen (`ui/screens/PlayScreen.tsx`)

**Layout:** an HUD bar (DOM, 64 px) above the board container (the rest of the viewport).
The HUD has, in DOM order:
- Back (to `/map`, or `/` for a daily);
- the title (`t('play.level', { n })` or `t('play.daily', { n })`);
- moves, as `t('play.moves', { moves, par })`;
- Undo (disabled when `!canUndo`);
- Restart (disabled when `moves === 0`);
- Hint (disabled until the hint worker has loaded).

All are 44 × 44 px or larger, with `aria-label`s.

**Opening a level:**
1. `content.levelJson(id)` → `compileLevel` (cached).
2. `save.loadCurrent()`. If it is for this level, of the same kind, and `levelHash` equals
   `manifest.levelHashes[id]`, resume it (`resumeMoves`, counters, `elapsedMs`, `attempt`).
   Otherwise start a new attempt: `attempt = (profile.levelAttempts[id] ?? 0) + 1`, stored
   back to the profile.
3. `createGameSession`, `board.show(...)`, `hints.load(levelJson)`.
4. Track `level_start`, plus `daily_start` for dailies.
5. `save.saveCurrent(...)`.
6. Start a guide script if one applies (§8).

**Handling input.** Every board callback goes through the guide filter (§8), then to the
session. The returned effects are handled in order:

| Effect | Do |
|---|---|
| `ring` | `audio.ring(hz(pos))` |
| `select` | `board.setSelected` |
| `shake` | `board.shake`; `audio.sfx('refuse')`; `navigator.vibrate?.(30)` if vibration is on (FR-15) |
| `need-selection` | a toast `t('play.selectGlassFirst')`; guide highlight on all glasses for 600 ms |
| `move` | `board.showHint(null)`. `board.animateMove(events, state, onStep)`, where `onStep` rings `hz(fromPos)` and `hz(toPos)` at velocity 0.6 (skipping nulls), plays `sfx('pour' / 'faucet' / 'drain')` on the first unit, `sfx('melt')` plus a ring on `melt`, `sfx('ice-clink')` on `spill`, and `vibrate(8)` per unit if enabled. Then `save.saveCurrent`. Then `track('move', { level_id, move_no, type, from: glass id or null, to: glass id or null, units })`. |
| `found` | `board.setFound(found)`; `audio.sfx('found')` if `gained.length > 0` |
| `undo` / `restart` | `board.show(level, state, found, options)`; `board.showHint(null)`; `save.saveCurrent` |
| `tuned` | the solve flow (§6) |

`hz(pos)` is `level.positions[pos].hz`. A tap on the melody bar plays the phrase (§6.3) and is
never a move (rule 6).

**Hint button:** `hints.hint(levelId, snapshot.state)`, then:
- **move:** `board.showHint(move)`; `session.noteHintShown(h)`;
  `track('hint_used', { level_id, move_no: snapshot.moves })`;
- **restart:** a toast `t('play.hintRestart')` and a pulse on the Restart button; also
  `noteHintShown`;
- **none:** nothing.

**Time.** `elapsedMs` only grows while `document.visibilityState === 'visible'`.

**Abandon (D26).** Leaving the route unsolved, or `pagehide` with `moves >= 1`, fires
`track('level_abandon', { level_id, moves, seconds })` once per attempt.

## 6. Solve flow and play-along (rule 12)

`game/playalong.ts` is a pure helper:
`glassForNote(level, state, noteIndex): number` returns the lowest glass index whose ringing
position equals `melody.notes[noteIndex]` (D4).

1. On the `tuned` effect:
   - lock the board;
   - `save.saveCurrent(null)`;
   - track `level_tuned { level_id, moves, par, hints, undos, restarts, seconds }`;
   - `audio.sfx('flourish')`;
   - wait 600 ms.
2. **Auto-play** (`settings.autoPlaySong`): `audio.playPhrase(hzs, beats, bpm, onNote)`, where
   `onNote(i)` calls `setMelodyCursor(i)` and `setGlow(glassForNote(i))`. `song = 'auto'`.
3. **Play-along** (default):
   - For note `i`: `setGlow(glassForNote(i), bpm)` and `setMelodyCursor(i)`.
   - Tapping the glowing glass rings it and advances. Tapping another glass rings it without
     advancing (D25).
   - After the last note, wait 300 ms, then replay the whole phrase with `playPhrase` and
     the cursor. `song = 'played'`.
   - A DOM "Skip" button stops everything: `song = 'skipped'`.
4. **Solve card** (DOM modal):
   - stars = `starsFor(moves, par, hinted, flags.twoStarFactor ?? 1.5)`;
   - moves vs par;
   - the tune title and origin from `manifest.tunes` (for a daily, this is the only place the
     title appears: FR-25);
   - buttons. Campaign: **Next** (primary), Replay song, Retry, Map. Daily: **Share**
     (primary, 08 §4), Replay song, Home.
5. Before the card shows:
   - update progress. For campaign levels: best stars, fewest moves, and `solvedAt` from the
     first solve. For dailies: only the first solve (D28).
   - Track `level_complete { level_id, stars, song }`, plus `daily_complete` for dailies.
6. After a campaign card: the install prompt (D18) and the survey (D19) (§11).

**Retry** starts a new attempt: `hinted` is cleared, and so are the counters.

### 6.3 Melody bar playback (rule 6)

`audio.playPhrase(melody.notes.map(hz), beats, bpm, i => board.setMelodyCursor(i))`. When it
ends, call `setMelodyCursor(null)`. A second tap while it plays stops it and starts it again.
It costs no move.

## 7. Hint worker (FR-06)

Contract: `workers/protocol.ts`.

- **`workers/hint.worker.ts`:**
  - On `load`: `compileLevel`, then `explore(level)`, keeping `{ levelId, level, graph }`;
    reply `loaded` with `reachable` and `ms`.
  - On `hint`: if `levelId` does not match, reply `error`. Otherwise reply
    `hint(level, graph, state)`.
  - Wrap every handler in try/catch and reply `error` with the message.
- **`workers/hint-client.ts`:**
  - `createHintClient()` returns `{ load(level: LevelJson): Promise<void>; hint(levelId,
    state): Promise<Hint>; dispose(): void }`.
  - It creates the worker with `new Worker(new URL('./hint.worker.ts', import.meta.url),
    { type: 'module' })` and matches replies by `requestId`.
  - A `hint` call made before `load` resolves waits for it.

## 8. Guides: onboarding (FR-26), intros (FR-27), link tutorial (FR-23)

The format is in `formats.ts` (`GuideStep`, `GuidesFile`), and the content in `guides.json`.
`guide/runner.ts` is pure:

```ts
type GuideInput = { kind: 'glass'; glass: number } | { kind: 'tool'; tool: ToolName } | { kind: 'melody' } | { kind: 'undo' } | { kind: 'hint' };
type GuideEvent = GuideTrigger;   // same shapes: { on: 'ring', glass }, { on: 'pour', from, to }, ...
interface GuideRunner {
  readonly scriptId: string;
  current(): GuideStep | null;         // null when finished
  allows(input: GuideInput): boolean;  // false if the current step's `allow` excludes it
  notify(event: GuideEvent): GuideStep | null;  // advances if the event matches `until`; returns the completed step
}
createGuideRunner(scriptId: string, steps: GuideStep[]): GuideRunner
```

**Matching:** an event matches `until` when `on` is equal and every field set in `until` is
equal in the event. `{ on: 'tap' }` matches any input.

**Omitted `allow`:** everything is allowed. Omitted inner fields (for example no `glasses`)
also mean allowed. `undo` and `hint` default to allowed.

**Which script runs** when a level opens:
1. `guides.levels[levelId]` if `level:<levelId>` is not in `profile.seenGuides`;
2. otherwise the intros for the level's mechanics not yet seen, concatenated in the order
   faucet, sink, ice, as one runner with scriptId `intro:<mechanic>` per part.

**Events the play screen sends** after each input:
- a `ring` effect → `{on:'ring', glass}`;
- a pour move → `{on:'pour', from, to}`;
- a tool move → `{on:'tool', tool}`;
- each gained target → `{on:'found', target}`;
- `tuned` → `{on:'tuned'}`;
- a melody tap → `{on:'melody'}`;
- any input → `{on:'tap'}`.

**When a step completes:** track `ftue_step { step: '<scriptId>:<stepId>' }`, show the next
step's text in a DOM banner, and call `board.setGuideHighlight(next.highlight ?? null)`.
When the script finishes, add its id to `profile.seenGuides`.

**Link tutorial (D17):** play each `linkTutorial` level with its `level:` script, then the
daily. It is recorded as `linkTutorial` in `seenGuides`.

Implementers write unit tests for the runner covering: matching with and without optional
fields, `allow` filtering, finishing, and `{on:'tap'}`.

## 9. World map and unlocks (FR-16, D24)

`game/unlocks.ts` (pure):

```ts
type LevelStatus = 'locked' | 'open' | 'solved';
function levelStatuses(levelOrder: string[], disabled: ReadonlySet<string>, progress: Progress): Map<string, LevelStatus>
// Skip disabled ids entirely (they are absent from the map).
// Walk in order: solved → 'solved'; the first unsolved → 'open'; every later unsolved → 'locked'.
function nextLevel(statuses): string | null   // the first 'open' id, or null when everything is solved
```

`MapScreen` shows three sections (World 1 · Kitchen Table, World 2 · Café Counter, World 3 ·
Winter Window), each a grid of 20 nodes: the number, stars if solved, a lock if locked. Only
open and solved nodes are buttons. A world whose first level is locked shows a lock over the
whole section.

## 10. Shared links (FR-23, D8, D17)

`/d/:n?src=share` → `LinkScreen`:
1. `newDevice` = the profile was created during this page load.
2. Track `link_open { puzzle_no: n, new_device }`. The `?src` value becomes `profile.source`
   if it is still null.
3. After the sound choice (§2.3): if `linkTutorial` is not in `seenGuides`, play the tutorial
   levels, then go to `/daily`. Otherwise go straight to `/daily`.

## 11. Songbook, settings, install prompt, survey

- **Songbook (FR-17):** every `tuneId` that appears in a solved campaign level or a solved
  daily, once each, sorted by title with `localeCompare`. Each row shows the title and
  origin and has a play button, which plays the phrase of the lowest solved level id using
  that tune.
- **Settings:** one control per `Settings` field.
  - Sound (toggle; turning it on calls `audio.unlock()` inside the handler).
  - Auto-play song.
  - Note labels (none / letters / solfège).
  - Reduced motion (system / on / off).
  - Language (system / English / العربية).
  - Vibration, shown only if `'vibrate' in navigator`.
  - Then: Export restore code (shows the code, a copy button and a `/restore#CODE` link),
    Import code (a text field), Privacy, and the app version.
  - Each change: update `profile.settings`, apply it live, and track
    `setting_change { setting, value: String(value) }`.
- **Install prompt (FR-34, D18):**
  - At bootstrap, listen for `beforeinstallprompt`: `preventDefault()` and keep the event.
  - At the D18 moments, if not installed and `installPromptCount < 2`, show a modal and
    increment the count. It has an Install button that calls `deferred.prompt()` on
    Chromium, or illustrated "Share → Add to Home Screen" steps on iOS Safari.
  - `appinstalled` → `track('install', { platform })`.
- **Survey (D19):** a modal with the BRD question and four buttons (very / somewhat / not
  disappointed, skip). It sends `survey_answer` and sets `profile.surveyAnswered = true`.

## 12. Content loading (`content/`)

```ts
interface ContentStore {
  manifest(): ContentManifest;                 // loaded at bootstrap
  levelJson(id: string): Promise<LevelJson>;   // fetches the pack that lists `id` once, then serves from memory
  level(id: string): Promise<Level>;           // compileLevel, cached
  warm(): Promise<void>;                       // fetch every pack, and world 2-3 art (07 §2)
}
```

- The manifest comes from `GET /content/manifest.json`, network-first through the service
  worker.
- If the manifest cannot load at all (first visit offline), show a full-screen retry message.
- Call `warm()` once, 5 s after the first level is shown.

## 13. Bootstrap (`main.tsx`), in order

1. `installErrorHandlers()` (09 §2): first, so bootstrap errors are caught.
2. `save = createSaveStore()`, then `profile = await save.loadProfile()`, noting whether it
   was newly created.
3. Apply URL parameters: `?tester=1` sets `profile.tester = true`; `?src=x` sets `source` if
   it is null.
4. `progress = await save.loadProgress()`.
5. `i18n = createI18n(settings.language)`. Set `<html lang dir>`.
6. `content = await loadContent()` and `config = await loadRemoteConfig()` (09 §3), in
   parallel.
7. `flags = resolveFlags(config, deviceId)`.
8. `analytics = createAnalytics(...)`, then `startSessionTracking()` (09 §1).
9. `audio = createAudioEngine(settings)`. This creates no AudioContext.
10. `hints = createHintClient()`.
11. `render(<App services={...} />)`.
12. `registerServiceWorker()` (07) and `save.requestPersistence()`, the latter after the
    first user gesture.

## 14. Test hooks for Playwright (`src/testing/hook.ts`)

The board is a canvas, so E2E tests need coordinates. When the app is built with
`--mode e2e` (`import.meta.env.MODE === 'e2e'`), and only then, bootstrap installs:

```ts
window.__clink = {
  snapshot(): SessionSnapshot | null;             // the open level's session, or null
  glassCenter(i: number): { x: number; y: number }; // page coordinates of glass i's hit rect centre
  melodyCenter(): { x: number; y: number };
  toolCenter(tool: ToolName): { x: number; y: number };
  hint(): Promise<Hint>;                          // same as the Hint button, without the UI
};
```

Tests tap with `page.mouse.click(x, y)` on those coordinates. Production builds must not
contain the hook: the E2E harness issue adds a build check that `__clink` is absent from
`dist/`.
