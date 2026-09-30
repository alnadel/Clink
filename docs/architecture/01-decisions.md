# 01 · Decisions

Every open question an implementer could hit is answered here. Each entry says who may change
it. "Default" means the designer or product owner has not confirmed it yet: build it exactly
as written, and treat any later change as a spec change (update this file, the contracts and
the acceptance tests together).

## Game rules

| ID | Decision | Why | Status |
|---|---|---|---|
| D1 | **A faucet on a full glass, or a sink on an empty glass, is refused** (`'full'` / `'empty'`), costs no move and does not tick ice. | Rule 7 already refuses pours that move no water. Otherwise, in ice levels a no-op tool use becomes a free "wait" move, which changes par. | Default (designer) |
| D2 | **A move resolves in this order:** apply the pour or tool one unit at a time; then drop every ice countdown above 0 by one, in cube order; each cube that reaches 0 melts (+1 unit if its glass has room, else spills); then check for the solve. Refused moves do nothing at all. | Rules 9 and 11 ("after each move, and any melting"). | Default (designer) |
| D3 | **Using a hint caps the level at 2 stars until it is solved.** Undo and restart do not clear the cap. Retrying a solved level starts clean. | Otherwise a player could peek at a hint, restart and still earn 3 stars. | Default (designer) |
| D4 | **In play-along, the glass that glows is the leftmost** (lowest index) one ringing the next note. | Rule 12 needs a deterministic choice when two glasses ring the same note. | Default (designer) |
| D5 | **Ice format:** `{ "glass": "B", "countdown": 3 }`. There are at most 3 cubes per level and countdowns run 1–15. Several cubes may share a glass, and cubes are processed in array order. | Appendix A only shows `"ice": []`. The limits keep state keys small. | Fixed (architecture) |
| D6 | **Melody identity:** `melody.tuneId` points into `content/tunes.json`. The Songbook shows each `tuneId` once. | FR-17 says each tune appears once, and one tune backs several levels. | Fixed |
| D7 | **Note colour and glyph follow pitch class** (C is always the same colour and shape), with an octave mark (see [10](10-i18n-a11y.md)). | This keeps them consistent with letter and solfège labels (FR-28). | Default (artist and designer) |
| D8 | **A shared link opens today's daily**, not the day it was shared. There is no archive. `link_open.puzzle_no` records the shared number. | Rule 17: the same puzzle for everyone each day. | Default (product owner) |
| D9 | **Faucet and sink act on the selected glass:** select a glass, then tap the tool. With nothing selected, tapping a tool pulses the glasses and costs nothing. | This matches the select-then-act grammar of pouring. | Default (designer) |
| D10 | **The tap table** in [05 §3](05-web-app.md) is exact. Every tap on a glass rings it. A refused pour shakes the source if it was empty and the target if it was full, then clears the selection. A successful move clears the selection. | FR-02 | Default (designer) |
| D11 | **Reachable states are counted over the whole state graph**, without stopping at tuned states. Appendix A's 18 states only come out this way; stopping at tuned states gives 15. | Checked with a reference solver. | Fixed |
| D12 | **Hints pick the first move in canonical order** (pours by from then to, then faucets, then sinks) that lowers the distance to a solve by one. From a state with no reachable solve, the hint is "restart". | FR-06 needs deterministic, testable hints. | Fixed |
| D13 | **Notes match by exact pitch**, octave included. | Appendix A move 3 | Fixed |
| D14 | **Rule limits are errors and world-table limits are warnings.** Rule limits: 2–5 glasses, capacity 2–12, a phrase of 3–8 notes, 1–5 targets. The BRD world table's per-world limits only warn. | Appendix A's own w1-08 has a 7-note phrase, but the world table says World 1 phrases have 3–5 notes. | Default (designer) |

## Daily, progression, onboarding

| ID | Decision | Status |
|---|---|---|
| D15 | Daily levels have ids `d001`, `d002` and so on. They use the same format as campaign levels and may use any mechanic. The first time a player meets a mechanic, in any level, its intro plays (FR-27). | Default (designer) |
| D16 | If `schedule.json` runs out, puzzle *n* uses `puzzles[(n - 1) % length]` (a rerun). `config.json` `dailyOverrides` always win. | Default (product owner) |
| D17 | The link tutorial (FR-23) is the levels listed in `guides.json` `linkTutorial` (default `w1-01`, `w1-02`), played with their guides. The daily follows. Those levels count as solved campaign levels. | Default (designer) |
| D18 | The install prompt (FR-34) shows after the first solve of `w1-05` and of `w1-15`: at most twice, and never when running installed (`display-mode: standalone`). | Default (product owner) |
| D19 | The one-question survey shows after the first solve of `w1-10`, once per device, and can be skipped. | Default (product owner) |
| D20 | Glyphs are always shown; there is no setting for them (FR-29). | Fixed |
| D21 | The reduced-motion setting is `system` / `on` / `off` and defaults to `system`, which follows `prefers-reduced-motion`. | Fixed |
| D22 | The restore code never includes the device ID. Importing keeps the best result per level and daily, and applies the code's settings. | Fixed |
| D23 | If a level's content hash changed since a save (the level was retuned), its in-progress state is discarded. Stars already earned are kept. | Fixed |
| D24 | A level disabled by remote config is hidden on the map and skipped in unlock order. | Fixed |
| D25 | In play-along, tapping the wrong glass rings it but does not advance. A Skip button ends play-along (`song: 'skipped'`). With sound off, play-along still runs visually. | Default (designer) |
| D26 | `level_abandon` fires once per attempt, when the player leaves the play screen unsolved or the page is hidden (`pagehide`) during an unsolved level with at least one move. | Default (product owner) |
| D27 | A session starts when the app opens, or when it becomes visible after 30 or more minutes without activity. | Fixed (BRD) |
| D28 | A daily keeps its first solve in `Progress.dailies`. Replays are allowed but change nothing, and the share card always shows the first solve. | Default (product owner) |

## Technology

| ID | Decision | Status |
|---|---|---|
| D29 | **Stack:** TypeScript 7 (strict), pnpm 10 workspaces, Vite 8, Preact 10 with `preact-iso` routing, PixiJS 8, `idb-keyval`, `vite-plugin-pwa` (Workbox), Vitest 5, fast-check, Playwright, Biome. Exact versions are pinned in `package.json` files; do not upgrade in feature issues. | Fixed |
| D30 | **Hosting:** any static CDN that reads Netlify-style `_headers` and `_redirects` files (Cloudflare Pages or Netlify). Paths route through an SPA fallback. | Default (product owner, with DEC-6) |
| D31 | **Analytics** go through our typed `track()` layer ([09](09-ops.md)). Vendor adapters (GameAnalytics after DEC-7) sit behind the `AnalyticsAdapter` contract. | Fixed |
| D32 | **Glass audio:** recorded samples in `/audio/glass/`, pitch-shifted by `playbackRate`. A built-in synth plays until the recordings arrive, and stays as a fallback (DEC-4). | Fixed |
