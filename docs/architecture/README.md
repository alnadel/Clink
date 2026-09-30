# Clink solution architecture

This folder is the technical specification of the Clink web MVP. It is written so that an
implementer, human or AI, can build one GitHub issue at a time without making design
decisions. If something is not written here, it is not decided. Ask on the issue instead of
guessing.

- Business requirements: *Clink: Business Requirements Document (Web MVP)* (the BRD). This
  spec uses its IDs: rules 1–17, FR-01–39, NFR-01–14.
- Schedule, phases and gates: [../implementation-plan.md](../implementation-plan.md).
- How to work on an issue: [../../AGENTS.md](../../AGENTS.md).

## Documents

| # | Document | Covers |
|---|---|---|
| 01 | [Decisions](01-decisions.md) | Every rule gap and design choice, pinned (D1–D32) |
| 02 | [Rules engine](02-rules-engine.md) | `@clink/rules`: notes, level compile, state, moves, solver, hints, stars, hashing |
| 03 | [Content pipeline](03-content-pipeline.md) | Content files, `levels:check`, `levels:prove`, `levels:gen`, `packs:build` |
| 04 | [Repo and tooling](04-repo-and-tooling.md) | Workspace, commands, versions, CI, testing strategy, conventions |
| 05 | [Web app](05-web-app.md) | Routes, screens, game session, board, play-along, guides, hint worker |
| 06 | [Audio](06-audio.md) | Glass instrument, synth fallback, scheduling, iOS audio |
| 07 | [Platform](07-platform.md) | PWA, service worker, caching, hosting headers, CSP, deploy |
| 08 | [Save, daily, share](08-save-daily-share.md) | IndexedDB, restore code, puzzle numbers, share card, streak |
| 09 | [Ops](09-ops.md) | Analytics events, sessions, error reporting, remote config, A/B flags |
| 10 | [i18n and accessibility](10-i18n-a11y.md) | Strings, RTL, note glyphs and colours, labels, reduced motion, WCAG |

## Principles

1. **One rules engine.** `packages/rules` is the only implementation of rules 1–17. The
   game, the hint worker and every content tool import it, and nothing else
   re-implements a rule (NFR-14).
2. **Contracts first.** Types that cross module boundaries live in *contract files*, which
   start with `CONTRACT FILE`. Implementation issues fill in stubs behind those contracts
   and must not edit them.
3. **Acceptance tests first.** Where behaviour is exact (rules, hashes, codes, dates,
   layout, the game session), the expected results are already written as skipped tests
   under `test/acceptance/`. An issue is done when its `.skip` is removed and the tests
   pass, with the tests unchanged.
4. **Pure core, thin shell.** Logic lives in pure, DOM-free modules that are unit tested in
   Node. Preact components, Pixi drawing and browser APIs are thin layers on top, covered
   by Playwright.
5. **Content is data.** Levels, tunes, schedules, guides and config are JSON, proven by the
   solver in CI, and deployable without an app update.
6. **No servers.** Static hosting, IndexedDB on the device, and an analytics vendor.

## Module map

```
                       ┌──────────────────────────────┐
                       │ packages/rules (@clink/rules)│  pure TS, no DOM, no I/O
                       │ types · formats · compile ·  │
                       │ moves · solver · stars · hash│
                       └──────┬───────────────┬───────┘
                              │               │
          ┌───────────────────┘               └─────────────────────┐
          ▼                                                         ▼
┌──────────────────────────────┐                   ┌─────────────────────────────────┐
│ packages/content-tools       │  Node CLIs        │ apps/web (@clink/web)           │
│ levels:check · levels:prove  │ ───────────────▶  │ public/content/ (generated)     │
│ levels:gen · packs:build     │  writes packs     │                                 │
└──────────────────────────────┘                   │ game/    session (pure)         │
                                                   │ board/   layout (pure) + Pixi   │
                                                   │ audio/   Web Audio engine       │
                                                   │ save/    IndexedDB, restore code│
                                                   │ daily/   dates, share, streak   │
                                                   │ ops/     analytics, errors,     │
                                                   │          config, flags          │
                                                   │ guide/   onboarding steps       │
                                                   │ i18n/    strings, RTL           │
                                                   │ workers/ hint worker            │
                                                   │ ui/      Preact screens         │
                                                   └─────────────────────────────────┘
```

### Dependency rules (enforced by review; the first is also enforced by Biome)

| Module | May import |
|---|---|
| `packages/rules` | nothing outside itself |
| `packages/content-tools` | `@clink/rules`, `node:*` |
| `apps/web/src/game`, `board/layout.ts`, `daily`, `ops/flags.ts`, `save/restore-code.ts`, `lib` | `@clink/rules`, their own types, `lib` (pure modules: no DOM, no `window`, no `document`) |
| `apps/web/src/board` (the rest) | `pixi.js`, `@clink/rules`, `board/types.ts`, `theme` |
| `apps/web/src/audio` | browser audio APIs, `audio/types.ts` |
| `apps/web/src/ui` | anything in `apps/web/src` |
| `apps/web/src/workers` | `@clink/rules`, `workers/protocol.ts` |

Nothing imports from `ui/`, except `app.tsx`.

## Data flow for one move

```
pointerdown on canvas ──▶ Board.onGlassTap(i)
                         ──▶ PlayScreen: session.tapGlass(i) ──▶ GameEffect[]
                               for each effect, in order:
                                 ring          ─▶ audio.ring(hz)
                                 select        ─▶ board.setSelected
                                 shake         ─▶ board.shake + audio.sfx('refuse')
                                 move          ─▶ board.animateMove(events, onStep ─▶ audio.ring both glasses)
                                                  save.saveCurrent(...)          (FR-32)
                                                  analytics.track('move', ...)   (FR-36)
                                 found         ─▶ board.setFound + audio.sfx('found') if gained
                                 tuned         ─▶ lock, flourish, play-along (rule 12), solve card
```

## Backlog

The work is split into small GitHub issues, grouped by gate. Each epic lists its issues with
their dependencies:

- [#1 Gate 1 · Fun (Oct 14)](https://github.com/alnadel/Clink/issues/1): rules engine, content tools, playable prototype
- [#2 Gate 2 · Alpha (Nov 4)](https://github.com/alnadel/Clink/issues/2): map, onboarding, analytics, PWA, World 1 content
- [#3 Gate 3 · Launch ready (Nov 25)](https://github.com/alnadel/Clink/issues/3): daily, share, settings, config, accessibility, Worlds 2–3

Issues labelled `ai-ready` are fully specified. Issues labelled `needs-human` need a decision,
a device, content or a review first.
