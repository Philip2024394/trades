// Platform Policy Engine — capability-based access control.
//
// ─── 3-question rule ────────────────────────────────────────────────
//
// 1. Why platform?  Access checks span every App and every service.
//    If each App shipped its own `can()` runtime, we'd have N
//    inconsistent access models. Enterprise's differentiator is
//    composable roles — the platform must own the composition.
//
// 2. Which future Apps benefit?  Every App that mints fine-grained
//    capabilities. Orders (`orders.approve_refund`), Marketplace
//    (`marketplace.moderate_listings`), Finance (`finance.issue_credit`),
//    Fleet (`fleet.dispatch_driver`), Insurance (`insurance.underwrite`),
//    HR (`hr.terminate_employee`), Compliance (`compliance.export_audit`).
//
// 3. Which doc authorises?  ADR-040 + TRADE_CENTER_PLATFORM_DELTA
//    §4.3 row "Capability model" + TRADE_CENTER_PLATFORM_
//    ARCHITECTURE.md §6 "Capabilities & Policies".
//
// ─── Design ─────────────────────────────────────────────────────────
//
// Three layers:
//   Capabilities  — atomic, minted by Apps via declaredCapabilities
//   Roles         — composable bundles of capabilities
//   Grants        — user × role × scope
//
// The runtime `can(userSlug, capabilityKey, ctx)` walks role grants
// and asks whether ANY role held by the user carries the capability.
//
// Storage (Wave 2): tc_policy.capabilities / roles / role_capabilities
// / user_roles. Week 2 ships an in-memory engine — the API surface is
// identical so the persistent backend swaps without any consumer
// change.

import { appRegistry } from "@/platform/registry";
import { emitBaseline } from "@/platform/telemetry/baseline";
import type { PolicyCapabilityDeclaration } from "@/platform/manifest/types";

// ─── Types ─────────────────────────────────────────────────────

export type CapabilityKey = string; // "orders.approve_refund"

export type Role = {
  key: string;                       // "merchant_manager"
  displayName: string;
  description?: string;
  /** Role keys this extends — capabilities inherit transitively. */
  extends?: readonly string[];
  /** Direct capabilities granted by this role. */
  capabilities: readonly CapabilityKey[];
  /** Optional business scope binding (Enterprise). */
  businessSlug?: string;
};

export type RoleGrant = {
  userSlug: string;
  roleKey: string;
  businessSlug?: string;
  grantedAt: number;
  grantedBy: string;
};

export type PolicyContext = {
  userSlug: string;
  businessSlug?: string;
};

// ─── In-memory storage (Wave 2 swaps for tc_policy.*) ─────────

const roles = new Map<string, Role>();
const grants: RoleGrant[] = [];

// ─── Capability discovery ─────────────────────────────────────

export type DiscoveredCapability = PolicyCapabilityDeclaration & {
  appSlug: string;
  appName: string;
};

/** Discover every capability every registered App has minted. */
export function discoverCapabilities(): DiscoveredCapability[] {
  const out: DiscoveredCapability[] = [];
  for (const app of appRegistry.list()) {
    if (!app.declaredCapabilities?.length) continue;
    for (const cap of app.declaredCapabilities) {
      out.push({ ...cap, appSlug: app.slug, appName: app.name });
    }
  }
  return out;
}

/** All capability keys, deduped. */
export function capabilityKeys(): string[] {
  return Array.from(
    new Set(discoverCapabilities().map((c) => c.key))
  );
}

// ─── Role composition ─────────────────────────────────────────

export function registerRole(role: Role): void {
  if (roles.has(role.key)) {
    throw new Error(`Role "${role.key}" already registered.`);
  }
  roles.set(role.key, role);
  emitBaseline("plugin.event.emitted", 1, {
    app: "shell",
    kind: "policy.role_registered"
  });
}

export function getRole(key: string): Role | undefined {
  return roles.get(key);
}

