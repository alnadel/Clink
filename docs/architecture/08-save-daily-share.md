# 08 · Save, restore code, daily puzzle, share, streak

## 1. Save store (`save/store.ts`, FR-32, NFR-08)

Contract: `save/types.ts`.

- **Storage:** `idb-keyval` with a custom store,
  `createStore('clink', 'kv')`, under the keys `profile`, `progress`, `current` and `events`
  (the analytics queue, 09 §1).
- **`loadProfile()`:** if there is no record, create one:
  - `schema: 1`; `deviceId: crypto.randomUUID()`; `createdAt: new Date().toISOString()`;
    `firstSessionDate: formatLocalDate(localDateOf(new Date()))`;
  - `source: null`, `tester: false`, `soundChoiceMade: false`;
  - `settings: DEFAULT_SETTINGS`, `seenGuides: []`, `levelAttempts: {}`;
  - `installPromptCount: 0`, `surveyAnswered: false`, `sessionCount: 0`,
    `lastActiveAt: Date.now()`, `eventSeq: 0`.

  Save it, and return it with a flag saying it is new:
  `createSaveStore()` exposes `wasProfileCreated(): boolean`.
- **`loadProgress()`:** returns `{ schema: 1, levels: {}, dailies: {} }` when there is no
  record.
- **Migrations:** each load checks `schema`. There are none yet. When a shape changes, bump
  `schema` and add `migrate<Name>V1toV2` in `save/migrations.ts`.
- **`requestPersistence()`:** `navigator.storage?.persist?.()`, falling back to `false`.
  Call it once after the first user gesture.
- **Every write is awaited,** and a failure is reported as an `error` event (09 §2). The game
  keeps working from memory.
- The whole game state is `current.moves`: resume replays them (05 §3.5). **Save after every
  move** (FR-32): the E2E test closes the tab mid-level, reopens it and expects the same
  state.

## 2. Restore code (`save/restore-code.ts`, FR-33, D22)

Acceptance tests with golden strings: `apps/web/test/acceptance/restore-code.test.ts`.

### 2.1 Bit layout (MSB first)

| Field | Bits | Value |
|---|---|---|
| version | 4 | `1` |
| levelStars | 60 × 2 | slot per campaign level in `manifest.levelOrder` order; 0 = unsolved, 1–3 = stars |
| dailyCount | 10 | N = `dailyStars.length` (0–1023) |
| dailyStars | N × 2 | index k − 1 = puzzle k; 0 = unsolved, 1–3 = stars |
| sound | 1 | 1 = on |
| autoPlaySong | 1 | 1 = on |
| labels | 2 | 0 none, 1 letters, 2 solfege |
| language | 2 | 0 system, 1 en, 2 ar |
| reducedMotion | 2 | 0 system, 1 on, 2 off |
| vibration | 1 | 1 = on |
| checksum | 16 | `fnv1a32Bytes(payloadBytes) & 0xffff` |

The **payload** is every field above the checksum. `payloadBytes` packs the payload bits
MSB-first into bytes, and zero-pads the last byte.

### 2.2 Text encoding

- Append the 16 checksum bits to the payload bits.
- Pad with zero bits to a multiple of 5.
- Map each 5 bits to Crockford base32 `0123456789ABCDEFGHJKMNPQRSTVWXYZ`.
- Split into groups of 4 characters joined with `-`.

The empty code is `2000-0000-0000-0000-0000-0000-0010-43SA`.

### 2.3 Decoding, in order

1. Normalize: uppercase; remove `-` and whitespace; `O` → `0`; `I` and `L` → `1`.
2. An empty string, or any character outside the alphabet → `format`.
3. Expand to bits and read fields in order. Running out of bits → `format`.
4. Version ≠ 1 → `version`. Check this before anything else.
5. A settings value out of range (e.g. labels = 3) → `format`.
6. After the checksum, the remaining bits must number fewer than 5 and all be 0. Otherwise →
   `format`.
7. The checksum does not match → `checksum`.

### 2.4 Import and export

- **Export:** `progressToRestoreData(progress, manifest.levelOrder, settings)` gives each slot
  its level's stars, or 0. `dailyStars` runs to the highest solved puzzle number.
- **Import (D22):** best stars per level and daily; restored dailies get `moves: 0, par: 0`.
  The code's settings replace the current ones. `deviceId` and every other profile field are
  unchanged.
- **UI:** Settings shows the code and a link `${origin}/restore#${code}`. `/restore` decodes
  `location.hash`, shows a summary ("12 levels, 5 dailies") with a Confirm button, then
  imports.

## 3. Daily puzzle numbers (`daily/dates.ts`, rule 17, FR-21)

Acceptance tests: `apps/web/test/acceptance/daily.test.ts`.

- Dates are `LocalDate { year, month (1–12), day }`. **All day arithmetic uses
  `Date.UTC(year, month - 1, day)`**, so time zones and DST never matter.
- `localDateOf(new Date())` reads the device's local calendar date with `getFullYear`,
  `getMonth() + 1` and `getDate()`.
- `puzzleNumber(today, launch) = daysBetween(launch, today) + 1`. Launch day is #1, and the
  launch date is `schedule.launchDate` (2026-11-30). Two devices on the same local date get
  the same number (FR-21).
- `dailyLevelId(n, schedule, config.dailyOverrides)`: the override first, then
  `puzzles[(n - 1) % puzzles.length]` (D16). `null` if `n < 1` or there is nothing to play.
- `/daily` recomputes the number at open. A daily left open past midnight stays that puzzle.

## 4. Share card (`daily/share.ts`, FR-22)

Exact text, three lines joined by `\n`:

```
Clink #<n> <'⭐' × stars>
<'💧' × moves> <moves>/<par>
<origin>/d/<n>?src=share
```

`origin` is `location.origin`. There is one drop per move, and no board state, glass or
note is shown.

**Share button:**
1. If `navigator.share` exists, call `navigator.share({ text })`. On success,
   `track('share_complete', { puzzle_no, method: 'share' })`. A rejection (the user
   cancelled) tracks nothing.
2. Otherwise `navigator.clipboard.writeText(text)`, show the toast `t('daily.copied')`, and
   `track(..., { method: 'clipboard' })`.

## 5. Streak (`daily/streak.ts`, FR-24)

`currentStreak(solvedPuzzleNumbers, todayNo)`:
- start at `todayNo` if it is solved, otherwise at `todayNo - 1`;
- count back while each number is solved.

Solved numbers come from the keys of `progress.dailies`. The streak is derived, never
stored, so a restore code restores it too.
