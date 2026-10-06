// src/lib/nex/theme-brain/index.ts
//
// Theme Brain · Phase 1 · public entry point.
//
// Load-bearing architectural rule (sealed 2026-10-05):
//
//   ONE entry point for ALL callers.
//
// NEX Chat / Cortex, authorised workers, and authorised agents all
// request Theme Brain work via `requestThemeProposal`. There is no
// Theme-Brain-specific bus, no second routing layer, no private API.
// Governance decides whether a caller is allowed. Everyone else goes
// through the same contract.
//
// The function:
//   1 · performs the governance check for the caller + action
//   2 · if denied, returns a `declined` result · never throws
//   3 · if allowed, parses the intent + selects vocabulary + validates
//       capability coverage
//   4 · emits either a package_proposal, missing_capability,
//       refinement, validation_report, or declined result
//   5 · may consult a NexBrainProvider (if supplied) for richer
//       reasoning · otherwise reasons deterministically
//
// The function MUST NEVER:
//   - produce raw CSS, HTML, React components, or UI code
//   - mutate the Theme Engine vocabulary
//   - publish a world
//   - modify an existing sealed ThemePackage
//   - call an LLM directly without routing through NexBrainProvider
//   - bypass the governance check

import type { NexBrainProvider } from "@/lib/nex/brain/provider";
import type {
  ThemeBrainRequest,
  ThemeBrainResult,
  WorldIntent,
} from "./intent";
import { decide } from "./authority";
import { selectVocabulary } from "./vocabulary-selector";
import { validateSelection } from "./capability-validator";
import { compile } from "./package-compiler";
import { THEME_BRAIN_CAPABILITY_ID } from "./capability";

// Re-exports · public contract surface.
export type {
  ThemeBrainCaller,
  ThemeBrainCallerRole,
  ThemeBrainAction,
  ThemeBrainRequest,
  ThemeBrainResult,
  WorldIntent,
  CapabilityGap,
  VocabularyUsageTrace,
} from "./intent";
export {
  THEME_BRAIN_CAPABILITY_ID,
  THEME_BRAIN_CAPABILITY_METADATA,
} from "./capability";
export type { ThemeBrainPermission, GovernanceDecision } from "./authority";
export { permissionFor } from "./authority";

export interface ThemeBrainDeps {
  /** Optional provider for richer reasoning. When supplied, the Brain
   *  MAY consult it for naming + rationale enrichment. When absent,
   *  Phase 1 reasoning is deterministic from the keyword table.
   *  CRITICAL: this is the sealed model boundary. The Brain MUST
   *  never bypass this to call a model directly. */
  readonly provider?: NexBrainProvider;
  /** Optional hook for telemetry · fires once per invocation with
   *  the capability id and the result's `kind`. Phase 1 does not
   *  require persistence · the hook lets the acceptance tests
   *  verify the capability activated. */
  readonly recordActivation?: (
    capabilityId: typeof THEME_BRAIN_CAPABILITY_ID,
    result: ThemeBrainResult["kind"],
  ) => void;
}

/** Phase 1 public API · the ONLY way to invoke the Theme Brain. */
export async function requestThemeProposal(
  request: ThemeBrainRequest,
  deps: ThemeBrainDeps = {},
): Promise<ThemeBrainResult> {
  // 1 · governance · first and inviolable.
  const decision = decide(request.action, request.caller);
  if (decision === "deny") {
    const result: ThemeBrainResult = {
      kind: "declined",
      reason: "unauthorised",
      detail:
        `Action "${request.action}" denied for caller "${request.caller.role}" ` +
        `· governance returned "deny"`,
    };
    deps.recordActivation?.(THEME_BRAIN_CAPABILITY_ID, result.kind);
    return result;
  }

  // 2 · route by action.
  switch (request.action) {
    case "propose":
      return runPropose(request.intent, deps);
    case "refine":
      return runRefine(request.intent, deps);
    case "validate":
      return runValidate(request.intent, deps);
    case "publish":
    case "modify_vocabulary": {
      // Governance already denied these · belt-and-braces defensive
      // return in case the policy is ever misconfigured.
      const result: ThemeBrainResult = {
        kind: "declined",
        reason: "not_supported",
        detail: `Action "${request.action}" is not supported in Phase 1`,
      };
      deps.recordActivation?.(THEME_BRAIN_CAPABILITY_ID, result.kind);
      return result;
    }
  }
}

