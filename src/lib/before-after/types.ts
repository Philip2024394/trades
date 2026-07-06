// Before/After types.
//
// A section can hold up to 4 "pairs". Each pair is either:
//   - dual  — two separate images (before_url + after_url), a proper
//             clip-path slider reveals more or less of the after image
//   - composite — one image with before AND after already merged into
//             a single file (top/bottom or left/right split). The
//             slider acts as a "focus divider" — the full image is
//             visible; the slider just marks the split point so the
//             user can drag to focus.
//
// The 10 seeded images are all composite (both halves in one file).
// Merchants uploading their own get dual by default (upload two
// separate photos).

export type BeforeAfterOrientation = "horizontal" | "vertical";

export type BeforeAfterMode = "dual" | "composite";

export type BeforeAfterPair = {
  /** Stable id for React keys. */
  id: string;
  /** dual = two URLs, composite = one URL (before_url only, after_url ignored). */
  mode: BeforeAfterMode;
  before_url: string;
  after_url?: string;
  orientation: BeforeAfterOrientation;
  /** Where the composite split is (percent from top/left). Only used
   *  in composite mode. Defaults to 50. */
  composite_split?: number;
  /** Optional labels — override the default "Before" / "After". */
  before_label?: string;
  after_label?: string;
  /** Optional caption shown under the slider. */
  caption?: string;
};

export type BeforeAfterSection = {
  id: string;
  /** Up to 4 pairs. First one is the main viewer; the rest render as
   *  thumbnails below. Tapping a thumbnail promotes it to main. */
  pairs: BeforeAfterPair[];
  /** Optional block heading + subhead shown above the viewer. */
  heading?: string;
  subhead?: string;
};

export type BeforeAfterLibraryEntry = {
  id: string;
  image_url: string;
  subject: string;
  /** Trade keywords using the same strict-match rule as the hero
   *  library. Merchants only see pairs their trade matches. */
  keywords_strict: string[];
  excluded_trades?: string[];
  orientation: BeforeAfterOrientation;
  mode: BeforeAfterMode;
  composite_split?: number;
  before_label?: string;
  after_label?: string;
  vibe?: string;
  notes?: string;
};
