# 02 · Rules engine (`packages/rules`)

`@clink/rules` is the single implementation of the BRD's canonical rules 1–17. It runs on the
main thread, in the hint worker and in Node (CI). It is **pure**: no DOM, no timers, no I/O, no
randomness, and no mutation of inputs.

- Contracts: `src/types.ts`, `src/errors.ts`, `src/formats.ts` (do not edit).
- Stubs to implement: `src/notes.ts`, `src/compile.ts`, `src/state.ts`, `src/moves.ts`,
  `src/stars.ts`, `src/solver.ts`, `src/hash.ts`.
- Acceptance tests: `test/acceptance/*.test.ts`. Fixtures in `test/fixtures/` were produced
  by a reference implementation that reproduces BRD Appendix A exactly.

## 1. Vocabulary

| Term | Meaning in code |
|---|---|
| Position (`Pos`) | Index into `level.positions`, the level's scale notes inside its range, ascending. 0 is the lowest. |
| Ringing | The position a glass rings: `glass.emptyPos - water` (rule 2). |
| Target | A distinct phrase position (rule 5), in `level.targets` in order of first appearance. |
| Found | A target that some glass rings right now (rule 10). |
| Tuned | Every target found at once (rule 11). |

## 2. Note names: `parseNote(name)`

- Grammar: `/^([A-G])([#b]?)([0-9])$/`. Anything else throws `LevelError('E_NOTE_NAME')`,
  including lowercase letters, `♯`, spaces, double accidentals, negative octaves and
  two-digit octaves.
- `midi = 12 * (octave + 1) + {C:0, D:2, E:4, F:5, G:7, A:9, B:11}[letter] + (# → +1, b → −1)`.
- Return `midi * 100` (absolute cents). So C4 → 6000, A4 → 6900, Db4 → 6100, Cb4 → 5900.

## 3. Compiling a level: `compileLevel(json)`

Validate in **exactly this order** and throw `LevelError(code, message)` at the first
failure. Every code is covered by `test/acceptance/compile.test.ts`.

1. **E_SCHEMA:** JS types and simple values.
   - `schemaVersion === 1`; `id` is a non-empty string; `world` is 1, 2 or 3.
   - `scale` is an object with a number `tonicHz`, an array `stepsCents`, and a `range` array
     of 2 strings.
   - `melody` has array `notes`, array `beats` and a number `bpm`; `glasses`, `tools` and `ice`
     are arrays.
   - `40 <= bpm <= 240`; `beats.length === notes.length`; every beat `> 0`.
   - `tools` holds only `'faucet'` / `'sink'`, with no duplicates.
2. **Scale.**
   - Parse `range[0]` and `range[1]` with `parseNote`, which throws E_NOTE_NAME on a bad name.
   - Then E_RANGE if any of these holds:
     - `tonicHz <= 0`;
     - `stepsCents` is empty, does not start at 0, is not strictly increasing, or has a value
       `>= 1200`;
     - `low >= high`.
   - Build positions:
     ```
     tonicMidi  = Math.round(69 + 12 * Math.log2(tonicHz / 440))     // 130.81 Hz → 48 (C3)
     tonicCents = tonicMidi * 100
     cents = []
     for k in -11..11: for s in stepsCents:
         c = tonicCents + 1200 * k + s
         if low <= c <= high: cents.push(c)
     sort ascending
     ```
   - E_RANGE if `cents[0] !== low` or `cents[last] !== high` (a range endpoint is off the
     scale).
   - For each index `i`: `{ pos: i, cents: c, hz: tonicHz * 2 ** ((c - tonicCents) / 1200),
     name, pitchClass, octave }`, where `midi = c / 100`, `pitchClass = midi % 12`,
     `octave = Math.floor(midi / 12) - 1`, and `name` uses sharps:
     `['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'][pitchClass] + octave`.
3. **E_GLASS_COUNT:** `2 <= glasses.length <= 5`.
4. **Glasses**, in array order. For each glass:
   - E_GLASS: `id` is empty or already used; `capacity` is not an integer in 2..12; `water`
     is not an integer in 0..capacity.
   - `emptyNote`: E_NOTE_NAME if unparsable, E_OFF_SCALE if its cents are not one of the
     positions.
   - E_FILL_RANGE if `emptyPos - capacity < 0` (the lowest fill line is below the range).
