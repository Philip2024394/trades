// Mate signal detector contract. One detector = one file. New nudge
// kind = new file added to signals/detectors/ + line in registry.ts.
// Mirrors the tool-registry pattern from step 1 so the runtime never
// hard-codes signal kinds.

export type SignalPriority = 1 | 2 | 3;   // 1 high · 2 medium · 3 low

export type MateSignal = {
  kind:         string;
  priority:     SignalPriority;
  title:        string;    // ~40 chars, shown on the badge/list
  body:         string;    // ~200 chars, the actual nudge
  action_url?:  string;
  action_label?: string;
  metadata?:    Record<string, unknown>;
};

export type DetectorContext = {
  surface:  "merchant" | "homeowner";
  userKey:  string;   // merchant slug OR homeowner id
};

export type SignalDetector = {
  kind:     string;
  surfaces: Array<"merchant" | "homeowner">;
  /** Return zero or one signal for this user. Never throws — the runner
   *  swallows errors so one broken detector doesn't kill the batch. */
  detect:   (ctx: DetectorContext) => Promise<MateSignal | null>;
};
