// Growth Coach — task shape shared by checkers, API, and UI.

export type GrowthTaskCategory =
  | "trust"
  | "setup"
  | "publishing"
  | "content"
  | "contact"
  | "coverage";

export type GrowthTask = {
  id: string;
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
  /** 0..100 — higher wins. Zero-scored tasks are complete + filtered
   *  out before the top-3 slice. */
  impact: number;
  category: GrowthTaskCategory;
  /** Optional "why this matters" one-liner for the expanded view. */
  reason?: string;
};
