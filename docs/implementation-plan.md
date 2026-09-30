# Clink Web MVP: Implementation plan

Source: *Clink: Business Requirements Document (Web MVP)*, 30 Sep 2026 (the BRD).
Status: draft for the product owner, designer and developers to review in week 0.

> The technical detail in sections 3 and 4 is superseded by the exact specification in
> [architecture/](architecture/README.md). The rule gaps G1–G8 below are pinned there as
> decisions D1–D8 ([architecture/01-decisions.md](architecture/01-decisions.md)).

This plan turns the BRD into a build: the architecture, the order of work, who does what
before each gate, and how every requirement gets verified. It uses the BRD's IDs (rules
1–17, FR-01–39, NFR-01–14, DEC-1–7, R1–R12) and does not restate the BRD itself.

---

## 1. Summary

- **One TypeScript codebase, shipped as a static PWA.** A UI-free rules package (`@clink/rules`)
  is the only implementation of rules 1–17. It runs the game, the hint worker and the CI
  level checker, so the three can never disagree (NFR-14).
- **Content is data.** Levels are JSON files that the solver proves before they ship. CI
  fails on any mismatch (FR-19), and a generator proposes candidates for the designer to pick (FR-20).
- **Build to the BRD's gates.**

  | Phase | Dates | Ends with |
  |---|---|---|
  | 0 · Setup | Tue 29 Sep – Sun 4 Oct | Repo, CI, rules core, reference phones ordered |
  | 1 · Prototype and fun test | Mon 5 Oct – Wed 14 Oct | **Gate 1 · Fun** (Oct 14) |
  | 2 · Vertical slice: World 1 | Thu 15 Oct – Wed 4 Nov | **Gate 2 · Alpha** (Nov 4) |
  | 3 · Content complete and beta | Thu 5 Nov – Wed 25 Nov | **Gate 3 · Launch ready** (Nov 25) |
  | Soft launch | Mon 30 Nov – Sun 10 Jan | **Gate 4 · Decision** (Jan 13, 2027) |

- **Risk goes first.** The two high/high risks are both about sound (R1, R2), and R11 is
  about frame rate on budget phones. Phase 1 therefore tests iOS audio, glyph-only play and
  Pixi performance on real reference phones, not just in desktop browsers.

---

## 2. What reading the BRD turned up

### 2.1 Checked: Appendix A reproduces under the rules

A breadth-first solver written straight from rules 1–7 and 10–11 reproduces level
`w1-08` exactly: **par 5, one shortest solution, 18 reachable states**, with the same move
trace and notes as the table in Appendix A. Two details matter for the code:

- **"Reachable states" counts the whole state graph, including states past a solve.** If
  solved states are treated as terminal (the board lock in rule 11), the count is 15, not
  18. The level checker (FR-19) and the 100,000-state cap therefore use the unlocked graph.
  The rule 11 lock applies only to the game.
- **Notes match by exact pitch, octave included.** At move 3, D3 does not count as the
  target D4. Found notes (rule 10) compare scale positions, not pitch classes.

Appendix A becomes the first golden test in `@clink/rules`: the reachable-state count, par,
optimal-path count, and the exact notes and found set after each of the five moves.

### 2.2 Priority conflicts: the plan treats four Shoulds as Must

| FR | BRD priority | Why the plan builds it as Must |
|---|---|---|
| FR-20 Level generator | Should | Gate 2 requires "the generator check for A2", and 120 levels (60 campaign + 60 daily) in about six weeks is not realistic by hand |
| FR-33 Restore code | Should | NFR-08 (Must) relies on it to cover Safari's 7-day storage deletion |
| FR-34 Install prompt | Should | Same as FR-33 |
| FR-38 Remote config | Should | NFR-11 (Must) relies on it: "a broken level can be switched off remotely" |

The count becomes 31 Must, 7 Should and 1 Could. The remaining Shoulds (FR-17, 24, 25, 28, 30,
31, 39) are all small and are scheduled in Phase 3.

### 2.3 Rule gaps the designer should close in week 0

The rules call themselves "the single source of truth", so each answer goes into the rules
package's tests and into the BRD.

