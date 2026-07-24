// PM answer router — classifier + pure formatters.

import { describe, it, expect } from "vitest";
import {
  classifyPMQuestion,
  formatDelayed,
  formatForecast,
  formatPortfolioOverview,
  formatWorstProject
} from "./answer";
import type { CompletionForecast, DelayedProject, ProjectsOverview } from "./types";

const ev = { source: "t", tables: [], computed_at: "x" };

function overview(overrides: Partial<ProjectsOverview> = {}): ProjectsOverview {
  return {
    computed_at:   "2026-07-23T00:00:00Z",
    merchant_slug: "phil-plumbing",
    projects: [
      {
        project: { project_id: "p1", title: "Smith kitchen", status: "in-progress", started_at: "2026-07-01", completed_at: null, scheduled_end: "2026-08-15", progress_percent: 30 },
        health_score: 45, band: "attention",
        observation_summary: "£800 overdue on final invoice.",
        top_observations: [{ severity: "warning", headline: "£800 overdue on final invoice." }],
        evidence: ev
      },
      {
        project: { project_id: "p2", title: "Jones bathroom", status: "in-progress", started_at: "2026-07-10", completed_at: null, scheduled_end: "2026-08-30", progress_percent: 60 },
        health_score: 78, band: "healthy",
        observation_summary: "All fine.",
        top_observations: [],
        evidence: ev
      }
    ],
    warnings: [], errors: [],
    ...overrides
  };
}

describe("classifyPMQuestion", () => {
  it("command_centre for 'run today's business'", () => {
    expect(classifyPMQuestion("run today's business").kind).toBe("command_centre");
  });
  it("portfolio_overview for 'how are my projects?'", () => {
    expect(classifyPMQuestion("how are my projects?").kind).toBe("portfolio_overview");
    expect(classifyPMQuestion("show all my projects").kind).toBe("portfolio_overview");
  });
  it("worst_project for 'which project worries you?'", () => {
    expect(classifyPMQuestion("which project worries you?").kind).toBe("worst_project");
    expect(classifyPMQuestion("which project needs me today?").kind).toBe("worst_project");
  });
  it("delayed for 'what's falling behind?'", () => {
    expect(classifyPMQuestion("what's falling behind?").kind).toBe("delayed");
    expect(classifyPMQuestion("delayed projects").kind).toBe("delayed");
  });
  it("forecast with project name hint", () => {
    const q = classifyPMQuestion("when will the Smith extension finish?");
    expect(q.kind).toBe("forecast");
    if (q.kind === "forecast") expect(q.hint.toLowerCase()).toContain("smith");
  });
  it("none for irrelevant text", () => {
    expect(classifyPMQuestion("hello there").kind).toBe("none");
  });
});

describe("formatPortfolioOverview", () => {
  it("ranks worst-first with health line per project", () => {
    const out = formatPortfolioOverview(overview());
    expect(out).toContain("Smith kitchen");
    expect(out).toContain("45%");
    expect(out).toContain("attention");
    expect(out).toContain("Jones bathroom");
    expect(out).toContain("78%");
  });

  it("empty portfolio surfaces the warning", () => {
    const empty = overview({ projects: [], warnings: ["No active projects on file."] });
    expect(formatPortfolioOverview(empty)).toContain("No active projects");
  });
});

describe("formatWorstProject", () => {
  it("names the worst project + surfaces top observations", () => {
    const out = formatWorstProject(overview());
    expect(out).toContain("Smith kitchen");
    expect(out).toContain("45%");
    expect(out).toContain("£800 overdue");
  });

  it("falls back to observation_summary when top_observations empty", () => {
    const o = overview({
      projects: [{
        project: { project_id: "p1", title: "Solo", status: "in-progress", started_at: null, completed_at: null, scheduled_end: null, progress_percent: null },
        health_score: 50, band: "attention",
        observation_summary: "Steady but no visible issues.",
        top_observations: [],
        evidence: ev
      }]
    });
    expect(formatWorstProject(o)).toContain("Steady but no visible issues.");
  });
});

describe("formatDelayed", () => {
  it("empty list → no-delays reply", () => {
    expect(formatDelayed([])).toContain("No projects forecast");
  });

  it("lists days behind per project", () => {
    const list: DelayedProject[] = [
      { project_id: "p1", title: "Smith kitchen", scheduled_end: "2026-08-15", forecast_end: "2026-09-01", days_behind: 17, reason: "slow progress", evidence: ev }
    ];
    const out = formatDelayed(list);
    expect(out).toContain("17 days behind");
    expect(out).toContain("Smith kitchen");
  });
});

describe("formatForecast", () => {
  it("null forecast → 'cannot forecast yet' + reason", () => {
    const f: CompletionForecast = { project_id: "p1", title: "Solo", scheduled_end: null, progress_percent: null, velocity_pct_per_day: null, forecast_end: null, confidence: "unknown", reason: "no start date on file", evidence: ev };
    const out = formatForecast(f);
    expect(out).toContain("cannot forecast yet");
    expect(out).toContain("no start date");
  });

  it("valid forecast prints date + confidence", () => {
    const f: CompletionForecast = { project_id: "p1", title: "Kitchen", scheduled_end: "2026-08-30", progress_percent: 30, velocity_pct_per_day: 2, forecast_end: "2026-08-27", confidence: "high", reason: "on target", evidence: ev };
    const out = formatForecast(f);
    expect(out).toContain("2026-08-27");
    expect(out).toContain("high");
  });
});
