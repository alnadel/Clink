# Content

Everything the game plays is data in this folder. The formats are defined in
`packages/rules/src/formats.ts` and `packages/rules/src/types.ts`, and explained in
`docs/architecture/03-content-pipeline.md`.

| Path | What | Edited by |
|---|---|---|
| `levels/w1/w1-01.json` … `levels/w3/w3-20.json` | The 60 campaign levels | Designer (from generator candidates) |
| `daily/d001.json` … | Daily puzzles | Designer |
| `tunes.json` | Tune titles, Songbook origins, rights status, phrase transcriptions | Designer, rights reviewer |
| `bands.json` | World constraints and difficulty bands for the generator | Designer |
| `schedule.json` | Launch date and daily puzzle order | Product owner |
| `guides.json` | Onboarding, mechanic intros, link tutorial | Designer |
| `config.json` | Remote config: kill switch, daily overrides, A/B experiments | Product owner |
| `candidates/` | Generator output (git-ignored) | Generator |

`par` and `optimalSolutions` in level files are written by `pnpm levels:prove --write`; never type them by hand.