| # | Gap | Proposed answer |
|---|---|---|
| G1 | Is a faucet on a full glass, or a sink on an empty one, a move? | Refused and free, like rule 7. Otherwise, in ice levels it becomes a "wait" move that ticks countdowns, which changes par. |
| G2 | What order does a move resolve in? | Apply the move, drop every countdown by one, melt any cube at zero (spilling if the glass is full), then check for the solve (rule 11). |
| G3 | Does restart clear the "hint used" cap (rule 14)? | No. The cap lasts until the level is solved, or players could peek at a hint, restart and still earn 3 stars. |
| G4 | Which glass glows in play-along (rule 12) when two glasses ring the same note? | The leftmost. |
| G5 | Ice data format (Appendix A only shows `"ice": []`) | `{"glass": "B", "countdown": 3}`, with a countdown of 1–15 |
| G6 | Tune identity for the Songbook ("each solved tune appears once") when one tune backs several levels | Add `melody.tuneId`, pointing into `content/tunes.json` (title, origin, rights status) |
| G7 | Are note colours and glyphs by pitch class (C is always red) or by scale degree? | By pitch class, so they agree with letter and solfège labels (FR-28). This sets the size of the glyph set: 12 plus an octave mark if keys vary, 7 if every major level is in C. |
| G8 | Does a shared link open the day it was shared or today (FR-23)? | Today's puzzle, since there is no archive. `link_open.puzzle_no` records the shared number. |

### 2.4 Schedule and data gaps

- **The domain must be final before the first real player.** DEC-6 (the name) is due Nov
  25 and soft launch starts Nov 30. The PWA's saves and installs are tied to its origin, so
  renaming the domain after launch strands every save and installed icon. Decide the
  domain by Gate 2 (Nov 4), and use a neutral staging domain for alpha and beta.
- **Dailies run out on 28 Jan 2027.** Sixty dailies from Nov 30 end on Jan 28. An "iterate"
  call on Jan 13 adds up to two 3-week cycles (to late February), so plan about 35 more
  dailies, or a rule for rerunning old ones.
- **Acquisition channel is not in any event.** The success criteria need a stable channel
  mix and tester exclusion, so add `source` (first-touch, from a `?src=` link parameter)
  and `tester` to `session_start`.
- **The level-10 survey has no event.** Add `survey_answer {answer}`, making 17 events.

### 2.5 Facts to confirm in week-1 spikes, before DEC-7 (Oct 14)

- GameAnalytics can compute each KPI **as the BRD defines it**, especially O2 (median levels
  in a first session) and O5 (share rate). If the dashboards can't, we need its raw export.
- Batched events arrive in order within 5 minutes (FR-36), and every move event fits its
  limits on event names and custom fields.
- Whether GameAnalytics error events can show a **source-mapped stack** (FR-37). If not, add
  a dedicated error tracker (Sentry with PII capture off, or self-hosted GlitchTip). That
  tracker must also pass the NFR-10 privacy review.
- PixiJS runs under a strict CSP with no `'unsafe-eval'` (NFR-12). Pixi ships a shim for this.
- `navigator.audioSession` plus the silent-loop fallback play sound with the ringer switch on
  silent, on the reference iPhone 8 (NFR-05).

---

## 3. Architecture

### 3.1 Stack

| Layer | Choice | Notes |
|---|---|---|
| Language and build | TypeScript (strict), Vite, pnpm workspaces | As the BRD recommends |
| Rules engine | `packages/rules`: pure TS, compiled without DOM types | Runs on the main thread, in the worker and in Node (CI) |
| Board | PixiJS v8, behind a small `Board` interface | Glasses, water, pours, fill marks, melody bar, glow |
| Menus and screens | Preact + plain CSS with logical properties | The BRD's "small UI library"; logical properties give RTL for free |
| Audio | Web Audio; recorded glass samples pitch-shifted through `playbackRate`; synthesis as fallback | See 3.5 |
| Hints | A Web Worker running the rules package's solver | Keeps taps and animation smooth |
| Save | IndexedDB (through `idb`), `navigator.storage.persist()`, restore code | See 3.6 |
| Offline | `vite-plugin-pwa` (Workbox) | Precache the app shell and World 1; background-cache Worlds 2–3 |
| Hosting | Static CDN with custom headers (e.g. Cloudflare Pages) | CSP and cache TTLs set per path |
| Analytics | GameAnalytics JS SDK behind our own typed `track()` layer | Only the adapter changes if DEC-7 does |
| Config and flags | `config.json` on the CDN, bucketed by device ID | Kill switches, schedule overrides, A/B experiments |
| Tests | Vitest (with v8 coverage), fast-check, Playwright, axe-core | See section 6 |
| CI/CD | GitHub Actions | Checks and level proofs on every PR; preview deploy per PR; production on `main` |

