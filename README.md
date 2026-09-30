# Clink

A casual puzzle game where every glass is a musical note: pour water between glasses to tune
them to a melody, then tap them to play the song you built.

This repository holds the web MVP: a mobile-first, installable PWA written in TypeScript.

## Documents

- [Implementation plan](docs/implementation-plan.md): phases, gates, requirement traceability.
- [Solution architecture](docs/architecture/README.md): the exact specification every issue is built from.
- [AGENTS.md](AGENTS.md): how to implement an issue (read before contributing).
- [Content](content/README.md): levels, tunes, schedule and config files.

## Getting started

```sh
nvm use            # Node 22
corepack enable    # pnpm 10
pnpm install
pnpm verify        # lint, typecheck, tests, build, size budget
pnpm dev           # web app; `/dev/level` is the level workbench
pnpm test:e2e      # Playwright (set PW_CHROMIUM_EXECUTABLE to use a preinstalled Chromium)
pnpm test:coverage # rules engine coverage floor (90%)
```

Content commands:

```sh
pnpm levels:check   # FR-19: every level, tune, schedule and guide file is valid
pnpm levels:prove   # solve every level and compare par and optimalSolutions
pnpm levels:gen     # propose new levels for a tune, world and difficulty band
pnpm content:seed   # deterministic first-draft campaign and daily puzzles (never overwrites)
pnpm packs:build    # hashed level packs and the manifest (runs before dev and build)
```

## Layout

| Path | What |
|---|---|
| `packages/rules` | `@clink/rules`: the only implementation of the game rules, the solver and the hints |
| `packages/content-tools` | CLIs: level checker, prover, generator, pack builder |
| `apps/web` | The PWA: Preact UI, PixiJS board, Web Audio |
| `content` | Levels, tunes, daily schedule, guides, remote config |
