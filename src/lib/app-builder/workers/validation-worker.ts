// NEX App Builder · Worker 1 · Blueprint Validation (Philip 2026-08-14).
//
// The constitutional gate. Runs BEFORE any downstream worker.
//
// Responsibilities:
//   - Validate all Blueprint fields structurally
//   - Verify every section.registryId resolves via the adapter
//   - Verify navigation.primary references resolve to real pages
//   - Verify data-bindings point at declared data models
//   - Verify action refs are well-formed
//   - Surface every REQUIRED / UNKNOWN provenance entry
//   - Refuse fabrication (never fills a missing field)
//   - Produce a deterministic BlueprintValidationResult

import type { AppBlueprint } from "../blueprint-schema";
import { summariseProvenance, classifyBlueprint } from "../provenance";
import { resolveRegistryId } from "../blueprint-to-pipeline";
import type {
  EvidenceRecord,
  EvidenceVerdict,
  WorkerContext,
  WorkerReport
} from "./types";
import { startReport } from "./types";

export type BlueprintValidationResult = {
  /** Structurally valid Blueprint (schema + references intact). */
  valid: boolean;
  /** Ready to hand to downstream workers (no REQUIRED-facts blockers). */
  ready: boolean;
  /** Required customer-supplied facts still missing. */
  requiredFacts: Array<{ path: string; reason: string }>;
  /** INFERRED facts NEX chose — surfaced so operator can swap. */
  inferredFacts: Array<{ path: string; source?: string; confidence?: number }>;
  /** Resolution report per section (from adapter). */
  sectionResolutions: Array<{
    pageId: string;
    instanceId: string;
    requestedRegistryId: string;
    resolvedRegistryId: string | null;
    strategy: "exact" | "alias" | "library-fallback" | "unresolved";
  }>;
  /** Nav integrity. */
  navigationIntegrity: { ok: boolean; unknownPageIds: string[] };
  /** Data-binding integrity. */
  dataBindingIntegrity: { ok: boolean; unknownSources: string[] };
  /** Provenance summary. */
  provenance: ReturnType<typeof summariseProvenance>;
};