### 3.2 Repository layout

```
packages/
  rules/          @clink/rules: level schema, pitch, moves, found notes, solve, stars, solver
  content-tools/  CLIs: levels:check (FR-19), levels:prove, levels:gen (FR-20), packs:build
apps/
  web/            the PWA
    src/board/      PixiJS scene: glasses, water, marks, melody bar, animations
    src/audio/      sampler, synth fallback, iOS audio session, scheduler
    src/game/       level controller: the rules package plus undo stack, hints, play-along
    src/ui/         Preact screens: map, level HUD, solve card, songbook, settings, daily
    src/guide/      guided steps shared by onboarding (FR-26), intros (FR-27) and the link tutorial (FR-23)
    src/save/       IndexedDB store, migrations, restore code
    src/daily/      puzzle number, schedule, share card, streak
    src/ops/        track() and the GA adapter, error reporting, remote config, A/B bucketing
    src/workers/    hint worker
    public/locales/ en.json, ar.json
content/
  levels/w1/w1-01.json … w3/w3-20.json
  daily/d001.json …
  schedule.json   launch date plus the ordered list of daily IDs
  tunes.json      tune ID, title, origin, rights status
  bands.json      difficulty bands per world (for the generator and the A2 check)
docs/
```

### 3.3 The rules package

Every note is resolved to a **scale position**: an integer index into the level's scale
across its range (C3–A5). A position's pitch is `tonicHz · 2^(cents/1200)`, so quarter-tone
maqam scales later need only a new `stepsCents`, not new code (rule 3).

```ts
type Pos = number;                                    // index into the level's scale positions
type Move =
  | { kind: 'pour'; from: number; to: number }
  | { kind: 'faucet'; glass: number }
  | { kind: 'sink'; glass: number };

interface State { water: number[]; ice: number[] }    // ice[i] = countdown, 0 = melted

compileLevel(json): Level                             // validates and resolves names to positions
ringing(level, state): Pos[]                          // rule 2
found(level, state): Set<Pos>                         // rule 10
isTuned(level, state): boolean                        // rule 11
legalMoves(level, state): Move[]                      // rules 7, 8; refusals excluded (G1)
applyMove(level, state, move): MoveResult | Refused   // rules 7–9, 11; order per G2
stars(par, moves, hinted, thresholds): 1 | 2 | 3      // rule 14; thresholds A/B-able (FR-39)
solve(level): { reachable, par, optimalPaths, distanceToGoal }   // FR-19, FR-06
hint(level, state, solved): Move                      // rule 15; fixed tie-break order
```

