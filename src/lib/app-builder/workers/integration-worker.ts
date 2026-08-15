// NEX App Builder · Worker 3 · Integration Materialisation (Philip 2026-08-14).
//
// Consumes: AppBlueprint.integrations[] + which sections need each integration.
// Produces: IntegrationPlan — per-integration status:
//   - DECLARED             (Blueprint asked for it, no config yet)
//   - MISSING_CONFIGURATION (declared, but preconditions unmet · e.g. Google Maps needs service-radius centre)
//   - CONFIGURED           (env vars declared, credentials not yet supplied)
//   - CONNECTED            (credentials present + provider reachable)
//   - BLOCKED              (integration can't proceed for a structural reason)
//
// Constitutional rule: NEVER invent credentials or claim CONNECTED unless
// we actually verified it (this worker doesn't touch network — CONNECTED
// requires a later worker that Philip has explicitly authorised).

import type { AppBlueprint, IntegrationRequirement } from "../blueprint-schema";
import type {
  EvidenceRecord,
  EvidenceVerdict,
  WorkerContext,
  WorkerReport
} from "./types";
import { startReport } from "./types";

export type IntegrationStatus =
  | "DECLARED"
  | "MISSING_CONFIGURATION"
  | "CONFIGURED"
  | "CONNECTED"
  | "BLOCKED";

export type IntegrationEntry = {
  provider: string;
  purpose: string;
  optional: boolean;
  status: IntegrationStatus;
  requiredConfig: string[];
  /** Config keys that ARE present in the current runtime env (name-only, values never read). */
  presentEnvKeys: string[];
  /** Config keys that are declared but NOT present. */
  missingEnvKeys: string[];
  /** Blueprint-derived preconditions this integration needs. */
  preconditions: Array<{ path: string; met: boolean; note: string }>;
  /** Sections that reference this integration via actions. */
  usedBySections: Array<{ pageId: string; instanceId: string }>;
  /** Human-readable explanation of the current state. */
  reason: string;
};

export type IntegrationPlan = {
  integrations: IntegrationEntry[];
  totals: {
    total: number;
    connected: number;
    configured: number;
    missing: number;
    blocked: number;
  };
};

