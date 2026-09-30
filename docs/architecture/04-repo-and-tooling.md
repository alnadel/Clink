# 04 · Repo and tooling

## 1. Layout

```
package.json            root scripts (pnpm workspace)
pnpm-workspace.yaml     packages/*, apps/*
tsconfig.base.json      strict TS settings shared by every package
biome.json              lint + format (not applied to content/)
vitest.config.ts        runs every workspace's tests as Vitest projects
.github/workflows/ci.yml

packages/rules/         @clink/rules: the rules engine (02)
packages/content-tools/ @clink/content-tools: content CLIs (03)
apps/web/               @clink/web: the PWA (05-10)
content/                levels, tunes, schedule, guides, config (03)
docs/                   plan and architecture
```

Workspace packages are consumed **as TypeScript source**: `@clink/rules` exports
`./src/index.ts` directly. Vite, Vitest and `tsx` compile it on the fly, and there is no
build step or `dist/` for internal packages.

## 2. Commands (run from the repo root)

| Command | What it does |
|---|---|
| `pnpm install` | Install everything. Use `--frozen-lockfile` in CI. |
| `pnpm verify` | Everything CI runs: `check`, `typecheck`, `test`, `build`. **Run before every push.** |
| `pnpm check` | Biome lint and format check. |
| `pnpm fix` | Biome auto-fix and format. |
| `pnpm typecheck` | `tsc` in every workspace. |
| `pnpm test` | All Vitest projects once. `pnpm test:watch` for watch mode. |
| `pnpm exec vitest run --project rules` | One project (`rules`, `content-tools`, `web`). |
| `pnpm dev` | Vite dev server for the web app. |
| `pnpm build` | Production build of the web app into `apps/web/dist/`. |
| `pnpm levels:check` etc. | Content CLIs ([03 §2](03-content-pipeline.md)); added by their issues. |
| `pnpm test:e2e` | Playwright ([§5](#5-testing-strategy)); added by its issue. |

## 3. Pinned versions (D29)

Node 22 (`.nvmrc`), pnpm 10.33.0 (`packageManager`), TypeScript 7.0.2, Vite 8.3.1, Vitest
5.0.2, Biome 2.5.14, Preact 10.29.8, preact-iso 2.12.2, PixiJS 8.21.0, idb-keyval 6.3.0,
vite-plugin-pwa 1.3.0, Playwright 1.63.0, fast-check 4.10.2, tsx 4.23.15.

`.npmrc` sets `save-exact=true`. **Do not add, remove or upgrade dependencies** unless the
issue says so, and never add a runtime dependency to `packages/rules`.

## 4. TypeScript rules

`tsconfig.base.json` is strict, with `noUncheckedIndexedAccess`. That means `arr[i]` has
type `T | undefined`. Handle it like this:

```ts
// Good: read into a local and check it once.
const glass = level.glasses[i];
if (!glass) throw new RangeError(`no glass ${i}`);

// Good: loop with for...of or entries() instead of indices.
for (const [i, glass] of level.glasses.entries()) { ... }

// Good: a default when a missing value is genuinely fine.
const beats = melody.beats[i] ?? 1;

// Bad: non-null assertions are a lint error (style/noNonNullAssertion).
level.glasses[i]!.capacity
```

In hot loops (the solver), `water[i] as number` is acceptable when the index is provably in
range. Leave a short comment when you do it.

Other rules:
- `verbatimModuleSyntax`: import types with `import type { X }` or `import { type X }`.
- No `any`: it is a lint error. Use `unknown` and narrow it.
- `packages/rules` compiles without DOM types, so `window`, `document` and `setTimeout` do not
  exist there.

## 5. Testing strategy

| Layer | Tool | Where | What |
|---|---|---|---|
| Acceptance | Vitest | `packages/*/test/acceptance/`, `apps/web/test/acceptance/` | Architecture-owned, exact expectations. Implementers only remove `.skip`. |
| Unit | Vitest (+ fast-check) | Next to the module (`foo.test.ts`) or `test/` | Implementer-written tests for anything else. Node environment, no DOM. |
| Content | `levels:check` | CI | Every level proven by the solver (FR-19). |
| End-to-end | Playwright | `apps/web/e2e/*.spec.ts` | Real browser flows: first launch, play a level, undo, save and resume, offline, daily and share, settings, RTL, axe accessibility, headers. Chromium and WebKit. |
| Device | Manual | Reference phones (NFR-07) | Frame rate, audio latency, iOS silent switch: weekly from Oct 26. |

Rules for tests:
- Pure modules (`game/`, `board/layout.ts`, `daily/`, `ops/flags.ts`, `save/restore-code.ts`)
  are unit tested in Node. Do not add jsdom or happy-dom.
- Preact components and Pixi drawing are covered by Playwright, not unit tests.
- **Never change an acceptance test's expectations.** If one looks wrong, stop and comment on
  the issue.
- Never skip, disable or delete a failing test to get CI green.

## 6. CI (`.github/workflows/ci.yml`)

It runs on every push and pull request:

1. `pnpm install --frozen-lockfile`
2. `pnpm check`
3. `pnpm typecheck`
4. `pnpm test`
5. `pnpm build`

Later issues add steps: `pnpm levels:check` after tests, `pnpm test:coverage` (the 90% gate on
`@clink/rules`), and a Playwright job.

## 7. Git conventions

- One issue → one branch → one pull request. Branch name: `issue-<number>-<short-slug>`.
- Conventional commit titles: `feat(rules): implement applyMove (#12)`, `fix(web): ...`,
  `test: ...`, `docs: ...`, `chore: ...`.
- The PR description says `Closes #<issue>` and lists the acceptance criteria as checked boxes.
- Keep PRs small. If an issue turns out bigger than its description, stop and comment instead
  of widening it.

## 8. Code style

- Biome formats everything (2 spaces, single quotes, semicolons, 110 columns). Run `pnpm fix`.
- Named exports only; no default exports, except where a tool requires them (config files).
- File names in kebab-case (`restore-code.ts`). Preact components in PascalCase
  (`PlayScreen.tsx`), one component per file.
- Comments explain *why*, citing the BRD ID or decision (`// rule 9`, `// D2`). Do not narrate
  what the code does.
- Every user-visible string goes through `t()` ([10](10-i18n-a11y.md)); no string literals in
  UI markup.