5. **Melody.**
   - Each note gives E_NOTE_NAME or E_OFF_SCALE as above.
   - Build `targets`: distinct positions, in order of first appearance.
   - E_PHRASE if `notes.length` is not 3..8, `targets.length` is not 1..5, or
     `targets.length > glasses.length`.
   - `targetIndex[i] = targets.indexOf(notes[i])`.
6. **Ice.** E_ICE if there are more than 3 cubes; a cube's `glass` matches no glass id; or its
   `countdown` is not an integer 1..15.

Output: a `Level` (see `types.ts`). `source` is the input object itself. Copy arrays you
expose, and never mutate `json`, which the tests freeze.

`compileLevel` does **not** check `par`, `optimalSolutions`, solvability, world constraints
or tune ids. That is `levels:check` ([03](03-content-pipeline.md)).

## 4. State helpers (`state.ts`)

- `initialState(level)` → `{ water: glasses' startWater, ice: cubes' startCountdown }`.
- `ringing(level, state)[i] = level.glasses[i].emptyPos - state.water[i]`.
- `foundTargets(level, state)` → one boolean per target: `ringing(...).includes(target)`.
- `isTuned` → `foundTargets(...).every(Boolean)`.
- `stateKey(state)`: a unique number for Map/Set keys.
  ```
  key = 0; m = 1
  for w of water: key += w * m; m *= 16
  for c of ice:   key += c * m; m *= 16
  ```
  Use multiplication. Bit shifts overflow 32 bits, and the worst case needs 32 bits exactly.

## 5. Moves (`moves.ts`)

### 5.1 Canonical order: `allMoves(level)`

1. Pours: `for from in 0..n-1, for to in 0..n-1, from !== to`.
2. If the level has a faucet: `{type:'faucet', glass}` for glass 0..n-1.
3. If it has a sink: `{type:'sink', glass}` for glass 0..n-1.

`legalMoves(level, state)` = `allMoves(level)` filtered by `applyMove(...).ok`, same order.

### 5.2 `applyMove(level, state, move)`

Refusals are checked in this order and return exactly `{ ok: false, reason }`:

| Move | Checks in order |
|---|---|
| pour | `bad-glass` (from or to is not an integer index), `same-glass`, `empty` (from has 0), `full` (to is at capacity) |
| faucet | `bad-glass`, `no-tool` (level has no faucet), `full` (D1) |
| sink | `bad-glass`, `no-tool` (level has no sink), `empty` (D1) |

On success, working on copies of `water` and `ice`:

1. **Units.**
   - Pour: `units = min(water[from], capacity[to] - water[to])`. Repeat `units` times:
     `water[from]--`, `water[to]++`, then push
     `{type:'unit', from, to, fromPos: ring(from), toPos: ring(to)}`.
   - Faucet: `units = capacity - water`. Each step: `water[g]++`, then push
     `{type:'unit', from:null, to:g, fromPos:null, toPos: ring(g)}`.
   - Sink: `units = water`. Each step: `water[g]--`, then push
     `{type:'unit', from:g, to:null, fromPos: ring(g), toPos:null}`.
2. **Ice (D2)**, for each cube `i` in order, if `ice[i] > 0`:
   - `ice[i]--`.
   - If it is now 0: if `water[cube.glass] < capacity`, then `water[cube.glass]++` and push
     `{type:'melt', cube:i, glass, pos: ring(glass)}`; otherwise push
     `{type:'spill', cube:i, glass}`.
3. Return `{ ok: true, state: { water, ice }, units, events }`.

Use `null`, never `undefined`, for missing fields: the tests compare with `toEqual`.
`applyMove` does not refuse moves on a tuned board. The board lock belongs to the game
session.

## 6. Solver (`solver.ts`)

### 6.1 `explore(level, { maxStates = 100_000 })`

Breadth-first search from the start. It **does not stop at tuned states** (D11). The queue is
simply the `states` array.

