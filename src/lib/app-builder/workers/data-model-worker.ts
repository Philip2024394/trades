// NEX App Builder · Worker 2 · Data Model Materialisation (Philip 2026-08-14).
//
// Consumes: AppBlueprint.data[] + bp.pages[].sections[].data bindings.
// Produces: DataModelPlan — a concrete per-model status report:
//   - required fields
//   - which fields have safe system defaults
//   - which fields the customer still needs to supply
//   - seed status (has seed rows / empty)
//   - binding usage (which sections consume it)
//
// Constitutional rule: NEVER invent customer data. If a required field
// has no value and no safe default, mark it as CUSTOMER_INPUT_REQUIRED.

import type { AppBlueprint, DataModelSpec, DataField } from "../blueprint-schema";
import type {
  EvidenceRecord,
  EvidenceVerdict,
  WorkerContext,
  WorkerReport
} from "./types";
import { startReport } from "./types";

export type DataModelStatus =
  | "SEEDED"                    // has seed rows the app can boot with
  | "READY_EMPTY"               // safe to start empty (customer will populate)
  | "CUSTOMER_INPUT_REQUIRED"   // required model has no seed + required fields customer must supply
  | "UNUSED";                   // declared but no section binds to it

export type DataModelPlan = {
  models: Array<{
    id: string;
    label: string;
    required: boolean;
    status: DataModelStatus;
    fieldSummary: {
      total: number;
      required: number;
      withDefault: number;
      customerInput: number;
    };
    /** Sections that reference this model (from bindings). */
    consumingSections: Array<{ pageId: string; instanceId: string }>;
    /** Fields the customer must supply for this model to be usable. */
    fieldsNeedingCustomerInput: DataField[];
    /** Number of seed rows present. */
    seedCount: number;
  }>;
  totals: {
    modelsDeclared: number;
    modelsReady: number;
    modelsBlocked: number;
    modelsUnused: number;
  };
};