export function runIntegrationWorker(
  ctx: WorkerContext
): WorkerReport<IntegrationPlan> {
  const report = startReport("integration");
  const bp = ctx.blueprint;

  const errors: WorkerReport<unknown>["errors"] = [];
  const warnings: WorkerReport<unknown>["warnings"] = [];
  const messages: WorkerReport<unknown>["messages"] = [];

  // Index which sections use which integration (via actions with kind=integration)
  const usageIndex = new Map<string, Array<{ pageId: string; instanceId: string }>>();
  for (const page of bp.pages) {
    for (const s of page.sections) {
      for (const a of s.actions ?? []) {
        if (a.kind === "integration") {
          const arr = usageIndex.get(a.provider) ?? [];
          arr.push({ pageId: page.id, instanceId: s.instanceId });
          usageIndex.set(a.provider, arr);
        }
      }
    }
  }

  const integrations = bp.integrations.map((int) => classifyIntegration(int, bp, usageIndex.get(int.provider) ?? []));

  // Surface warnings + errors
  for (const int of integrations) {
    if (int.status === "BLOCKED" && !int.optional) {
      errors.push({
        code: "integration-blocked",
        message: `integration "${int.provider}" is BLOCKED and marked non-optional · reason: ${int.reason}`,
        resolution: int.preconditions.find((p) => !p.met)?.note ?? "Fix preconditions"
      });
    } else if (int.status === "MISSING_CONFIGURATION") {
      warnings.push({
        code: "integration-missing-configuration",
        message: `integration "${int.provider}" needs: ${int.missingEnvKeys.concat(int.preconditions.filter((p) => !p.met).map((p) => p.note)).join(" · ")}`,
        resolution: "Provide env vars + fill missing Blueprint preconditions."
      });
    } else if (int.status === "DECLARED") {
      messages.push({
        level: "info",
        text: `integration "${int.provider}" declared · not yet configured`
      });
    }
  }

  const totals = {
    total: integrations.length,
    connected: integrations.filter((i) => i.status === "CONNECTED").length,
    configured: integrations.filter((i) => i.status === "CONFIGURED").length,
    missing: integrations.filter((i) => i.status === "MISSING_CONFIGURATION" || i.status === "DECLARED").length,
    blocked: integrations.filter((i) => i.status === "BLOCKED").length
  };

  const status = errors.length > 0 ? "failed"
    : totals.blocked > 0 ? "blocked"
    : totals.missing > 0 ? "warn"
    : "ok";

  // ── Phase 19B · Evidence-based verdict ─────────────────────────────
  const evidence: EvidenceRecord[] = [];
  evidence.push({
    observation: `Blueprint declares ${integrations.length} integration(s); connected=${totals.connected}, configured=${totals.configured}, missing=${totals.missing}, blocked=${totals.blocked}`,
    source: "blueprint",
    path: "integrations",
    value: totals
  });
  for (const i of integrations) {
    // Env presence is boolean per key — value never contains the secret.
    evidence.push({
      observation: `Integration "${i.provider}" status=${i.status} · ${i.reason}`,
      source: "blueprint",
      path: `integrations.${i.provider}`,
      value: { status: i.status, envPresent: i.presentEnvKeys, envMissing: i.missingEnvKeys }
    });
    for (const p of i.preconditions) {
      evidence.push({
        observation: `Precondition ${p.met ? "met" : "unmet"}: ${p.note}`,
        source: "blueprint",
        path: p.path,
        value: { met: p.met }
      });
    }
  }

  // Split "missing" into config-related vs input-related so the verdict is honest.
  const nonOptionalMissingConfig = integrations.filter(
    (i) => !i.optional && i.status === "MISSING_CONFIGURATION" && i.missingEnvKeys.length > 0
  );
  const nonOptionalMissingInput = integrations.filter(
    (i) => !i.optional && i.status === "MISSING_CONFIGURATION" &&
           i.missingEnvKeys.length === 0 && i.preconditions.some((p) => !p.met)
  );

  const verdict: EvidenceVerdict = errors.length > 0 || totals.blocked > 0
    ? {
        state: "FAILED",
        evidence,
        diagnosis: `${errors.length + totals.blocked} non-optional integration(s) cannot proceed`,
        decision: `Resolve blocked integrations before build (see errors[] for specifics)`
      }
    : nonOptionalMissingConfig.length > 0
      ? {
          state: "BLOCKED_CONFIG",
          evidence,
          diagnosis: `${nonOptionalMissingConfig.length} required integration(s) are missing runtime env vars`,
          decision: `Provide env vars for: ${nonOptionalMissingConfig.map((i) => `${i.provider} (${i.missingEnvKeys.join(", ")})`).join(" · ")}`
        }
      : nonOptionalMissingInput.length > 0
        ? {
            state: "BLOCKED_INPUT",
            evidence,
            diagnosis: `${nonOptionalMissingInput.length} required integration(s) need Blueprint-level preconditions the customer must supply`,
            decision: `Studio must collect: ${nonOptionalMissingInput.map((i) => `${i.provider} → ${i.preconditions.filter((p) => !p.met).map((p) => p.note).join(", ")}`).join(" · ")}`
          }
        : totals.missing > 0
          ? {
              state: "DEGRADED",
              evidence,
              diagnosis: `${totals.missing} optional integration(s) not fully configured — non-blocking`,
              decision: "Proceed; surface optional integration gaps for later"
            }
          : totals.connected === 0 && totals.configured === 0 && integrations.length > 0
            ? {
                state: "PENDING",
                evidence,
                diagnosis: `${integrations.length} integration(s) declared but none have been verified with a live call`,
                decision: "A later worker (explicitly authorised) must attempt live verification; do not claim CONNECTED without evidence"
              }
            : {
                state: "HEALTHY",
                evidence,
                diagnosis: integrations.length === 0
                  ? "Blueprint declares no integrations — nothing to configure"
                  : `All ${integrations.length} integration(s) are configured or connected`,
                decision: "Proceed"
              };

  return report.finish<IntegrationPlan>(
    status,
    { integrations, totals },
    verdict,
    { errors, warnings, messages }
  );
}

