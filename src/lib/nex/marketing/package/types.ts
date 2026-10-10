// src/lib/nex/marketing/package/types.ts
//
// NEX Managed Email Marketing · Stage 3 · Package types
// Founder-authorised programme (three-lane operating doctrine · ADR-0003a Accepted).
//
// **Product boundary hard-lock** (ADR-0003a Clauses 1/5):
//   A package purchases managed campaign execution capability.
//   It does NOT purchase contacts / addresses / a lead list.
//
// **Denomination language** (ADR-0003a Clause 3 · founder-locked):
//   PERMITTED · "500 managed campaign sends" · "1 campaign" · "monthly capacity"
//   FORBIDDEN · "500 leads" · "500 addresses" · "500 contacts" · "1000 emails to own"

// ─── Package status (6-state canonical vocabulary) ─────────────────
export type PackageStatus =
  | "available"           // purchased but not yet activated
  | "active"              // in use · consumption permitted
  | "exhausted"           // reserved + consumed = purchased · no capacity left
  | "expired"             // past expiry timestamp · sends blocked · terminal
  | "paused"              // temporarily halted (member or admin) · reversible
  | "cancelled";          // cancelled before use · terminal · refund handled externally

// State transitions (paused reversible · expired/cancelled/exhausted terminal in isolation but transitions inbound allowed)
export const VALID_PACKAGE_TRANSITIONS: ReadonlyArray<{ from: PackageStatus; to: PackageStatus }> = [
  { from: "available", to: "active" },
  { from: "available", to: "cancelled" },
  { from: "available", to: "expired" },
  { from: "active",    to: "paused" },
  { from: "active",    to: "exhausted" },
  { from: "active",    to: "expired" },
  { from: "active",    to: "cancelled" },
  { from: "paused",    to: "active" },
  { from: "paused",    to: "expired" },
  { from: "paused",    to: "cancelled" },
  { from: "exhausted", to: "expired" },   // e.g. exhausted then time-expires
  { from: "exhausted", to: "cancelled" }, // rare · admin intervention
  // expired · cancelled are terminal
];

// Statuses that PERMIT reservation/consumption
export const CONSUMABLE_STATUSES: ReadonlySet<PackageStatus> = new Set(["active"]);

// ─── Attribution state (per-unit accounting) ───────────────────────
export type AttributionState = "reserved" | "consumed" | "released";

// ─── Package targeting (optional constraints attached to the package) ─
export interface PackageTargeting {
  readonly country?: string;
  readonly category?: string;
  readonly language?: string;
  readonly extra?: Readonly<Record<string, unknown>>;
}

// ─── The package entity ────────────────────────────────────────────
export interface Package {
  readonly package_id: string;
  readonly member_id: string;

  readonly package_type: string;                // e.g. 'starter-500-managed-sends'
  readonly display_name: string | null;

  // Three-part capacity (invariant · DB CHECK enforced)
  readonly purchased_capacity: number;
  readonly reserved_capacity: number;
  readonly consumed_capacity: number;

  readonly status: PackageStatus;

  // Purchase provenance (never credentials)
  readonly currency: string | null;
  readonly purchase_reference: string | null;
  readonly purchase_amount_minor: number | null;
  readonly purchased_at: string | null;
  readonly activated_at: string | null;
  readonly expires_at: string | null;

  readonly targeting: PackageTargeting;
  readonly metadata: Readonly<Record<string, unknown>>;

  readonly created_at: string;
  readonly updated_at: string;
}

// ─── Derived capacity view ─────────────────────────────────────────
export interface PackageCapacity {
  readonly package_id: string;
  readonly purchased: number;
  readonly reserved: number;
  readonly consumed: number;
  readonly remaining: number;                    // purchased - reserved - consumed
  readonly is_consumable: boolean;               // status permits + remaining > 0
}

export function computeCapacity(pkg: Package): PackageCapacity {
  const remaining = Math.max(0, pkg.purchased_capacity - pkg.reserved_capacity - pkg.consumed_capacity);
  return {
    package_id: pkg.package_id,
    purchased: pkg.purchased_capacity,
    reserved: pkg.reserved_capacity,
    consumed: pkg.consumed_capacity,
    remaining,
    is_consumable: CONSUMABLE_STATUSES.has(pkg.status) && remaining > 0,
  };
}

// ─── Attribution record (immutable ledger entry) ───────────────────
export interface PackageAttribution {
  readonly attribution_id: string;
  readonly idempotency_key: string;
  readonly package_id: string;
  readonly member_id: string;
  readonly campaign_id: string;
  readonly contact_id: string;
  readonly queue_id: string | null;
  readonly state: AttributionState;
  readonly units: number;
  readonly reserved_at: string;
  readonly consumed_at: string | null;
  readonly released_at: string | null;
  readonly release_reason: string | null;
  readonly detail: Readonly<Record<string, unknown>>;
}