- **`MoveResult` carries the timeline for the view**: one entry per unit moved (both
  glasses' new positions, for the in-tune run in FR-11), then any melts and spills, then the
  new found set and the solve flag. The board and audio play this timeline, and never
  re-derive rules.
- **States are immutable and tiny.** A state is at most 5 water levels and a few
  countdowns. Undo pops a stack of states, which gives FR-05 (ice countdowns included)
  for free.
- **Solver.** BFS over the unlocked graph (2.1), keying each state as an integer: 4 bits
  per glass for water and 4 bits per ice cube. From that it gets par, the optimal-path
  count (paths per BFS layer) and `distanceToGoal`, from a reverse BFS out of every solved
  state. The hint worker computes this when a level opens (at most 100,000 states), so a
  hint is a lookup.
- **Coverage gate.** 90% line and branch coverage, enforced in CI (NFR-14). Property tests
  check that water is conserved on pours, that undo is exact, that refused moves change
  nothing, and that following hints reaches the solve in exactly `distanceToGoal` moves.

### 3.4 Level pipeline

1. The designer runs `pnpm levels:gen --tune ode-to-joy --world 2 --band hard -n 30`. The
   generator searches random glass setups that fit the world's constraints (glasses, phrase
   length, scale, par range). It proves each candidate and ranks them by the band's metrics:
   par, reachable states, optimal-path count, and "backward steps" (moves that give up a
   found note, as in Appendix A's move 3).
2. The designer plays candidates in a dev route (`/dev/level`), which has solver overlays,
   then commits the chosen JSON.
3. `pnpm levels:prove --write` fills in `par` and `optimalSolutions`.
4. `pnpm levels:check` runs in CI (FR-19) and fails the build if any of these fail:
   - the schema;
   - every fill line is on the scale and within C3–A5;
   - the level has 2–5 glasses with capacities of 2–12;
   - the phrase has 3–8 notes, with 1–5 distinct targets and no more targets than glasses;
   - tools appear only from World 2, and ice only in World 3;
   - the level has at most 100,000 reachable states;
   - `par` and `optimalSolutions` match the solver;
   - the level is not already solved at the start;
   - every note in the level has a distinct glyph and octave mark (FR-29);
   - the tune's rights status is `cleared` (enforced from Gate 3).
5. `pnpm packs:build` bundles `packs/w1.<hash>.json` etc. and `packs/manifest.json`
   (FR-18). Saves reference levels by stable ID (`w1-08`), never by index. An in-progress
   level whose content hash changed restarts; stars earned are kept.

### 3.5 Audio (FR-10–14, NFR-04, NFR-05)

- **Sampler.** It takes 6–8 recorded glass strikes across C3–A5, picks the nearest sample
  for each note, and shifts it by `playbackRate = 2^(Δcents/1200)`. It trims encoder padding
  and leading silence after decoding, which saves tens of milliseconds against the
  100 ms budget. Short fades on voices stop clicks.
- **Synth fallback** (DEC-4). A few inharmonic partials with exponential decay. It is built
  first because the prototype needs a sound before the recordings arrive (Oct 15), and it
  stays as the fallback.
- **Latency.** Sound fires on `pointerdown`, with `latencyHint: 'interactive'` and every
  buffer decoded ahead of time. The melody, the pour runs and the play-along are all
  scheduled on the audio clock, not with `setTimeout`.
- **Gesture and iOS rules.**
  - No `AudioContext` is created or resumed before the first-launch choice (FR-14).
  - `navigator.audioSession.type = 'playback'` is set where supported, with a silent
    looping `<audio>` element as the fallback.
  - Audio resumes after interruptions such as calls and Siri: the app watches for
    `statechange` and `visibilitychange`, and resumes on the next gesture.
  - Every state change is sent as `audio_state`.

### 3.6 Save, restore and install

- **IndexedDB records.**
  - `profile`: device ID, first-session date, A/B buckets, `source`, tester flag, FTUE and
    intro flags, install-prompt count, settings.
  - `progress`: stars, best moves and a hinted flag per level; solved dailies.
  - `current`: level ID, content hash, move list, hint flag, undo and restart counts, time.
- **Saving.** The app writes after every move (FR-32). On reopen it replays the move list
  through the rules package.
- **Restore code** (FR-33). Progress is encoded as a versioned bit-packed blob: 2 bits of
  stars per level, a bitset of solved dailies, and settings. It is written in Crockford
  base32 with a checksum, grouped into blocks of four, at about 40 characters. It can also
  be shared as a `/restore#CODE` link. Import merges by keeping the best result. The device
  ID is never included, because it identifies a browser, not a player.
- **Install prompt** (FR-34). It appears after level 5 and at most twice. On Chromium it uses
  `beforeinstallprompt`; on iOS it shows illustrated "Add to Home Screen" steps.

### 3.7 Daily puzzle (FR-21–25)

- **Puzzle number.** `puzzleNo = localCalendarDaysBetween(launchDate, today) + 1`, counted on
  calendar dates (Y/M/D), not in 24-hour blocks, so it stays right across DST changes. The
  launch date is Nov 30 = #1. Staging overrides the launch date so beta testers get dailies.
- **Schedule.** `schedule.json` maps a number to a daily level. Remote config can override
  single days (FR-38).
- **Share card.** A plain text card with no board state:
  `Clink #42`, one 💧 per move, `6/5`, the stars, then the link. It uses `navigator.share`
  where available and the clipboard otherwise. `share_complete` fires when the share promise
  resolves or the copy succeeds.
- **Hidden title.** The melody bar reads "Mystery tune" until the solve (FR-25). The title
  is in the data but not shown; this is about spoilers, not anti-cheat.
- **Streak.** Consecutive local days with a solved daily, derived from the solved set
  rather than stored as a counter.

### 3.8 Ops: analytics, errors, config and flags

- **Typed events.** `track()` enforces a schema for all 17 events (the BRD's 16 plus
  `survey_answer`). Events are queued in IndexedDB so they survive offline use and closed
  tabs, then batched to the adapter. A session ends after 30 minutes idle. A console
  adapter serves development and the FR-36 scripted-session test.
- **Errors.** `window.onerror` and `unhandledrejection` report the message, stack and
  level ID, de-duplicated and rate-limited. Hidden source maps are uploaded from CI and
  never served publicly.
- **Remote config.**
  - The CDN caches `config.json` for about 5 minutes. The service worker fetches it
    network-first with a 3-second timeout, falling back to its cached copy.
  - The app refetches it at launch, every 30 minutes and whenever the tab becomes visible.
    That keeps a kill switch within the 1-hour bar in FR-38.
  - A disabled level is hidden and skipped in unlock order.
- **A/B flags.** Each device gets a bucket from `hash(deviceId + experimentKey) mod 100`, so
  its assignment is stable (FR-39). The first experiments are star thresholds and onboarding
  variants. Assignments are logged in `session_start.ab_flags`.

### 3.9 Accessibility, localization, security

- **Glyphs** (FR-29). A glyph per pitch class plus an octave mark, checked by the level
  checker. At Gate 3, a grayscale screenshot of every level also goes to the designer.
- **WCAG 2.2 AA** for menus and screens (NFR-09). axe-core runs in the E2E suite. Glass hit
  areas are at least 44 × 44 CSS px. Reduced motion follows `prefers-reduced-motion` and
  swaps movement for fades (FR-30).
- **Strings and RTL.** Every string lives in `public/locales/*.json` from the first commit.
  Layouts use CSS logical properties. `dir="rtl"` mirrors the menus, while the board and
  the melody bar stay `dir="ltr"` (FR-31). An Arabic font subset has to fit NFR-02.
- **CSP** (NFR-12). `default-src 'self'`, with `connect-src` limited to the analytics and
  error hosts and `worker-src 'self' blob:`. There is no inline script and no user content,
  and every response is HTTPS with HSTS.

---

## 4. Plan by phase

The BRD's team has two full-time developers:

- **Dev E (engine and data):** the rules package, the solver, the tools, save, daily and ops.
- **Dev C (client):** the board, audio, UI, PWA, localization, accessibility and performance.

### Phase 0 · Setup (Sep 29 – Oct 4)

| Who | Deliverables |
|---|---|
| Dev E | Monorepo, strict TS, lint and format, Vitest and coverage gate, GitHub Actions. Rules package: types, level schema, note-to-position resolution, pours, found notes, the solve check, and the **Appendix A golden test**. |
| Dev C | Vite, Pixi and Preact shell. Preview deploy per PR on the CDN. Locale files and RTL-ready CSS from the start. Synth glass voice. A first spike of `audioSession` and the silent loop on an iPhone. |
| Designer | Answers G1–G8 (2.3) and drafts `bands.json`. |
| Artist | First glyph set (G7), which gates fill marks. |
| Product owner | Orders the three NFR-07 reference phones, sets up the staging domain, and opens the analytics and error accounts. |

### Phase 1 · Prototype and fun test (Oct 5 – Oct 14) → Gate 1

**Goal:** a rough but honest build where ten first-time testers can play past level 5,
some with sound off (A1).

| Who | Deliverables |
|---|---|
| Dev E | Solver (par, optimal paths, distance to goal). `levels:check` v0 in CI. `levels:gen` v0 (pour only). Stars. Undo and restart. Hints, computed on the main thread for now. |
| Dev C | Board with placeholder art: glasses, water, fill marks with glyphs, select and pour with a refusal shake, melody bar with found and lost notes, solve lock, a basic play-along. Tap-to-hear and in-tune runs on the synth. The first-launch sound choice. |
| Designer | 12 World 1 levels with a gentle curve, made with the generator. Runs the Gate 1 playtest script. |
| Spikes | Pixi water and pour animation at 60 fps on the budget Android. GameAnalytics and error tracker capabilities (2.5). CSP compatibility. |

**Decisions due Oct 14:** DEC-1 (languages), DEC-4 (glass sound) and DEC-7 (analytics), each
using the spike results.

### Phase 2 · Vertical slice, World 1 (Oct 15 – Nov 4) → Gate 2

**Goal:** a finished World 1 that 30 outside testers play, with analytics measuring O1.

| Who | Deliverables |
|---|---|
| Dev E | Rules 8–9 (faucet, sink, ice) in the rules package, with property tests. `levels:gen` for all three mechanics, and **the A2 check (≥3 candidates per band per world)**. Full `levels:check` (FR-19). Packs and manifest (FR-18). The hint worker (FR-06, including the 1,000-state CI test). IndexedDB save (FR-32). The `track()` layer and GA adapter with all 17 events. Error reporting (FR-36, FR-37). Daily-number logic, share-card text and streak as pure modules. |
| Dev C | Final board art and pour animation. Sampler with the recorded glass (NFR-04). iOS audio handling (NFR-05). Play-along and auto-play (FR-13). World map and unlocks (FR-16). Level HUD: moves, par, undo, restart, hint. Solve card. Guided-steps system and onboarding levels 1–3 (FR-26). Settings: sound, auto-play, glyphs. Service worker and offline play (FR-35). `storage.persist()`. Size and Lighthouse budgets in CI. |
| Designer | All 20 World 1 levels final. Starts on World 2 and 3 candidates once the generator supports them (by about Oct 28). |
| Artist and sound | World 1 backdrop, glass shape and UI. Glass recordings **by Oct 15** (a hard dependency). World 1 effects. |
| QA (from Oct 26) | Weekly device matrix: NFR-01, 03 and 04 on the reference phones. |
| Product owner | **Decides the production domain** (2.4). Distributes the alpha link to 30 testers, tagged by `source`. |

**Gate 2 checks:** O1 at 80% or more among the 30 testers, the A2 generator check passing,
and World 1 final.

### Phase 3 · Content complete and beta (Nov 5 – Nov 25) → Gate 3

**Goal:** every Must passes, the NFR budgets hold on the reference phones, and the rights and
privacy reviews are signed off.

| Who | Deliverables |
|---|---|
| Dev E | Remote config and kill switch (FR-38). A/B flags (FR-39). Restore code (FR-33). Daily schedule and overrides (FR-21). Tester and source tagging. The survey event. The Appendix-A-style replay test over all 60 levels (FR-04). |
| Dev C | Faucet, sink and ice visuals and sounds, plus their intros (FR-08, 09, 27). Daily screen, share (FR-22), link handling with the 60-second tutorial (FR-23), hidden title (FR-25) and streak UI (FR-24). Songbook (FR-17). Install prompt (FR-34). Note labels (FR-28). Reduced motion (FR-30). Arabic RTL if DEC-1 says so (FR-31). Link-preview image and PWA icons. Vibration (FR-15) if time allows. |
| Both | Performance hardening and a low-effects mode (R11). Axe and WCAG audit. CSP in production headers. Privacy notice page. Background caching of Worlds 2–3. The Gate 3 checklist from section 5. |
| Designer | Worlds 2 and 3 (40 levels) and 60 dailies. The Gate 3 grayscale review. |
| Rights and privacy | Clearance of the tune list (the CI rights check switches on). Privacy notice. Legal review per DEC-2 market. |

### Soft launch (Nov 30 – Jan 10) → Gate 4 on Jan 13

- **A weekly cycle.** Read the dashboards: the per-level funnel, hint, undo and abandon
  rates, and moves over par. Then retune levels through new packs, and use the kill switch
  for any level that breaks.
- **Hot fixes** ship the same day. Device-matrix tests run every week.
- **Reporting.** iOS Safari players who haven't installed the app are reported as their own
  cohort (NFR-08), and tester traffic is excluded.
- **Dailies.** Keep at least 14 days queued in `schedule.json`, and add the dailies an
  iterate call would need (2.4).

---

## 5. Requirement traceability

The Phase column says when each requirement is built: P1 is the prototype, P2 the vertical
slice and P3 content complete. **Bold** marks a priority that the plan raises (2.2).

### Functional requirements

| ID | Requirement | Pri | Phase | Verified by |
|---|---|---|---|---|
| FR-01 | Glasses, marks, melody bar | Must | P1→P2 | E2E screenshots of all 60 levels at 360 × 640, with a bounding-box overlap check |
| FR-02 | Tap to hear and select, pour | Must | P1 | Rules unit tests for every pour case; E2E shake with no move added |
| FR-03 | Found notes | Must | P1 | Unit tests; E2E checks the note lights in the frame the pour ends |
| FR-04 | Solve and lock | Must | P1 | CI replay of the solver's solution for every level solves exactly on the last move |
| FR-05 | Undo and restart | Must | P1/P2 | Property test: random sequences, undo restores the exact state, ice included |
| FR-06 | Hints | Must | P1/P2 | CI: 1,000 random reachable states, following hints solves in `distanceToGoal` |
| FR-07 | Moves, par, stars | Must | P1 | Unit tests at par, par+1, ⌈1.5 × par⌉ and above, with and without a hint |
| FR-08 | Faucet and sink | Must | P2/P3 | Unit tests; the checker rejects tools not listed in the level |
| FR-09 | Ice | Must | P2/P3 | Unit tests for melt and spill; undo restores countdowns |
| FR-10 | Glass instrument | Must | P1/P2 | `OfflineAudioContext` render of C3–A5 with a discontinuity check, plus sound-designer sign-off |
| FR-11 | In-tune pour runs | Must | P2 | Unit test on the `MoveResult` timeline; a check that it is synced to the animation |
| FR-12 | Melody playback | Must | P1 | Unit test that scheduled times match the beats and bpm |
| FR-13 | Play-along and auto-play | Must | P1/P2 | E2E: the glowing glass always rings the next note; auto-play needs no input |
| FR-14 | Sound choice | Must | P1 | E2E: no `AudioContext` before a gesture; the choice persists after a reload |
| FR-15 | Vibration | Could | P3 | Manual test on Android |
| FR-16 | World map and unlocks | Must | P2 | E2E: a fresh save unlocks in exactly the right order |
| FR-17 | Songbook | Should | P3 | E2E: each tune appears once (by `tuneId`) and plays |
| FR-18 | Versioned packs | Must | P2 | E2E: publish a new pack, see it on the next launch, and an old save still loads |
| FR-19 | CI level checker | Must | P1→P2 | CI job (3.4) |
| FR-20 | Level generator | **Must** | P1→P2 | The A2 check: at least 3 candidates per band per world |
| FR-21 | Daily puzzle | Must | P2/P3 | Unit tests on the date to number mapping (time zones, DST, launch day = #1) |
| FR-22 | Share card | Must | P3 | Unit test on the text; E2E with Web Share and clipboard mocks |
| FR-23 | Links and tutorial | Must | P3 | E2E: a new device goes from the link to the tutorial to the daily |
| FR-24 | Streak | Should | P2/P3 | Unit tests on consecutive local days |
| FR-25 | Hidden daily title | Should | P3 | E2E: the title appears only on the solve card |
| FR-26 | Onboarding levels 1–3 | Must | P2 | Gate 2 playtests |
| FR-27 | Mechanic intros | Must | P3 | E2E: each shows once; timed in playtests at under 20 s |
| FR-28 | Note labels | Should | P3 | E2E: labels switch live on the glasses and the melody bar |
| FR-29 | Glyphs as well as colour | Must | P1→P2 | Checker rule (3.4) and a grayscale review |
| FR-30 | Reduced motion | Should | P3 | E2E with emulated `prefers-reduced-motion` |
| FR-31 | Arabic RTL | Should | P3 | String-coverage check and a visual review of mirroring |
| FR-32 | Save every move | Must | P2 | E2E: reload mid-level and resume the same state |
| FR-33 | Restore code | **Must** | P3 | E2E round trip between two browser contexts |
| FR-34 | Install prompt | **Must** | P3 | E2E: shown after level 5 and at most twice |
| FR-35 | Offline | Must | P2 | E2E offline: unlocked levels, the Songbook and audio all work |
| FR-36 | Analytics events | Must | P2 | A scripted session reaches the staging GA project in order within 5 min |
| FR-37 | Error reporting | Must | P2 | A forced error shows in the dashboard with a source-mapped stack |
| FR-38 | Remote config | **Must** | P3 | E2E: a config change hides the level within the refresh window |
| FR-39 | A/B flags | Should | P3 | Unit tests on stable hashing; `session_start` carries the flags |

### Non-functional requirements

| ID | Requirement | Phase | Verified by |
|---|---|---|---|
| NFR-01 | Load | P2→P3 | Lighthouse CI with throttling on every PR; weekly on the budget phone |
| NFR-02 | Size | P1 onward | CI size budget for code, World 1 art and audio (≤ 3 MB compressed) |
| NFR-03 | Frame rate | P1 spike → weekly | FPS overlay on the reference phones; low-effects mode as a fallback |
| NFR-04 | Audio latency | P2 → weekly | Slow-motion recording of a tap, median ≤ 100 ms |
| NFR-05 | iOS audio | P0 spike → P2 | Ringer-switch, call and Siri tests on the iPhone 8 |
| NFR-06 | Browsers | P2 onward | Playwright on Chromium, WebKit and Firefox in CI, plus the device matrix |
| NFR-07 | Reference phones | P0 | Ordered in week 0 |
| NFR-08 | Offline and storage | P2/P3 | Precache, `persist()`, FR-33 and FR-34 |
| NFR-09 | Accessibility | P2→P3 | axe in E2E, a WCAG 2.2 AA audit, a 44 px target lint |
| NFR-10 | Privacy | P3 | Payload audit (no PII), privacy notice, legal review |
| NFR-11 | Reliability | P3 | O7 tracked from alpha; the kill switch works (FR-38) |
| NFR-12 | Security | P2 | CSP and HSTS headers, checked by an E2E header test |
| NFR-13 | Localization | P0 onward | A lint rule against string literals in the UI; RTL snapshots |
| NFR-14 | Maintainability | P0 onward | Rules package coverage ≥ 90%, enforced in CI |

---

## 6. Testing and CI

Every PR runs the following:

1. Typecheck, lint and format.
2. Rules unit and property tests, with the coverage gate.
3. `levels:check` over all content, plus the FR-04 replay and the FR-06 hint test.
4. The build, with a size-budget check.
5. Playwright E2E on Chromium and WebKit, including axe and header checks.
6. Lighthouse CI on the preview deploy.

Merging to `main` deploys to staging. A tagged release goes to production and uploads
source maps.

Device testing is manual and weekly from Oct 26, following the NFR-07 matrix. Results are
logged against NFR-01, 03, 04 and 05.

---

## 7. Engineering risks and when they're retired

| Risk | Plan | Retired by |
|---|---|---|
| R2 iOS audio | Audio-session spike in Phase 0 on a real iPhone; `audio_state` telemetry from alpha | Gate 2 |
| R11 Budget-phone performance | Pixi spike in Phase 1; weekly device checks; low-effects mode | Gate 3 |
| R1 Sound kept off | Glyphs and fill marks in the prototype; sound-off testers at Gate 1; O6 tracked | Gate 1 (A1) |
| R3 Safari data loss | `persist()`, restore code, install prompt, a separate cohort | Gate 3 |
| State-space blowup with ice | The 100,000-state cap in CI; the generator discards candidates over it | Gate 2 |
| Content throughput (120 levels) | The generator as a Must; content production starts in Phase 2 | Gate 3 |
| Analytics can't compute a KPI | Week-1 spike; a typed `track()` layer means a vendor switch only touches the adapter | DEC-7 (Oct 14) |
| Domain change after launch | Decide the production domain by Gate 2 | Gate 2 |

---

## 8. Open decisions and what the build does meanwhile

| Decision | Needed by | What the build does until then |
|---|---|---|
| DEC-1 Languages | Oct 14 | RTL-ready layouts and resource files from day one. Only translation and QA wait on the decision. |
| DEC-4 Glass sound | Oct 14 | Synth first, since the prototype needs it; recordings drop into the same sampler |
| DEC-7 Analytics | Oct 14 | Typed events plus a console adapter; the GA spike informs the call |
| DEC-2 Markets | Nov 4 | No build impact; it drives the legal review and cohort reporting |
| DEC-5 Regional music | Nov 4 | The rules package supports any `stepsCents`; it is content only |
| DEC-3 Acquisition | Nov 25 | `source` tagging on links from alpha onward |
| DEC-6 Name | Nov 25 | **Pull the domain part forward to Nov 4** (2.4); use a staging domain until then |

---

## 9. First pull requests

1. **Scaffold.** pnpm workspace, strict TS configs (with no DOM lib for `packages/rules`),
   Vite app, Vitest with coverage, ESLint and Prettier, a GitHub Actions CI workflow.
2. **Rules core.** Schema, scale positions, pours, found notes and the solve check, with the
   Appendix A golden test and property tests.
3. **Solver and checker.** BFS, par, optimal paths, distance to goal; `levels:check` and
   `levels:prove`; `content/levels/w1/w1-08.json` as the first level.
4. **Board prototype.** A Pixi scene driven by `MoveResult`, the synth voice and the first-launch
   sound choice.
