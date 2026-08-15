// NEX App Builder · Worker 6 · Provenance Surface (Philip 2026-08-14).
//
// Consumes: reports from Workers 1-5.
// Produces: the human-readable BUILD STATUS the Studio operator sees.
//
// This is the surface that answers "why can/can't NEX proceed?" with
// evidence — not fabricated claims.

import type { AppBlueprint } from "../blueprint-schema";
import type {
  EvidenceRecord,
  EvidenceState,
  EvidenceVerdict,
  WorkerContext,
  WorkerReport
} from "./types";
import { startReport } from "./types";
import type { BlueprintValidationResult } from "./validation-worker";
import type { DataModelPlan } from "./data-model-worker";
import type { IntegrationPlan } from "./integration-worker";
import type { DesignPlan } from "./design-image-worker";
import type { VisualQAPlan } from "./visual-qa-worker";

export type ProvenanceSurface = {
  overall: "READY" | "BLOCKED" | "PARTIAL";
  sections: Array<{
    heading: string;
    items: Array<{
      symbol: "check" | "warn" | "info" | "cross";
      text: string;
      path?: string;
    }>;
  }>;
  actionItems: Array<{
    priority: "P0" | "P1" | "P2";
    text: string;
    path?: string;
  }>;
};

export function runProvenanceSurfaceWorker(
  ctx: WorkerContext,
  args: {
    validation: WorkerReport<BlueprintValidationResult>;
    dataModel: WorkerReport<DataModelPlan>;
    integration: WorkerReport<IntegrationPlan>;
    design: WorkerReport<DesignPlan>;
    visualQA: WorkerReport<VisualQAPlan>;
  }
): WorkerReport<ProvenanceSurface> {
  const report = startReport("provenance-surface");
  const bp = ctx.blueprint;
  const { validation, dataModel, integration, design, visualQA } = args;

  const sections: ProvenanceSurface["sections"] = [];
  const actionItems: ProvenanceSurface["actionItems"] = [];

  // ── Blueprint validation
  const val = validation.data;
  const totalSections = val.sectionResolutions.length;
  const resolvedSections = val.sectionResolutions.filter((r) => r.strategy !== "unresolved").length;
  const assembledPages = new Set(val.sectionResolutions.map((r) => r.pageId)).size;
  sections.push({
    heading: "Blueprint",
    items: [
      { symbol: val.valid ? "check" : "cross", text: val.valid ? "Blueprint is structurally valid" : "Blueprint has structural errors" },
      { symbol: resolvedSections === totalSections ? "check" : "warn", text: `${resolvedSections}/${totalSections} sections resolved to real registry entries` },
      { symbol: assembledPages === bp.pages.length ? "check" : "warn", text: `${assembledPages}/${bp.pages.length} pages have resolvable sections` },
      { symbol: val.navigationIntegrity.ok ? "check" : "cross", text: val.navigationIntegrity.ok ? "Navigation references are intact" : `Navigation references ${val.navigationIntegrity.unknownPageIds.length} unknown page(s)` }
    ]
  });

  // ── Customer information (from validation.requiredFacts)
  const customerItems: ProvenanceSurface["sections"][number]["items"] = val.requiredFacts.map((f) => ({
    symbol: "warn",
    text: `${humanisePath(f.path)} required`,
    path: f.path
  }));
  if (customerItems.length === 0) {
    customerItems.push({ symbol: "check", text: "All required customer information supplied" });
  }
  sections.push({ heading: "Customer information", items: customerItems });

  // Push P0 action items for each required fact
  for (const f of val.requiredFacts) {
    actionItems.push({
      priority: "P0",
      text: `Customer must supply: ${humanisePath(f.path)}`,
      path: f.path
    });
  }

  // ── Brand (from provenance summary + design worker)
  const brandItems: ProvenanceSurface["sections"][number]["items"] = [];
  if (design.data.brandTokens.inferredFromDefaults) {
    brandItems.push({ symbol: "info", text: "Primary colour — INFERRED (from Reference Brain defaults)" });
    actionItems.push({ priority: "P2", text: "Confirm or swap the inferred primary brand colour", path: "brand.palette.primary" });
  } else {
    brandItems.push({ symbol: "check", text: "Primary colour supplied" });
  }
  for (const f of val.inferredFacts.filter((f) => f.path.startsWith("brand."))) {
    if (f.path === "brand.palette.primary") continue; // already surfaced
    brandItems.push({ symbol: "info", text: `${humanisePath(f.path)} — INFERRED` });
  }
  sections.push({ heading: "Brand", items: brandItems });

  // ── Data models
  const dmItems: ProvenanceSurface["sections"][number]["items"] = dataModel.data.models.map((m) => ({
    symbol: m.status === "SEEDED" ? "check"
      : m.status === "READY_EMPTY" ? "info"
      : m.status === "CUSTOMER_INPUT_REQUIRED" ? "warn"
      : "info",
    text: `${m.label} — ${m.status}${m.fieldsNeedingCustomerInput.length > 0 ? ` · needs: ${m.fieldsNeedingCustomerInput.map((f) => f.name).join(", ")}` : ""}`,
    path: `data.${m.id}`
  }));
  sections.push({ heading: "Data models", items: dmItems });
  for (const m of dataModel.data.models.filter((m) => m.status === "CUSTOMER_INPUT_REQUIRED")) {
    actionItems.push({
      priority: "P1",
      text: `Populate "${m.label}" data (${m.fieldsNeedingCustomerInput.map((f) => f.name).join(", ")})`,
      path: `data.${m.id}`
    });
  }

  // ── Integrations
  const intItems: ProvenanceSurface["sections"][number]["items"] = integration.data.integrations.map((i) => ({
    symbol: i.status === "CONNECTED" ? "check"
      : i.status === "CONFIGURED" ? "info"
      : "warn",
    text: `${i.provider} — ${i.status} · ${i.reason}`,
    path: `integrations.${i.provider}`
  }));
  sections.push({ heading: "Integrations", items: intItems });
  for (const i of integration.data.integrations.filter((i) => i.status === "MISSING_CONFIGURATION" || i.status === "BLOCKED")) {
    actionItems.push({
      priority: i.optional ? "P2" : "P1",
      text: `Fix "${i.provider}" integration: ${i.reason}`,
      path: `integrations.${i.provider}`
    });
  }

  // ── Design / images
  const designItems: ProvenanceSurface["sections"][number]["items"] = [
    {
      symbol: design.data.heroSelection.matched ? "check" : "warn",
      text: design.data.heroSelection.matched
        ? `Hero selected: ${design.data.heroSelection.heroId} (from hero library)`
        : `Hero library has no match for trade "${design.data.heroSelection.tradeSlug}" — fallback will be used`
    }
  ];
  const totalUnmet = design.data.perPageAssetPlan.reduce((n, p) => n + p.unmetImageNeeds.length, 0);
  if (totalUnmet > 0) {
    designItems.push({ symbol: "warn", text: `${totalUnmet} unmet image slot(s) across pages` });
    actionItems.push({ priority: "P1", text: `Provide images for ${totalUnmet} page slot(s)` });
  } else {
    designItems.push({ symbol: "check", text: "All page image slots have a source (hero library or fallback)" });
  }
  sections.push({ heading: "Design & imagery", items: designItems });

  // ── Visual QA
  const qa = visualQA.data;
  const qaItems: ProvenanceSurface["sections"][number]["items"] = [
    {
      symbol: qa.runnerRequirements.playwrightInstalled ? "check" : "warn",
      text: qa.runnerRequirements.playwrightInstalled ? "Playwright installed" : "Playwright NOT installed (execution deferred)"
    },
    {
      symbol: qa.totals.fail > 0 ? "cross" : "info",
      text: `${qa.totals.total} QA checks planned · ${qa.totals.fail} failed at plan time · ${qa.totals.pending} pending execution`
    }
  ];
  sections.push({ heading: "Visual QA", items: qaItems });

  // ── Overall verdict
  const overall: ProvenanceSurface["overall"] =
    !val.valid || integration.data.totals.blocked > 0 ? "BLOCKED"
      : val.requiredFacts.length === 0 && dataModel.data.totals.modelsBlocked === 0 ? "READY"
      : "PARTIAL";

  // ── Phase 19B · Evidence-based verdict ─────────────────────────────
  // The provenance surface's evidence IS the set of upstream verdicts.
  // If any upstream is FAILED / UNKNOWN, this worker MUST propagate that
  // rather than silently override.
  const upstreamVerdicts = {
    validation: validation.verdict,
    dataModel: dataModel.verdict,
    integration: integration.verdict,
    design: design.verdict,
    visualQA: visualQA.verdict
  } as const;

  const evidence: EvidenceRecord[] = [];
  for (const [name, v] of Object.entries(upstreamVerdicts)) {
    evidence.push({
      observation: `Upstream worker "${name}" verdict=${v.state} · ${v.diagnosis}`,
      source: "upstream",
      value: { worker: name, state: v.state, evidenceCount: v.evidence.length }
    });
  }
  evidence.push({
    observation: `Aggregated ${actionItems.length} action item(s) across ${sections.length} report section(s)`,
    source: "runtime",
    value: { actionItems: actionItems.length, sections: sections.length }
  });

  // Precedence: FAILED > UNKNOWN > BLOCKED_* > PENDING > DEGRADED > HEALTHY.
  const upstreamStates = Object.values(upstreamVerdicts).map((v) => v.state);
  const worstUpstream: EvidenceState = pickWorstState(upstreamStates);

  const p0 = actionItems.filter((a) => a.priority === "P0").length;
  const p1 = actionItems.filter((a) => a.priority === "P1").length;

  const verdict: EvidenceVerdict =
    worstUpstream === "FAILED"
      ? {
          state: "BLOCKED_UPSTREAM",
          evidence,
          diagnosis: "One or more upstream workers reported FAILED — the surface cannot claim READY without invention",
          decision: `Resolve upstream failure(s) first; ${p0} P0 + ${p1} P1 action item(s) surfaced for operator`
        }
      : worstUpstream === "UNKNOWN"
        ? {
            state: "UNKNOWN",
            evidence,
            diagnosis: "One or more upstream workers could not gather evidence — silence is the honest state, not a fabricated pass",
            decision: "Investigate upstream evidence-gathering failure before claiming any verdict"
          }
        : worstUpstream === "BLOCKED_INPUT" || worstUpstream === "BLOCKED_CONFIG"
          ? {
              state: worstUpstream,
              evidence,
              diagnosis: `Upstream workers report ${worstUpstream} — build is partial pending operator/customer action`,
              decision: `Address the ${p0} P0 + ${p1} P1 action item(s) surfaced on the operator view`
            }
          : worstUpstream === "PENDING"
            ? {
                state: "PENDING",
                evidence,
                diagnosis: "Upstream workers require a live execution step (e.g. Playwright) to finalise their verdicts",
                decision: "Trigger the pending execution step, then re-run the orchestrator"
              }
            : worstUpstream === "DEGRADED" || p0 > 0 || p1 > 0
              ? {
                  state: "DEGRADED",
                  evidence,
                  diagnosis: `All upstream workers healthy or degraded; ${p0} P0 + ${p1} P1 action item(s) exist for the operator`,
                  decision: "Proceed; surface action items to the operator"
                }
              : {
                  state: "HEALTHY",
                  evidence,
                  diagnosis: "Every upstream worker reports HEALTHY and no action items remain",
                  decision: "Build is READY — orchestrator may hand off to publish"
                };

  return report.finish<ProvenanceSurface>(
    overall === "READY" ? "ok" : "blocked",
    { overall, sections, actionItems },
    verdict,
    { errors: [], warnings: [], messages: [{ level: "info", text: `BUILD STATUS: ${overall}` }] }
  );
}

/** Deterministic worst-state picker for the provenance surface.
 *  Ordering (worst → best): FAILED, UNKNOWN, BLOCKED_UPSTREAM, BLOCKED_CONFIG,
 *  BLOCKED_INPUT, PENDING, DEGRADED, HEALTHY. */
function pickWorstState(states: EvidenceState[]): EvidenceState {
  const order: EvidenceState[] = [
    "FAILED",
    "UNKNOWN",
    "BLOCKED_UPSTREAM",
    "BLOCKED_CONFIG",
    "BLOCKED_INPUT",
    "PENDING",
    "DEGRADED",
    "HEALTHY"
  ];
  for (const s of order) if (states.includes(s)) return s;
  return "HEALTHY";
}

function humanisePath(path: string): string {
  const map: Record<string, string> = {
    "identity.displayName": "Company name",
    "identity.contact.primaryEmail": "Email",
    "identity.contact.primaryPhone": "Phone",
    "identity.contact.serviceRadius.centre": "Service-radius centre (postcode or coordinates)",
    "identity.contact.serviceRadius.radiusMiles": "Service-radius miles"
  };
  return map[path] ?? path;
}
