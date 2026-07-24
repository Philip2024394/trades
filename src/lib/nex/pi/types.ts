// Nex Project Intelligence — contracts.
//
// Where BI (Phase 5) is scoped per merchant, PI (Phase 6) is scoped
// per project. Every adapter reports one aspect of a project (photos,
// costs, timeline, variations, …). The engine unions the aspects
// into a ProjectSnapshot and computes a health score.
//
// Two viewers exist and MUST NOT bleed into each other:
//   • homeowner — owns the project, sees everything
//   • merchant  — invited team member, sees the merchant-safe subset
// The viewer is a first-class parameter so every adapter can enforce
// permission at the query level.
//
// Evidence-or-silence: every metric carries its source table so
// answers can point at where the number came from.

export type ProjectAspect =
  | "timeline"
  | "photos"
  | "costs"
  | "documents"
  | "posts"          // site diary + variations (post kind)
  | "variations"     // extra costs + question/trade-note posts
  | "materials"      // costs kind=materials
  | "labour"         // costs kind=labour
  | "team"           // sitebook members
  | "communication"  // post replies + WA
  | "things_to_fix"
  | "risks";

export type ViewerType = "homeowner" | "merchant";

/** Everything a PI query needs to know about who's asking. Every
 *  adapter uses this to scope its queries — a merchant viewer never
 *  gets to see homeowner-only fields like paid_pence. */
export type ViewerContext = {
  viewer:   ViewerType;
  /** homeowner_id for a homeowner, merchant listing_id for a merchant. */
  viewerId: string;
};

/** Where a metric or fact came from. */
export type Evidence = {
  source:      string;                // "hammerex_sitebook_costs (paid)"
  tables:      string[];
  computed_at: string;
  evidence_url?: string;
};

export type Metric = {
  key:      string;
  label:    string;
  value:    number | string | null;   // string allowed for dates ("2026-08-14"), null = no data
  unit:     "gbp" | "pct" | "count" | "days" | "date" | "text";
  direction: "higher_is_better" | "lower_is_better" | "neutral";
  evidence:  Evidence;
  /** Visible-to filter — if set, the metric is stripped from viewers
   *  not in the list. Adapter enforces this in-place — the engine
   *  never sees hidden fields. Left null = visible to everyone. */
  visible_to?: ViewerType[];
};

/** A chronological event on the project timeline. */
export type TimelineEvent = {
  at:          string;                // ISO
  event_type:  string;
  actor_type:  "homeowner" | "trade" | "system" | null;
  actor_name:  string | null;
  headline:    string;                // "Concrete poured", "Invoice sent"
  detail?:     string;
  evidence:    Evidence;
  visible_to?: ViewerType[];
};

/** Something Nex noticed on the project. */
export type Observation = {
  key:       string;
  aspect:    ProjectAspect;
  severity:  "info" | "notice" | "warning" | "alert";
  headline:  string;
  detail?:   string;
  action?:   { label: string; href: string };
  evidence:  Evidence;
  visible_to?: ViewerType[];
};

export type AspectMetrics = {
  aspect:       ProjectAspect;
  label:        string;
  sub_score:    number | null;
  weight:       number;
  metrics:      Metric[];
  observations: Observation[];
  timeline:     TimelineEvent[];      // events the adapter contributes
  error?:       string;
};

export type PIAdapterContext = {
  projectId:   string;
  viewer:      ViewerType;
  viewerId:    string;
  now?:        Date;
  /** Rolling window for "recent" queries, default 30 days. */
  lookbackDays?: number;
};

export type PIAdapter = {
  aspect: ProjectAspect;
  label:  string;
  weight: number;
  /** Never throws — engine wraps in try/catch. */
  run:    (ctx: PIAdapterContext) => Promise<AspectMetrics>;
};

/** The project shell — small identity block every snapshot embeds. */
export type ProjectIdentity = {
  id:              string;
  title:           string;
  status:          string;
  address_city:    string | null;
  cover_photo_url: string | null;
  started_at:      string | null;
  completed_at:    string | null;
  budget_min_gbp:  number | null;
  budget_max_gbp:  number | null;
  total_spent_gbp: number;
};

/** The full per-project snapshot. */
export type ProjectSnapshot = {
  project:      ProjectIdentity;
  viewer:       ViewerType;
  health: {
    score:    number;
    band:     "excellent" | "healthy" | "steady" | "attention" | "critical";
    headline: string;
  };
  aspects:      AspectMetrics[];
  observations: Observation[];
  timeline:     TimelineEvent[];      // sorted desc (most recent first)
  computed_at:  string;
  errors:       Array<{ aspect: ProjectAspect; error: string }>;
};

export function evidenceFor(source: string, tables: string[], evidence_url?: string): Evidence {
  return {
    source,
    tables,
    computed_at: new Date().toISOString(),
    evidence_url
  };
}

/** Strip anything not visible to `viewer` from a metric/observation
 *  list. Used by the engine to enforce permissions at the last mile
 *  even if an adapter forgets to filter. */
export function filterVisible<T extends { visible_to?: ViewerType[] }>(list: T[], viewer: ViewerType): T[] {
  return list.filter((x) => !x.visible_to || x.visible_to.includes(viewer));
}
