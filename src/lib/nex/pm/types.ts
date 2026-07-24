// Nex Project Manager — multi-project + coordination contracts.
//
// Where Phase 6 PI is scoped to ONE project (buildProjectSnapshot per
// project_id), PM is scoped to the merchant's PORTFOLIO. It ranks
// projects, forecasts completion, detects delays and composes the
// "run today's business" command centre across every engine.
//
// PM never duplicates PI — it calls PI per-project and aggregates.

import type { Evidence } from "../pi/types";
import type { ProjectSnapshot } from "../pi/types";
export type { Evidence, ProjectSnapshot };

export type ProjectRef = {
  project_id:      string;
  title:           string;
  status:          string;
  started_at:      string | null;
  completed_at:    string | null;
  scheduled_end:   string | null;      // from job diary if job with this project has scheduled_end_date
  progress_percent: number | null;    // from job diary, if any
};

/** One row per project in the portfolio ranking. */
export type ProjectHealthRow = {
  project:        ProjectRef;
  health_score:   number;
  band:           ProjectSnapshot["health"]["band"];
  observation_summary: string;        // one line summarising the biggest concern
  top_observations: Array<{ severity: "alert" | "warning" | "notice" | "info"; headline: string }>;
  evidence:       Evidence;
};

export type ProjectsOverview = {
  computed_at:    string;
  merchant_slug:  string;
  projects:       ProjectHealthRow[];  // sorted worst-health first
  warnings:       string[];
  errors:         Array<{ project_id: string; error: string }>;
};

/** Completion forecast for a specific project. */
export type CompletionForecast = {
  project_id:        string;
  title:             string;
  scheduled_end:     string | null;
  progress_percent:  number | null;
  velocity_pct_per_day: number | null;
  forecast_end:      string | null;     // null when we can't honestly predict
  confidence:        "high" | "medium" | "low" | "unknown";
  reason:            string;
  evidence:          Evidence;
};

/** A project running behind schedule. */
export type DelayedProject = {
  project_id:        string;
  title:             string;
  scheduled_end:     string;
  forecast_end:      string;
  days_behind:       number;
  reason:            string;
  evidence:          Evidence;
};

// ─── The "run today's business" command centre ───────────────────

export type CommandCentreSection = {
  heading:   string;
  bullets:   string[];
  source:    "bi" | "pm" | "sc" | "cx" | "md" | "fi";
};

export type CommandCentreBriefing = {
  computed_at:      string;
  merchant_slug:    string;
  greeting:         string;                 // one-line
  overall_headline: string;                 // Business Health line
  sections:         CommandCentreSection[];
  unavailable:      string[];               // honest gaps (weather, safety, etc.)
  errors:           Array<{ module: string; error: string }>;
};

export function evidenceFor(source: string, tables: string[] = []): Evidence {
  return {
    source,
    tables,
    computed_at: new Date().toISOString()
  };
}