// ─── Reserve / Consume / Release inputs ────────────────────────────
export interface ReserveInput {
  readonly package_id: string;
  readonly member_id: string;               // enforced-at-insert for isolation
  readonly campaign_id: string;
  readonly contact_id: string;
  readonly queue_id?: string;
  readonly attempt_id?: string | number;    // enables intentional retry with fresh key
  readonly units?: number;                  // defaults to 1
  readonly actor?: string;                  // defaults to 'system:executor'
}

export type ReserveOutcome =
  | { kind: "reserved"; attribution: PackageAttribution }
  | { kind: "already_attributed"; attribution: PackageAttribution }   // idempotent replay · not an error
  | { kind: "capacity_exhausted"; package_id: string; remaining: number }
  | { kind: "package_not_consumable"; package_id: string; status: PackageStatus }
  | { kind: "member_isolation_violation"; expected_member: string; got_member: string }
  | { kind: "package_not_found"; package_id: string };

export interface ConsumeInput {
  readonly attribution_id: string;
  readonly actor?: string;
  readonly detail?: Readonly<Record<string, unknown>>;
}

export type ConsumeOutcome =
  | { kind: "consumed"; attribution: PackageAttribution }
  | { kind: "already_consumed"; attribution: PackageAttribution }     // idempotent replay
  | { kind: "invalid_state"; current: AttributionState }
  | { kind: "attribution_not_found"; attribution_id: string };

export interface ReleaseInput {
  readonly attribution_id: string;
  readonly reason: string;
  readonly actor?: string;
}

export type ReleaseOutcome =
  | { kind: "released"; attribution: PackageAttribution }
  | { kind: "already_released"; attribution: PackageAttribution }
  | { kind: "cannot_release_consumed"; attribution_id: string }       // consumed is terminal · refund policy separate
  | { kind: "attribution_not_found"; attribution_id: string };

// ─── Audit event kinds ─────────────────────────────────────────────
export type PackageAuditEventKind =
  | "created"
  | "activated"
  | "paused"
  | "resumed"
  | "exhausted"
  | "expired"
  | "cancelled"
  | "capacity_reserved"
  | "capacity_consumed"
  | "capacity_released"
  | "status_changed"
  | "duplicate_purchase_attempt"
  | "isolation_violation_attempt";

// ─── Errors ─────────────────────────────────────────────────────────
export class PackageError extends Error {
  constructor(public readonly reason: string, message: string) {
    super(message);
    this.name = "PackageError";
  }
}

export class InvalidPackageStatusTransitionError extends PackageError {
  constructor(from: PackageStatus, to: PackageStatus) {
    super("invalid_package_status_transition", `Cannot transition package status from '${from}' to '${to}' · violates Stage-3 lifecycle.`);
  }
}

export class MemberIsolationViolationError extends PackageError {
  constructor(expected: string, got: string) {
    super("member_isolation_violation", `Package member_id=${expected} but caller supplied member_id=${got} · Clause 4 member-isolation violation.`);
  }
}

export class LaneIsolationViolationError extends PackageError {
  constructor(detail: string) {
    super("lane_isolation_violation", `Package-consumption attempted outside MEMBER lane · ${detail} · three-lane operating doctrine violated.`);
  }
}

// ─── Package denomination language guard (Rule 5o.T · founder-locked) ─
export const FORBIDDEN_DENOMINATION_STRINGS: ReadonlyArray<string> = [
  "leads", "lead-list", "lead list", "raw addresses", "addresses to own",
  "emails to own", "contact list", "downloadable csv", "download csv",
  "contact download", "raw list",
];

/** Refuses to create a package whose display name or package_type contains any
 *  denomination language forbidden by ADR-0003a Clause 3 (managed capacity NOT leads). */
export function assertPackageDenominationLanguage(package_type: string, display_name: string | null | undefined, caller: string): void {
  const haystack = `${package_type} ${display_name ?? ""}`.toLowerCase();
  for (const forbidden of FORBIDDEN_DENOMINATION_STRINGS) {
    if (haystack.includes(forbidden)) {
      throw new PackageError(
        "forbidden_denomination_language",
        `ADR-0003a Clause 3 violation in '${caller}': package name/type contains forbidden phrase '${forbidden}'. Managed campaign capacity ≠ lead ownership.`,
      );
    }
  }
}