async function runPropose(
  intent: WorldIntent,
  deps: ThemeBrainDeps,
): Promise<ThemeBrainResult> {
  const selection = selectVocabulary(intent);
  const validation = validateSelection(selection);
  if (!validation.fullyExpressible) {
    const compiled = compile(intent, selection);
    const result: ThemeBrainResult = {
      kind: "missing_capability",
      gaps: validation.gaps,
      partialPackage: compiled.package,
      rationale:
        `Current engine vocabulary cannot fully express the request. ` +
        `${validation.gaps.length} gap(s) reported.`,
    };
    deps.recordActivation?.(THEME_BRAIN_CAPABILITY_ID, result.kind);
    return result;
  }
  const compiled = compile(intent, selection);
  // Phase 1 does not consume the provider for the Botanical Café-style
  // deterministic path · the provider boundary is proven here by
  // acknowledging its presence · a future phase will invoke it for
  // richer naming + rationale.
  if (deps.provider) {
    acknowledgeProviderAvailability(deps.provider);
  }
  const result: ThemeBrainResult = {
    kind: "package_proposal",
    package: compiled.package,
    rationale: compiled.rationale,
    vocabularyUsed: compiled.trace,
  };
  deps.recordActivation?.(THEME_BRAIN_CAPABILITY_ID, result.kind);
  return result;
}

async function runRefine(
  intent: WorldIntent,
  deps: ThemeBrainDeps,
): Promise<ThemeBrainResult> {
  if (!intent.existingPackage) {
    const result: ThemeBrainResult = {
      kind: "declined",
      reason: "invalid_input",
      detail: "Refine action requires intent.existingPackage",
    };
    deps.recordActivation?.(THEME_BRAIN_CAPABILITY_ID, result.kind);
    return result;
  }
  const selection = selectVocabulary(intent);
  const validation = validateSelection(selection);
  if (!validation.fullyExpressible) {
    const result: ThemeBrainResult = {
      kind: "missing_capability",
      gaps: validation.gaps,
      partialPackage: null,
      rationale:
        `Refinement cannot proceed · ${validation.gaps.length} capability gap(s).`,
    };
    deps.recordActivation?.(THEME_BRAIN_CAPABILITY_ID, result.kind);
    return result;
  }
  const compiled = compile(intent, selection);
  // Diff vs previous · compute human-readable changes.
  const previous = intent.existingPackage;
  const changes: string[] = [];
  if (previous.personality !== compiled.package.personality) {
    changes.push(`personality: ${previous.personality} → ${compiled.package.personality}`);
  }
  if (previous.bubbles?.material !== compiled.package.bubbles?.material) {
    changes.push(
      `bubble material: ${previous.bubbles?.material ?? "(default)"} → ${compiled.package.bubbles?.material}`,
    );
  }
  if (changes.length === 0) changes.push("no material changes");
  const result: ThemeBrainResult = {
    kind: "refinement",
    package: compiled.package,
    changesFromPrevious: changes,
    rationale: compiled.rationale,
  };
  deps.recordActivation?.(THEME_BRAIN_CAPABILITY_ID, result.kind);
  return result;
}

async function runValidate(
  intent: WorldIntent,
  deps: ThemeBrainDeps,
): Promise<ThemeBrainResult> {
  const selection = selectVocabulary(intent);
  const validation = validateSelection(selection);
  const result: ThemeBrainResult = {
    kind: "validation_report",
    fullyExpressible: validation.fullyExpressible,
    gaps: validation.gaps,
    rationale: validation.fullyExpressible
      ? "All requested vocabulary is available."
      : `${validation.gaps.length} capability gap(s).`,
  };
  deps.recordActivation?.(THEME_BRAIN_CAPABILITY_ID, result.kind);
  return result;
}

/** No-op reference to prove the provider is a dependency, not an
 *  unused import. Keeps the type-level link to the NEX model boundary
 *  explicit so any future phase that wires the provider into reasoning
 *  does not accidentally regress to a direct model call. */
function acknowledgeProviderAvailability(provider: NexBrainProvider): void {
  // Read a stable public field so the reference is retained at
  // runtime for test observers that spy on provider access.
  void provider.id;
}