function classifyIntegration(
  int: IntegrationRequirement,
  bp: AppBlueprint,
  usedBy: Array<{ pageId: string; instanceId: string }>
): IntegrationEntry {
  const presentEnvKeys: string[] = [];
  const missingEnvKeys: string[] = [];
  for (const key of int.requiredConfig) {
    // Check presence ONLY — never read the value.
    if (typeof process.env[key] === "string" && process.env[key]!.length > 0) {
      presentEnvKeys.push(key);
    } else {
      missingEnvKeys.push(key);
    }
  }

  const preconditions = derivePreconditions(int, bp);

  const preconditionsMet = preconditions.every((p) => p.met);
  const allEnvPresent = missingEnvKeys.length === 0 && int.requiredConfig.length > 0;

  let status: IntegrationStatus;
  let reason: string;
  if (!preconditionsMet) {
    const failing = preconditions.filter((p) => !p.met).map((p) => p.note).join(" · ");
    status = "MISSING_CONFIGURATION";
    reason = failing;
  } else if (int.requiredConfig.length === 0) {
    status = "DECLARED";
    reason = "no runtime config required for this integration in the current design";
  } else if (!allEnvPresent) {
    status = "MISSING_CONFIGURATION";
    reason = `env vars missing: ${missingEnvKeys.join(", ")}`;
  } else {
    // Presence of env vars is not equivalent to CONNECTED — we haven't
    // made a live call. Return CONFIGURED and let a subsequent worker
    // decide when to attempt a real connection.
    status = "CONFIGURED";
    reason = "declared config keys are all present in runtime env · connection not yet verified";
  }

  return {
    provider: int.provider,
    purpose: int.purpose,
    optional: int.optional,
    status,
    requiredConfig: int.requiredConfig,
    presentEnvKeys,
    missingEnvKeys,
    preconditions,
    usedBySections: usedBy,
    reason
  };
}

/** For known providers, derive Blueprint-level preconditions.
 *  Extending: add a case here when NEX learns a new integration. */
function derivePreconditions(
  int: IntegrationRequirement,
  bp: AppBlueprint
): IntegrationEntry["preconditions"] {
  const out: IntegrationEntry["preconditions"] = [];

  if (int.provider === "google-maps") {
    // If any section references a service radius, that radius must exist.
    const sectionsNeedingRadius = bp.pages
      .flatMap((p) => p.sections)
      .filter((s) => s.registryId.includes("service-radius") || s.registryId.includes("map"))
      .filter((s) => (s.props as Record<string, unknown>).bindTo === "identity.contact.serviceRadius");

    if (sectionsNeedingRadius.length > 0) {
      const radius = bp.identity.contact.serviceRadius;
      out.push({
        path: "identity.contact.serviceRadius.centre",
        met: !!(radius && radius.centre),
        note: "identity.contact.serviceRadius.centre is required for a radius map"
      });
      out.push({
        path: "identity.contact.serviceRadius.radiusMiles",
        met: !!(radius && typeof radius.radiusMiles === "number" && radius.radiusMiles > 0),
        note: "identity.contact.serviceRadius.radiusMiles is required for a radius map"
      });
    }
  }

  if (int.provider === "stripe") {
    // Stripe checkout needs at minimum a `products` data model with a price field.
    const hasProducts = bp.data.some((d) => d.id === "products" && d.fields.some((f) => f.kind === "currency"));
    out.push({
      path: "data.products.[currency-field]",
      met: hasProducts,
      note: "Blueprint must declare a 'products' data model with a currency field for Stripe checkout"
    });
  }

  if (int.provider === "resend") {
    // Resend needs an email destination. Contact form is enough if declared.
    const hasContactForm = bp.pages
      .flatMap((p) => p.sections)
      .some((s) => s.actions?.some((a) => a.kind === "submit-form"));
    out.push({
      path: "pages.*.sections.*.actions.[submit-form]",
      met: hasContactForm,
      note: "Blueprint must declare at least one submit-form action for Resend to have delivery targets"
    });
  }

  return out;
}
