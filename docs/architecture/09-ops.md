# 09 · Ops: analytics, sessions, errors, remote config, A/B flags

Requirements: FR-36 to FR-39, NFR-10, NFR-11, and the BRD's "Analytics events and KPIs".

## 1. Analytics (`ops/analytics.ts`, `ops/events.ts`)

The contract is `ops/events.ts`: 17 typed events, the 16 in the BRD plus `survey_answer`.

### 1.1 Pipeline

```
track(name, props)
  → envelope { name, props, ts: Date.now(), seq: ++profile.eventSeq, sessionId, deviceId, appVersion: __APP_VERSION__ }
  → appended to the in-memory queue, and persisted to IndexedDB key "events" (at most 500; oldest dropped)
flush() (every 10 s, on visibilitychange→hidden, on pagehide)
  → adapter.send(queue in seq order, in batches of at most 50)
  → on success, remove them from the queue and IndexedDB; on failure, keep them and retry on the next flush
```

- **Adapters** implement `AnalyticsAdapter`:
  - `ConsoleAdapter` in development and tests: it logs each envelope;
  - `HttpAdapter`: posts `{ "events": [...] }` to the collector named by the build-time variable
    `VITE_ANALYTICS_URL` (add its origin to `connect-src` in `public/_headers`). Production uses
    it when the variable is set and sends nothing otherwise;
  - `GameAnalyticsAdapter` after DEC-7, whose mapping the DEC-7 spike issue settles;
  - `NullAdapter` when `profile.tester` is true in production. Testers are excluded at the
    source, and the events are still logged to the console.
- **Order:** events are sent in `seq` order. FR-36's test runs a scripted Playwright session
  against a stub adapter and checks that every event arrives in order, within 5 minutes.
- **No personal data** (NFR-10): only the random `deviceId`, never names, emails or IP-derived
  data. Free text never enters props, except error messages (§2).

### 1.2 Sessions (D27)

- A session starts at bootstrap, and when the page becomes visible after
  `Date.now() - profile.lastActiveAt >= 30 min`.
- Each start: a new `sessionId` (`crypto.randomUUID()`), `profile.sessionCount += 1`, and
  `session_start`:
  - `platform`: ios / android / desktop / other, from the UA;
  - `browser`: a short name;
  - `installed`: `matchMedia('(display-mode: standalone)').matches ||
    navigator.standalone`;
  - `locale`: the i18n locale;
  - `sound_on`: `settings.sound`;
  - `app_version`;
  - `ab_flags`: the flags' `assignments`;
  - `source`, `tester`;
  - `session_no`: `sessionCount`;
  - `first_session`: `sessionCount === 1`.
- Any pointer input updates `profile.lastActiveAt`, throttled to one write per minute.

### 1.3 When each event fires

| Event | Fired by |
|---|---|
| `session_start` | §1.2 |
| `ftue_step` | Guide step completed (05 §8) |
| `level_start`, `move`, `hint_used`, `level_tuned`, `level_complete`, `level_abandon` | Play screen (05 §5–6). Dailies use their `dNNN` id as `level_id`. |
| `daily_start`, `daily_complete` | Play screen for dailies |
| `share_complete` | Share button (08 §4) |
| `link_open` | `LinkScreen` (05 §10) |
| `install` | `appinstalled` |
| `setting_change` | Settings screen, and the first-launch sound choice (`setting: 'sound'`) |
| `audio_state` | Every `AudioEngine` status change: `{ state: status, sound_on }` |
| `error` | §2 |
| `survey_answer` | Survey modal |

## 2. Errors (`ops/errors.ts`, FR-37)

- **`installErrorHandlers()`:** `window.addEventListener('error', ...)` and
  `('unhandledrejection', ...)`. Each becomes
  `track('error', { message, stack, level_id: currentLevelId ?? null })`.
  - Messages are truncated to 500 characters and stacks to 4,000.
  - Duplicates are ignored (same message and first stack line within 60 s), with at most 20
    errors per session.
  - Failed content loads (manifest, pack, audio) also send `error`.
- **Source-mapped stacks (FR-37):**
  - Error events go through `ErrorReporter { report(error: Error, context: { levelId })
    }`.
  - The default reporter only sends the analytics `error` event. If the DEC-7 spike finds
    that GameAnalytics cannot show source-mapped stacks, a second reporter (Sentry with
    `sendDefaultPii: false` and no IP storage, or self-hosted GlitchTip) is added behind
    the same interface.
  - Its origin is added to the CSP `connect-src` (07 §3). Hidden source maps are uploaded
    in the release job.
- **Test:** `?debug=throw` raises a test error 1 s after load. It is available in every build
  and does nothing else.

## 3. Remote config (`ops/config.ts`, FR-38, NFR-11)

- **Source:** `content/config.json` is copied to `/config.json` at build (03 §6). It is
  edited and redeployed without an app update, which is just a content deploy.
- **`loadRemoteConfig()`:** fetch `/config.json` with `cache: 'no-store'`. The service worker
  handles it network-first with a 3 s timeout. If that fails, use the last good copy from
  IndexedDB key `config`, and failing that the built-in default, `DEFAULT_CONFIG` from
  `content/config.json` imported at build time.
- **Refresh:** every `refreshMinutes` (30) while the app is open, and on each visibility
  change to visible. A disabled level therefore disappears within an hour (FR-38).
- **Validation:** `schemaVersion === 1`, every field of the right type. If invalid, keep the
  previous config and report an `error`.
- **Effects:**
  - `disabledLevels` → the map and unlocks (05 §9, D24). A level open on screen stays
    playable until the player leaves it.
  - `dailyOverrides` → `dailyLevelId` (08 §3).
  - `experiments` → flags (§4).

## 4. A/B flags (`ops/flags.ts`, FR-39)

Acceptance tests: `apps/web/test/acceptance/flags.test.ts`.

- `bucketOf(deviceId, key) = fnv1a32(`${deviceId}:${key}`) % 100`. Stable per device.
- `assignVariant(bucket, weights)`: walk the weights in key order; return the first variant
  whose running total is greater than `bucket`; if none is, return the first key.
- `resolveFlags(config, deviceId)`: for each experiment in key order, assign a variant and
  merge its flag values into `flags` (later experiments win on a clash).
- **Known flags:**
  - `twoStarFactor` (number, default 1.5), used by `starsFor` (05 §6);
  - `onboardingVariant` (string, default `"a"`), which picks
    `guides.levels[levelId + ':' + variant]` over `guides.levels[levelId]` when present.
- **Timing:** flags are resolved at bootstrap and logged in every `session_start.ab_flags`.
  Config refreshes change flags only at the next session start, so a player never switches
  variant mid-session.
