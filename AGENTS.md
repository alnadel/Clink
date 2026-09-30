# AGENTS.md: how to implement a Clink issue

Read this whole file before you start any issue. It applies to every contributor, human or AI.

## What this repo is

Clink is a mobile-first puzzle game (a PWA) in which every glass of water is a musical note.
The design is fully specified in [`docs/architecture/`](docs/architecture/README.md). Your job
is to implement **one GitHub issue at a time**, exactly as specified. You are not asked to
make design decisions.

## Workflow

1. **Read the issue completely.** Then read every document section and contract file it
   links. Do not start coding before that.
2. **Check dependencies.** Every issue listed under "Depends on" must be closed (merged).
   If one is open, stop and say so on the issue.
3. **Branch** from the default branch: `issue-<number>-<short-slug>`.
4. **Implement only the files the issue lists.** Replace stubs that throw
   `NotImplementedError` with real code. Keep exported names and signatures exactly as they
   are.
5. **Acceptance tests:** if the issue names files under `test/acceptance/`, change
   `describe.skip(` to `describe(` in them. **Change nothing else in those files.**
6. **Write your own unit tests** for anything the issue asks for beyond the acceptance tests.
7. **Run `pnpm verify`** (lint, typecheck, tests, build) until it passes. Then run any extra
   command the issue lists, such as `pnpm levels:check` or `pnpm test:e2e`.
8. **Commit** with a conventional title: `feat(rules): implement applyMove (#10)`.
9. **Open a pull request** whose description says `Closes #<number>` and copies the issue's
   acceptance criteria as a checked list.

## Never do these

- Never edit a file that starts with `CONTRACT FILE`, or anything in `test/fixtures/`.
- Never change expectations in `test/acceptance/`; only remove `.skip`.
- Never skip, delete or weaken a failing test to make CI pass.
- Never add, remove or upgrade a dependency unless the issue says so, and then use the
  exact version it gives.
- Never use `any`, non-null assertions (`x!`), `@ts-ignore`, `@ts-expect-error` or
  `biome-ignore` comments.
- Never import DOM, browser or Node APIs in `packages/rules`, or in the pure modules listed
  in [docs/architecture/README.md](docs/architecture/README.md#dependency-rules-enforced-by-review-the-first-is-also-enforced-by-biome).
- Never use `localStorage` or `sessionStorage`; persistence goes through `SaveStore`.
- Never time audio with `setTimeout`; schedule on the `AudioContext` clock.
- Never put user-visible text in markup; use `t('key')` and add the key to
  `apps/web/src/i18n/en.json`.
- Never leave `console.log` in shipped code, except in `ConsoleAdapter`.
- Never touch files the issue does not list. If you think another file must change, stop and
  comment on the issue.
- Never re-implement a game rule outside `packages/rules`. Import it from `@clink/rules`.

## When you are stuck

- If a spec section is ambiguous, contradicts itself, or does not cover your case: **stop.**
  Comment on the issue with the exact question and the options you see. Do not guess.
- If an acceptance test seems wrong: **stop** and comment with the test name, the expected
  value and why you think it is wrong. The fixtures were produced by a verified reference
  implementation, so re-read the spec first.
- If `pnpm verify` fails in code you did not touch: comment on the issue with the error
  output.

## TypeScript idioms used here

`noUncheckedIndexedAccess` is on, so `array[i]` has type `T | undefined`:

```ts
const glass = level.glasses[i];
if (!glass) throw new RangeError(`glass ${i} out of range`);   // check once, then use `glass`

for (const [i, glass] of level.glasses.entries()) { /* both defined */ }

const water = [...state.water];                                   // copy before changing
water[from] = (water[from] ?? 0) - 1;                             // `?? 0` when the index is known valid
```

- Types are imported with `import type { X }` or `import { type X }`.
- State objects are immutable. Build new arrays and objects; never mutate an argument.
- Use `null` for "no value" in data (never `undefined` in objects you return).
- Named exports only.

## Definition of done

- [ ] Only the files listed in the issue changed, plus `pnpm-lock.yaml` if the issue added a
      dependency.
- [ ] Every stub the issue names is implemented, with no `NotImplementedError` left in it.
- [ ] The named acceptance tests are unskipped and pass unchanged.
- [ ] The extra tests the issue asks for exist and pass.
- [ ] `pnpm verify` passes locally.
- [ ] The PR description has `Closes #<n>` and the checked acceptance criteria.

## Commands

```sh
pnpm install                         # once
pnpm verify                          # before every push: check + typecheck + test + build
pnpm fix                             # auto-format and fix lint
pnpm exec vitest run --project rules # one test project: rules | content-tools | web
pnpm dev                             # run the web app
```