```
start = initialState(level)
states = [start]; index = Map{ stateKey(start) → 0 }
depth = [0]; ways = [1]          // ways[j] = number of shortest move sequences reaching j
edgeFrom = []; edgeTo = []; truncated = false

for (i = 0; i < states.length; i++):
    for move of legalMoves(level, states[i]):
        next = applyMove(level, states[i], move).state
        j = index.get(stateKey(next))
        if j is undefined:
            if states.length >= maxStates: truncated = true; continue
            j = states.length; states.push(next); index.set(key, j)
            depth.push(depth[i] + 1); ways.push(0)
        edgeFrom.push(i); edgeTo.push(j)
        if depth[j] == depth[i] + 1: ways[j] += ways[i]

tuned[i]          = isTuned(level, states[i])
par               = min depth[i] over tuned states, or null if none
optimalSolutions  = sum of ways[i] over tuned states with depth[i] == par (0 if par is null)
```

Distance to goal: a reverse BFS from every tuned state over the reversed edges.

```
preds[j] = list of i for each edge i → j
dist = Int32Array(states.length).fill(-1)
queue = every tuned index, with dist = 0
BFS: for x in queue, for p in preds[x]: if dist[p] == -1: dist[p] = dist[x] + 1; push p
unsolvableStates = count of dist == -1
```

Return a `SolverGraph`:
- `reachable = states.length`;
- `par`, `optimalSolutions`, `truncated`, `states`, `unsolvableStates`;
- `distanceOf(state)`: `RangeError` if its key is not in `index`, `null` if `dist == -1`,
  otherwise `dist`.

`solve(level, options)` returns only `{ reachable, par, optimalSolutions, truncated }`.

Reference numbers (in `test/fixtures/solver-expected.json`):

| Level | reachable | par | optimalSolutions | unsolvableStates |
|---|---|---|---|---|
| w1-08 (Appendix A) | 18 | 5 | 1 | 0 |
| fx-tools | 114 | 6 | 1 | 0 |
| fx-sink | 113 | 6 | 1 | 42 |
| fx-ice | 51 | 4 | 1 | 20 |
| fx-ice-2 | 18 | 4 | 2 | 9 |

### 6.2 `hint(level, graph, state)`

```
d = graph.distanceOf(state)
d == 0    → { type: 'none' }
d == null → { type: 'restart' }
otherwise → for move of legalMoves(level, state):        // canonical order (D12)
               if graph.distanceOf(applyMove(...).state) == d - 1: return { type: 'move', move }
```

`solutionPath(level, graph)` follows `hint` from the start until `none`, and returns `[]` if
the start is tuned or unsolvable. FR-04 and FR-06 are tested over every explored state of
every fixture.

### 6.3 Performance budget

A level may have at most 100,000 states (FR-19). `explore` must finish within **1.5 s in the
hint worker on the budget reference phone**. Avoid creating closures inside the inner loop.
Numeric state keys and `Map<number, number>` are fast enough.

## 7. Stars: `starsFor(moves, par, hinted, twoStarFactor = 1.5)`

```
stars = moves <= par ? 3
      : moves <= Math.ceil(twoStarFactor * par - 1e-9) ? 2
      : 1
if hinted: stars = min(stars, 2)
```

The `- 1e-9` matters: in JavaScript `2.2 * 25 === 55.00000000000001`, and without it
`Math.ceil` returns 56.

## 8. Hashing (`hash.ts`)

FNV-1a, 32-bit:

```
hash = 0x811c9dc5
for each byte b: hash = Math.imul(hash ^ b, 0x01000193) >>> 0
```

- `fnv1a32(text)` hashes `new TextEncoder().encode(text)` (UTF-8).
- `hex8(n)` → `(n >>> 0).toString(16).padStart(8, '0')`.

Used for:
- pack and level hashes ([03](03-content-pipeline.md));
- restore-code checksums ([08](08-save-daily-share.md));
- A/B buckets ([09](09-ops.md)).

## 9. Coverage

`packages/rules` must keep **at least 90% line and branch coverage** (NFR-14). An issue
turns on `pnpm test:coverage` in CI once every stub is implemented.
