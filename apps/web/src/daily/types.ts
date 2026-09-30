/**
 * CONTRACT FILE. Local calendar dates for the daily puzzle (rule 17, FR-21).
 * Spec: docs/architecture/08-save-daily-share.md §3. Do not change in an implementation issue.
 */

/** A calendar date with no time zone. month is 1-12. */
export interface LocalDate {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

export interface ShareCardInput {
  puzzleNo: number;
  moves: number;
  par: number;
  stars: 1 | 2 | 3;
  /** Absolute origin, e.g. "https://clink.example". No trailing slash. */
  origin: string;
}