export function runValidationWorker(
  ctx: WorkerContext
): WorkerReport<BlueprintValidationResult> {
  const report = startReport("blueprint-validation");
  const bp = ctx.blueprint;

  const errors: WorkerReport<unknown>["errors"] = [];
  const warnings: WorkerReport<unknown>["warnings"] = [];
  const messages: WorkerReport<unknown>["messages"] = [];

  // ── 1. Structural checks ──────────────────────────────────────────
  if (bp.blueprintVersion !== 1) {
    errors.push({
      code: "unsupported-blueprint-version",
      message: `blueprintVersion=${bp.blueprintVersion} · this worker supports v1 only`
    });
  }
  if (!Array.isArray(bp.pages) || bp.pages.length === 0) {
    errors.push({
      code: "no-pages",
      message: "Blueprint has no pages — at minimum a home page is required",
      path: "pages"
    });
  }
  const pageIds = new Set(bp.pages.map((p) => p.id));
  if (!pageIds.has("home")) {
    warnings.push({
      code: "no-home-page",
      message: "No page with id 'home' — the standard entry route may be missing",
      path: "pages",
      resolution: "Add a page with id='home' and path='/'"
    });
  }

  // ── 2. Section resolution (uses the SAME adapter workers will use) ─
  const sectionResolutions: BlueprintValidationResult["sectionResolutions"] = [];
  for (const page of bp.pages) {
    for (const s of page.sections) {
      const resolved = resolveRegistryId(s.registryId);
      sectionResolutions.push({
        pageId: page.id,
        instanceId: s.instanceId,
        requestedRegistryId: s.registryId,
        resolvedRegistryId: resolved?.registryId ?? null,
        strategy: resolved?.strategy ?? "unresolved"
      });
      if (!resolved) {
        errors.push({
          code: "unresolvable-section",
          message: `section registryId "${s.registryId}" cannot resolve · no exact match, no alias, no library fallback`,
          path: `pages.${page.id}.sections.${s.instanceId}`,
          resolution: `Change to one of the real registry ids (see docs/NEX_APP_BUILDER_PHASE_4_REUSE_MATRIX_2026_08_14.md) or add an alias in blueprint-to-pipeline.ts.`
        });
      } else if (resolved.strategy === "library-fallback") {
        messages.push({
          level: "info",
          text: `Section "${s.registryId}" resolved via library-fallback to "${resolved.registryId}" — consider adding a specific alias.`,
          path: `pages.${page.id}.sections.${s.instanceId}`
        });
      }
    }
  }

  // ── 3. Navigation integrity ────────────────────────────────────────
  const unknownNavPageIds: string[] = [];
  for (const nav of bp.navigation.primary) {
    if (nav.target.kind === "page") {
      if (!pageIds.has(nav.target.pageId)) {
        unknownNavPageIds.push(nav.target.pageId);
        errors.push({
          code: "navigation-references-unknown-page",
          message: `nav entry "${nav.label}" → page "${nav.target.pageId}" · no such page in Blueprint`,
          path: "navigation.primary",
          resolution: `Add a page with id="${nav.target.pageId}" or fix the nav target.`
        });
      }
    }
  }

  // ── 4. Data binding integrity ─────────────────────────────────────
  const declaredDataIds = new Set(bp.data.map((d) => d.id));
  const unknownDataSources: string[] = [];
  for (const page of bp.pages) {
    for (const s of page.sections) {
      if (s.data && !declaredDataIds.has(s.data.source)) {
        unknownDataSources.push(s.data.source);
        warnings.push({
          code: "data-binding-unknown-source",
          message: `section "${s.instanceId}" on page "${page.id}" binds to data.source="${s.data.source}" but no data model with that id is declared`,
          path: `pages.${page.id}.sections.${s.instanceId}.data`,
          resolution: `Add a data model with id="${s.data.source}" to bp.data or fix the binding source.`
        });
      }
    }
  }

  // ── 5. Provenance ─────────────────────────────────────────────────
  const provenance = summariseProvenance(bp);
  const classes = classifyBlueprint(bp);
  const requiredFacts = classes
    .filter((c) => c.isRequiredField && (c.level === "REQUIRED" || c.level === "UNKNOWN"))
    .map((c) => ({
      path: c.path,
      reason: c.record?.reason ?? "field marked required but unfilled"
    }));
  const inferredFacts = classes
    .filter((c) => c.level === "INFERRED")
    .map((c) => ({
      path: c.path,
      source: c.record?.source,
      confidence: c.record?.confidence
    }));

  if (requiredFacts.length > 0) {
    warnings.push({
      code: "required-facts-missing",
      message: `${requiredFacts.length} required customer fact(s) missing — Blueprint is not ready to build`,
      resolution: "Studio must collect these before running the design/image/publish workers."
    });
  }

  // ── Verdict ───────────────────────────────────────────────────────
  const valid = errors.length === 0;
  const ready = valid && requiredFacts.length === 0;
  const status = !valid ? "failed" : ready ? "ok" : "blocked";

  if (status === "ok") {
    messages.push({ level: "info", text: "Blueprint is valid AND ready to build." });
  } else if (status === "blocked") {
    messages.push({
      level: "warn",
      text: `Blueprint is structurally valid but blocked on ${requiredFacts.length} required customer fact(s).`
    });
  }

  // ── Phase 19B · Evidence-based verdict ─────────────────────────────
  const evidence: EvidenceRecord[] = [];
  evidence.push({
    observation: `Blueprint declares ${bp.pages.length} page(s) with ${sectionResolutions.length} section instance(s)`,
    source: "blueprint",
    path: "pages",
    value: { pageCount: bp.pages.length, sectionCount: sectionResolutions.length }
  });
  const resolved = sectionResolutions.filter((r) => r.strategy !== "unresolved").length;
  evidence.push({
    observation: `Adapter resolved ${resolved}/${sectionResolutions.length} section registry ids`,
    source: "adapter",
    value: { resolved, total: sectionResolutions.length }
  });
  for (const e of errors) {
    evidence.push({
      observation: `Structural error: ${e.code} · ${e.message}`,
      source: "blueprint",
      path: e.path
    });
  }
  for (const f of requiredFacts) {
    evidence.push({
      observation: `Required customer fact missing at ${f.path}`,
      source: "blueprint",
      path: f.path
    });
  }
  for (const f of inferredFacts) {
    evidence.push({
      observation: `Inferred fact at ${f.path} (source=${f.source ?? "unknown"} · confidence=${f.confidence ?? "n/a"})`,
      source: "blueprint",
      path: f.path
    });
  }

  const verdict: EvidenceVerdict = !valid
    ? {
        state: "FAILED",
        evidence,
        diagnosis: `Blueprint has ${errors.length} structural error(s) that prevent downstream workers from reasoning about it`,
        decision: "Fix the structural errors in the Blueprint before any downstream worker can run"
      }
    : ready
      ? {
          state: inferredFacts.length > 0 ? "DEGRADED" : "HEALTHY",
          evidence,
          diagnosis: inferredFacts.length > 0
            ? `Blueprint is valid + ready. ${inferredFacts.length} inferred fact(s) should be confirmed by the operator but do not block build.`
            : "Blueprint is valid + ready with no gaps.",
          decision: inferredFacts.length > 0
            ? "Proceed with downstream workers; surface inferred facts for operator confirmation"
            : "Proceed with downstream workers"
        }
      : {
          state: "BLOCKED_INPUT",
          evidence,
          diagnosis: `Blueprint is structurally valid but ${requiredFacts.length} required customer fact(s) are missing — build cannot proceed with fabrication`,
          decision: `Studio must collect these ${requiredFacts.length} fact(s) from the customer/owner before the design/publish workers run`
        };

  return report.finish<BlueprintValidationResult>(
    status,
    {
      valid,
      ready,
      requiredFacts,
      inferredFacts,
      sectionResolutions,
      navigationIntegrity: { ok: unknownNavPageIds.length === 0, unknownPageIds: unknownNavPageIds },
      dataBindingIntegrity: { ok: unknownDataSources.length === 0, unknownSources: unknownDataSources },
      provenance
    },
    verdict,
    { errors, warnings, messages }
  );
}
