// Answer router — classifier + reply builder.

import { describe, it, expect } from "vitest";
import { classifyProjectQuestion, answerProjectQuestion } from "./answer";
import type { AspectMetrics, Evidence, ProjectSnapshot } from "./types";

const ev: Evidence = { source: "t", tables: ["t"], computed_at: "2026-07-23T00:00:00Z" };

function aspect(spec: Partial<AspectMetrics> & Pick<AspectMetrics, "aspect" | "label">): AspectMetrics {
  return {
    sub_score:    80,
    weight:       1,
    metrics:      [],
    observations: [],
    timeline:     [],
    ...spec
  };
}

function snap(overrides: Partial<ProjectSnapshot> = {}): ProjectSnapshot {
  return {
    project: {
      id: "p1", title: "Smith extension", status: "in-progress",
      address_city: "Manchester", cover_photo_url: null,
      started_at: "2026-06-01T00:00:00Z", completed_at: null,
      budget_min_gbp: 30000, budget_max_gbp: 40000, total_spent_gbp: 12000
    },
    viewer: "homeowner",
    health: { score: 82, band: "healthy", headline: "Project Health: 82%. Healthy." },
    aspects: [
      aspect({ aspect: "costs", label: "Costs", metrics: [
        { key: "paid_gbp",        label: "Paid",        value: 12000, unit: "gbp", direction: "neutral",         evidence: ev },
        { key: "agreed_gbp",      label: "Agreed",      value: 18000, unit: "gbp", direction: "neutral",         evidence: ev },
        { key: "outstanding_gbp", label: "Outstanding", value: 6000,  unit: "gbp", direction: "lower_is_better", evidence: ev },
        { key: "overdue_gbp",     label: "Overdue",     value: 1500,  unit: "gbp", direction: "lower_is_better", evidence: ev },
        { key: "budget_used_pct", label: "Budget used", value: 30,    unit: "pct", direction: "lower_is_better", evidence: ev },
        { key: "agreed_materials_gbp", label: "Agreed (materials)", value: 5000, unit: "gbp", direction: "neutral", evidence: ev }
      ]}),
      aspect({ aspect: "photos", label: "Photos", metrics: [
        { key: "photos_total",     label: "Photos on record",  value: 22, unit: "count", direction: "higher_is_better", evidence: ev },
        { key: "photos_recent",    label: "Recent",            value: 8,  unit: "count", direction: "higher_is_better", evidence: ev },
        { key: "days_since_photo", label: "Days since photo",  value: 2,  unit: "days",  direction: "lower_is_better",  evidence: ev }
      ]}),
      aspect({ aspect: "things_to_fix", label: "Snags", metrics: [
        { key: "snags_open", label: "Open snags", value: 3, unit: "count", direction: "lower_is_better", evidence: ev }
      ]}),
      aspect({ aspect: "team", label: "Team", metrics: [
        { key: "team_size",    label: "Trades",  value: 4, unit: "count", direction: "neutral",         evidence: ev },
        { key: "team_hired",   label: "Hired",   value: 2, unit: "count", direction: "higher_is_better", evidence: ev },
        { key: "team_pending", label: "Pending", value: 2, unit: "count", direction: "lower_is_better", evidence: ev }
      ]}),
      aspect({ aspect: "posts", label: "Site diary", metrics: [
        { key: "posts_open_questions", label: "Open questions", value: 1, unit: "count", direction: "lower_is_better", evidence: ev }
      ]}),
      aspect({ aspect: "variations", label: "Variations", metrics: [
        { key: "variations_total", label: "Variations",       value: 2, unit: "count", direction: "lower_is_better", evidence: ev },
        { key: "variations_open",  label: "Open variations",  value: 1, unit: "count", direction: "lower_is_better", evidence: ev }
      ]}),
      aspect({ aspect: "documents", label: "Documents", metrics: [
        { key: "documents_total",   label: "Documents", value: 5, unit: "count", direction: "higher_is_better", evidence: ev },
        { key: "documents_invoice", label: "Invoice",   value: 3, unit: "count", direction: "neutral",          evidence: ev },
        { key: "documents_receipt", label: "Receipt",   value: 2, unit: "count", direction: "neutral",          evidence: ev }
      ]})
    ],
    observations: [
      { key: "risk_no_photos", aspect: "risks", severity: "warning", headline: "No photos for 8 days.", evidence: ev }
    ],
    timeline: [
      { at: "2026-07-23T09:15:00Z", event_type: "photo_added", actor_type: "trade", actor_name: "Dave", headline: "Photo uploaded", evidence: ev },
      { at: "2026-07-22T14:00:00Z", event_type: "payment_made", actor_type: "homeowner", actor_name: null, headline: "Paid £1,200 to Dave Plumbing.", evidence: ev }
    ],
    computed_at: "2026-07-23T10:00:00Z",
    errors: [],
    ...overrides
  };
}

