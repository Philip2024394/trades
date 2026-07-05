// Module DNA validator.
//
// "Does this increase the amount of reusable knowledge inside the
//  platform? If yes, we're moving in the right direction."
//
// Runs once at module boot (from the barrel) over the flat
// BUSINESS_MODULES array. Any invariant violation THROWS so bad
// content never ships to a merchant. This is the safety net for
// third-party contributions in Stage 6.
//
// Rules enforced:
//   • Every dependency id must exist in BUSINESS_MODULES
//   • Every event id must be prefixed with the module's own id
//   • Every dataLifecycle ref must be "<domainId>.<entityId>" format
//   • Every AssemblyAction with kind add-cta / insert-section must
//     target a known slot id
//   • Every suggest-module + wire-to action must target a real module
//   • Every assembly rule priority is 0..100

import { BUSINESS_MODULES } from "./registry";
import type { BusinessModule } from "./types";
import { isKnownSlot } from "./slots";
import type { AssemblyAction, AssemblyRule } from "./dnaTypes";

const DOMAIN_ENTITY_RE = /^[a-z-]+\.[a-z-]+$/;

export function validateModules(): void {
  const idSet = new Set(BUSINESS_MODULES.map((m) => m.id));
  const errors: string[] = [];

  for (const module of BUSINESS_MODULES) {
    // runtime.dependencies
    for (const dep of module.runtime?.dependencies ?? []) {
      if (!idSet.has(dep)) {
        errors.push(
          `Module "${module.id}" depends on unknown module "${dep}"`
        );
      }
    }

    // runtime.events must be namespaced by module id
    for (const evt of module.runtime?.events ?? []) {
      if (!evt.id.startsWith(`${module.id}.`)) {
        errors.push(
          `Module "${module.id}" event "${evt.id}" must be prefixed with "${module.id}."`
        );
      }
    }

    // runtime.dataLifecycle refs must match "<domain>.<entity>"
    for (const ref of [
      ...(module.runtime?.dataLifecycle.creates ?? []),
      ...(module.runtime?.dataLifecycle.reads ?? []),
      ...(module.runtime?.dataLifecycle.updates ?? [])
    ]) {
      if (!DOMAIN_ENTITY_RE.test(ref)) {
        errors.push(
          `Module "${module.id}" dataLifecycle ref "${ref}" must be "<domain>.<entity>" format`
        );
      }
    }

    // assembly rules
    for (const rule of module.assemblyRules ?? []) {
      validateAssemblyRule(module, rule, idSet, errors);
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `Module DNA validation failed:\n  - ${errors.join("\n  - ")}`
    );
  }
}

function validateAssemblyRule(
  module: BusinessModule,
  rule: AssemblyRule,
  moduleIdSet: Set<string>,
  errors: string[]
): void {
  // Priority range
  if (rule.action.priority < 0 || rule.action.priority > 100) {
    errors.push(
      `Module "${module.id}" rule "${rule.id}" priority must be 0..100, got ${rule.action.priority}`
    );
  }

  // Rationale must be non-empty
  if (!rule.rationale || rule.rationale.length < 8) {
    errors.push(
      `Module "${module.id}" rule "${rule.id}" needs a rationale — every rule surfaces to the merchant.`
    );
  }

  validateAssemblyAction(module, rule, rule.action, moduleIdSet, errors);
}

function validateAssemblyAction(
  module: BusinessModule,
  rule: AssemblyRule,
  action: AssemblyAction,
  moduleIdSet: Set<string>,
  errors: string[]
): void {
  switch (action.kind) {
    case "add-cta":
    case "insert-section":
      if (!isKnownSlot(action.target)) {
        errors.push(
          `Module "${module.id}" rule "${rule.id}" targets unknown slot "${action.target}". Add to SLOT_REGISTRY first.`
        );
      }
      break;
    case "add-nav-item":
      if (!isKnownSlot(action.target)) {
        errors.push(
          `Module "${module.id}" rule "${rule.id}" nav-item targets unknown slot "${action.target}"`
        );
      }
      break;
    case "wire-to":
    case "suggest-module":
      if (!moduleIdSet.has(action.target)) {
        errors.push(
          `Module "${module.id}" rule "${rule.id}" targets unknown module "${action.target}"`
        );
      }
      break;
    case "add-to-page":
      // Page ids are free-form for now; adapters resolve at install
      break;
  }
}
