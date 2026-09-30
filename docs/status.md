# Status

What is built, how it was checked, and what only people can supply. Updated as work lands.

## Built

| Area | State |
|---|---|
| Rules engine (`@clink/rules`) | Complete. Rules 1–17 as specified, solver, hints, stars, hashing. 173 acceptance tests, coverage floor of 90% lines and branches (`pnpm test:coverage`). |
| Content tools | `levels:check` (FR-19), `levels:prove`, `levels:gen` (FR-20 with the A2 check), `packs:build`, `content:seed`. |
| Content | 60 campaign levels in three worlds, daily puzzles, 14 tunes, onboarding guides, remote config defaults. Every level is solver-proven; `pnpm levels:check` passes with no errors. |
| Web app | Home, map, play (Pixi board), daily, shared link and tutorial, songbook, settings, restore code, privacy, install prompt, survey, Arabic (RTL) and English. |
| Audio | Web Audio synth for glass tones and effects, play-along and auto-play, iOS unlock and silent-switch handling, sampler hook for recorded glass samples. |
| Save | IndexedDB saves after every move, resume, restore code round trip. |
| Ops | Analytics queue with sessions and batching (console, memory, HTTP and null adapters), error reporter, remote config, A/B flags. |
| PWA | Offline play after the first load, hashed immutable level packs, strict CSP and cache headers, size budget (`pnpm size`). |
| Accessibility | Keyboard play, live region, reduced motion, native form controls, axe checks on every screen. |
| Tooling | Level workbench at `/dev/level` (development builds only). |
| Performance | Low-effects mode switches on by itself below 40 fps, `?fps=1` overlay in test builds, size budget, Lighthouse report job in CI (advisory). |

## Checked

- `pnpm verify`: lint and format, typecheck, unit tests, production build, no test hook in the build, size budget.
- `pnpm test:e2e`: Playwright in Chromium: first-run flow, campaign and unlocks, guided levels, world 2 faucet intro, hints and stars, daily and share text, streak, shared-link tutorial, settings, RTL, restore round trip, offline play, install prompt, survey, analytics order, CSP headers, axe.
- `pnpm test:e2e:full` (slow, not part of CI): every one of the 60 campaign levels and 60 daily puzzles is played to the end with real taps, following the solver's hints, and finishes in exactly par moves.
- WebKit runs in CI only (the sandbox has no WebKit).

## Needs people

These cannot be done from a repository and are tracked as decisions in the plan.

| Item | Why it is blocked |
|---|---|
| Tune rights (`content/tunes.json`, `rights: "pending"`) | Each tune needs clearance or replacement before a release build (`levels:check --release` refuses pending rights). |
| Art and audio | The board uses drawn placeholder glyphs and the synth. Recorded glass samples and final art follow the manifest formats in `docs/architecture/06-audio.md`. |
| Production domain (DEC-6) | Saves and installs are tied to the origin. |
| Analytics vendor (DEC-7) | The HTTP adapter sends to any collector named by `VITE_ANALYTICS_URL`. GameAnalytics needs the spike in `docs/architecture/09-ops.md`. |
| Arabic review | The Arabic strings are a first draft and need a native speaker. |
| Device checks | iPhone 8 audio with the silent switch on, frame rate on the reference Android phone, Lighthouse on a throttled connection. |
| Level tuning | The seeded campaign is a first draft. Designers play it in `/dev/level`, adjust, and re-run `levels:prove --write`. |