describe("classifyProjectQuestion", () => {
  it("overview questions", () => {
    expect(classifyProjectQuestion("Tell me about the Smith extension").kind).toBe("overview");
    expect(classifyProjectQuestion("how's my project?").kind).toBe("overview");
  });
  it("timeline questions", () => {
    expect(classifyProjectQuestion("show today's jobs").kind).toBe("timeline");
    expect(classifyProjectQuestion("what happened yesterday?").kind).toBe("timeline");
  });
  it("photos", () => {
    expect(classifyProjectQuestion("show all kitchen photos").kind).toBe("photos");
  });
  it("spend / outstanding / budget split correctly", () => {
    expect(classifyProjectQuestion("how much have we spent?").kind).toBe("spend");
    expect(classifyProjectQuestion("what's outstanding?").kind).toBe("outstanding");
    expect(classifyProjectQuestion("what's my budget?").kind).toBe("budget");
  });
  it("snags / variations / risks", () => {
    expect(classifyProjectQuestion("what's left to do?").kind).toBe("snags");
    expect(classifyProjectQuestion("show all variations").kind).toBe("variations");
    expect(classifyProjectQuestion("what risks are there?").kind).toBe("risks");
  });
  it("who paid X", () => {
    const q = classifyProjectQuestion("Have we paid the electrician?");
    expect(q.kind).toBe("who_paid");
    if (q.kind === "who_paid") expect(q.who).toBe("electrician");
  });
  it("completion", () => {
    expect(classifyProjectQuestion("when is completion?").kind).toBe("completion");
  });
  it("documents by category", () => {
    const q = classifyProjectQuestion("show me the receipts");
    expect(q.kind).toBe("documents");
    if (q.kind === "documents") expect(q.category).toBe("receipt");
  });
  it("none for unrelated text", () => {
    expect(classifyProjectQuestion("what's the weather like").kind).toBe("none");
  });
});

describe("answerProjectQuestion", () => {
  it("overview names the project + health + summary", () => {
    const out = answerProjectQuestion({ kind: "overview" }, snap());
    expect(out).toContain("Smith extension");
    expect(out).toContain("82%");
    expect(out).toContain("£12,000");   // spent
  });

  it("timeline today filters to today only", () => {
    const out = answerProjectQuestion({ kind: "timeline", period: "today" }, snap());
    expect(out).toContain("Today so far");
    expect(out).toContain("Photo uploaded");
    expect(out).not.toContain("Paid £1,200");
  });

  it("spend + budget + materials", () => {
    expect(answerProjectQuestion({ kind: "spend" },     snap())).toContain("£12,000");
    expect(answerProjectQuestion({ kind: "budget" },    snap())).toContain("30%");
    expect(answerProjectQuestion({ kind: "materials" }, snap())).toContain("£5,000");
  });

  it("outstanding + overdue", () => {
    const out = answerProjectQuestion({ kind: "outstanding" }, snap());
    expect(out).toContain("£6,000");
    expect(out).toContain("£1,500");
  });

  it("who_paid returns matching timeline line", () => {
    const out = answerProjectQuestion({ kind: "who_paid", who: "Dave" }, snap());
    expect(out).toContain("Paid £1,200");
  });

  it("snags + team + variations + docs + completion + risks", () => {
    expect(answerProjectQuestion({ kind: "snags" },        snap())).toContain("3 things still to fix");
    expect(answerProjectQuestion({ kind: "team" },         snap())).toContain("4 trades");
    expect(answerProjectQuestion({ kind: "variations" },   snap())).toContain("2 variations");
    expect(answerProjectQuestion({ kind: "documents", category: "invoice" }, snap())).toContain("3 invoices");
    expect(answerProjectQuestion({ kind: "completion" },   snap())).toContain("Started 2026-06-01");
    expect(answerProjectQuestion({ kind: "risks" },        snap())).toContain("No photos for 8 days.");
  });

  it("none returns empty string", () => {
    expect(answerProjectQuestion({ kind: "none" }, snap())).toBe("");
  });

  it("stays silent when metric is null instead of fabricating", () => {
    const s = snap({
      aspects: [{
        aspect: "costs", label: "Costs", sub_score: 50, weight: 2,
        metrics: [
          { key: "agreed_gbp", label: "Agreed", value: null, unit: "gbp", direction: "neutral", evidence: ev }
        ],
        observations: [], timeline: []
      }]
    });
    expect(answerProjectQuestion({ kind: "spend" }, s)).toContain("No costs recorded");
  });
});