export function listRoles(): Role[] {
  return Array.from(roles.values());
}

/** Return every capability a role holds, transitively resolving
 *  `extends` chains. */
export function capabilitiesForRole(roleKey: string): Set<CapabilityKey> {
  const out = new Set<CapabilityKey>();
  const seen = new Set<string>();
  function walk(k: string): void {
    if (seen.has(k)) return;
    seen.add(k);
    const r = roles.get(k);
    if (!r) return;
    for (const c of r.capabilities) out.add(c);
    for (const parent of r.extends ?? []) walk(parent);
  }
  walk(roleKey);
  return out;
}

// ─── Grants ───────────────────────────────────────────────────

export function grantRole(input: {
  userSlug: string;
  roleKey: string;
  businessSlug?: string;
  grantedBy: string;
}): void {
  if (!roles.has(input.roleKey)) {
    throw new Error(`Cannot grant unregistered role "${input.roleKey}".`);
  }
  const dupe = grants.find(
    (g) =>
      g.userSlug === input.userSlug &&
      g.roleKey === input.roleKey &&
      g.businessSlug === input.businessSlug
  );
  if (dupe) return;
  grants.push({
    userSlug: input.userSlug,
    roleKey: input.roleKey,
    businessSlug: input.businessSlug,
    grantedAt: Date.now(),
    grantedBy: input.grantedBy
  });
  emitBaseline("plugin.event.emitted", 1, {
    app: "shell",
    kind: "policy.role_granted"
  });
}

export function revokeRole(input: {
  userSlug: string;
  roleKey: string;
  businessSlug?: string;
}): void {
  const before = grants.length;
  for (let i = grants.length - 1; i >= 0; i--) {
    const g = grants[i];
    if (
      g.userSlug === input.userSlug &&
      g.roleKey === input.roleKey &&
      g.businessSlug === input.businessSlug
    ) {
      grants.splice(i, 1);
    }
  }
  if (grants.length !== before) {
    emitBaseline("plugin.event.emitted", 1, {
      app: "shell",
      kind: "policy.role_revoked"
    });
  }
}

/** All roles held by a user. Businesses filter matches when the
 *  `businessSlug` on the ctx is provided. */
export function rolesForUser(ctx: PolicyContext): Role[] {
  const out: Role[] = [];
  for (const g of grants) {
    if (g.userSlug !== ctx.userSlug) continue;
    if (g.businessSlug && g.businessSlug !== ctx.businessSlug) continue;
    const role = roles.get(g.roleKey);
    if (role) out.push(role);
  }
  return out;
}

// ─── Runtime check — the load-bearing API ─────────────────────

/** Does this user hold the capability under the given context?
 *
 *  Every check emits a `plugin.flag.evaluated` baseline metric so
 *  authz decisions are observable in the same telemetry stream as
 *  everything else. */
export function can(
  ctx: PolicyContext,
  capability: CapabilityKey
): boolean {
  const userRoles = rolesForUser(ctx);
  let outcome = false;
  for (const role of userRoles) {
    if (capabilitiesForRole(role.key).has(capability)) {
      outcome = true;
      break;
    }
  }
  emitBaseline("plugin.flag.evaluated", 1, {
    app: "shell",
    kind: "policy",
    capability,
    outcome: outcome ? "allow" : "deny"
  });
  return outcome;
}

/** Throwing variant — use at server route boundaries. */
export function assertCan(
  ctx: PolicyContext,
  capability: CapabilityKey
): void {
  if (!can(ctx, capability)) {
    throw new Error(
      `assertCan: user "${ctx.userSlug}" lacks capability "${capability}"` +
        (ctx.businessSlug ? ` in business "${ctx.businessSlug}"` : "")
    );
  }
}

// ─── Reset (used by the verification harness) ─────────────────

export function resetPolicyEngineForTests(): void {
  roles.clear();
  grants.length = 0;
}