export function runDataModelWorker(
  ctx: WorkerContext
): WorkerReport<DataModelPlan> {
  const report = startReport("data-model");
  const bp = ctx.blueprint;

  const errors: WorkerReport<unknown>["errors"] = [];
  const warnings: WorkerReport<unknown>["warnings"] = [];
  const messages: WorkerReport<unknown>["messages"] = [];

  // Index bindings — which sections consume which model
  const bindingIndex = new Map<string, Array<{ pageId: string; instanceId: string }>>();
  for (const page of bp.pages) {
    for (const s of page.sections) {
      if (!s.data) continue;
      const arr = bindingIndex.get(s.data.source) ?? [];
      arr.push({ pageId: page.id, instanceId: s.instanceId });
      bindingIndex.set(s.data.source, arr);
    }
  }

  const models: DataModelPlan["models"] = bp.data.map((m) => classifyModel(m, bindingIndex.get(m.id) ?? []));

  // Every model consumed by a section MUST be declared. Missing declarations
  // are already surfaced by validation-worker; here we double-check by
  // looking for bindings whose source isn't declared.
  const declaredIds = new Set(bp.data.map((d) => d.id));
  for (const src of bindingIndex.keys()) {
    if (!declaredIds.has(src)) {
      errors.push({
        code: "binding-to-undeclared-model",
        message: `section binds to data.source="${src}" but no data model with that id is declared`,
        resolution: `Add a data model with id="${src}" to bp.data.`
      });
    }
  }

  // Warnings for CUSTOMER_INPUT_REQUIRED
  for (const m of models) {
    if (m.status === "CUSTOMER_INPUT_REQUIRED") {
      warnings.push({
        code: "customer-input-required",
        message: `data model "${m.id}" needs the customer to supply ${m.fieldsNeedingCustomerInput.length} field(s): ${m.fieldsNeedingCustomerInput.map((f) => f.name).join(", ")}`,
        resolution: `Studio must present a form for these fields before the app can boot with real data.`
      });
    }
    if (m.status === "UNUSED") {
      messages.push({
        level: "info",
        text: `Data model "${m.id}" declared but unused by any section — Studio may still surface it as extensible.`
      });
    }
  }

  const totals = {
    modelsDeclared: models.length,
    modelsReady: models.filter((m) => m.status === "SEEDED" || m.status === "READY_EMPTY").length,
    modelsBlocked: models.filter((m) => m.status === "CUSTOMER_INPUT_REQUIRED").length,
    modelsUnused: models.filter((m) => m.status === "UNUSED").length
  };

  const status = errors.length > 0 ? "failed"
    : totals.modelsBlocked > 0 ? "blocked"
    : totals.modelsUnused > 0 ? "warn"
    : "ok";

  // ── Phase 19B · Evidence-based verdict ─────────────────────────────
  const evidence: EvidenceRecord[] = [];
  evidence.push({
    observation: `Blueprint declares ${models.length} data model(s); ${totals.modelsReady} ready, ${totals.modelsBlocked} blocked, ${totals.modelsUnused} unused`,
    source: "blueprint",
    path: "data",
    value: totals
  });
  for (const m of models) {
    evidence.push({
      observation: `Data model "${m.id}" status=${m.status} (seedRows=${m.seedCount}, requiredFields=${m.fieldSummary.required}, boundBy=${m.consumingSections.length} section(s))`,
      source: "blueprint",
      path: `data.${m.id}`,
      value: { status: m.status, seedCount: m.seedCount }
    });
  }
  for (const e of errors) {
    evidence.push({
      observation: `Structural error: ${e.code} · ${e.message}`,
      source: "blueprint"
    });
  }

  const blockedModels = models.filter((m) => m.status === "CUSTOMER_INPUT_REQUIRED");
  const verdict: EvidenceVerdict = errors.length > 0
    ? {
        state: "FAILED",
        evidence,
        diagnosis: `Data model plan has ${errors.length} structural error(s) — sections bind to models that were never declared`,
        decision: "Fix the binding→model mismatch in the Blueprint before proceeding"
      }
    : blockedModels.length > 0
      ? {
          state: "BLOCKED_INPUT",
          evidence,
          diagnosis: `${blockedModels.length} data model(s) require customer-supplied rows and have no seed data — fabrication would violate the constitution`,
          decision: `Studio must collect rows for: ${blockedModels.map((m) => m.id).join(", ")}`
        }
      : totals.modelsUnused > 0
        ? {
            state: "DEGRADED",
            evidence,
            diagnosis: `${totals.modelsUnused} data model(s) declared but no section binds to them — extensible for later, non-blocking for build`,
            decision: "Proceed; surface unused models to operator so they can trim or extend the Blueprint"
          }
        : {
            state: "HEALTHY",
            evidence,
            diagnosis: `All ${models.length} data model(s) are either seeded or safe to start empty`,
            decision: "Proceed"
          };

  return report.finish<DataModelPlan>(
    status,
    { models, totals },
    verdict,
    { errors, warnings, messages }
  );
}

function classifyModel(
  m: DataModelSpec,
  bindings: Array<{ pageId: string; instanceId: string }>
): DataModelPlan["models"][number] {
  const seedCount = m.seed?.length ?? 0;
  const requiredFields = m.fields.filter((f) => f.required);
  const fieldsWithDefault = m.fields.filter((f) => !f.required); // Non-required fields have implicit "empty is fine"
  const fieldsNeedingCustomerInput = seedCount > 0 ? [] : requiredFields;

  let status: DataModelStatus;
  if (bindings.length === 0) status = "UNUSED";
  else if (seedCount > 0) status = "SEEDED";
  else if (m.required && requiredFields.length > 0) status = "CUSTOMER_INPUT_REQUIRED";
  else status = "READY_EMPTY";

  return {
    id: m.id,
    label: m.label,
    required: m.required,
    status,
    fieldSummary: {
      total: m.fields.length,
      required: requiredFields.length,
      withDefault: fieldsWithDefault.length,
      customerInput: fieldsNeedingCustomerInput.length
    },
    consumingSections: bindings,
    fieldsNeedingCustomerInput,
    seedCount
  };
}
