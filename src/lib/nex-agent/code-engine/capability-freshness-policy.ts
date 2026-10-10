// src/lib/nex-agent/code-engine/capability-freshness-policy.ts
//
// NEX · Per-class Freshness Policy · S6 · 2026-09-21.
// Founder-authorised as part of the "Internet as External Knowledge
// Substrate" programme.
//
// PURPOSE
//
//   Different information changes at different speeds. Weather is
//   fresh for minutes. Coordinates are stable for years. Public
//   opening hours change on the order of days. Regulations should
//   ALWAYS be verified against current sources. A single global TTL
//   is wrong for all of them.
//
//   This module declares one canonical table mapping information
//   classes to freshness policies. Downstream capabilities consult
//   the table when they ask "is the stored fact I have still fresh
//   enough, or do I need to look again?"
//
//   The table is intentionally small (currently 8 classes). Adding a
//   class is a governance action: one edit here, matched everywhere
//   through the exported InformationClass union.
//
// ANTI-CHEATING GUARANTEE
//
//   · Pure declaration + one pure decision function.
//   · No LLM. No network. No I/O.
//   · Freshness verdict is deterministic given (class, retrieved_at).
//   · Policies fail SAFE: an unknown class returns "verify_always"
//     rather than assuming forever-fresh.
//
// RELATION TO OTHER CAPABILITIES
//
//   · capability-know-or-look.ts consults this to answer "is my
//     memory fresh enough, or do I need to look?".
//   · capability-selective-retention.ts consults this to know how
//     long a retained item can be considered valid.
//   · capability-evidence-status.ts (future extension) may surface
//     a freshness signal alongside the evidence level.

// ── Information classes ────────────────────────────────────────────────

export type InformationClass =
  | "weather_current"          // right-now weather · minutes/hours
  | "prices_currency_market"   // FX / stock quotes · minutes
  | "public_transport_status"  // real-time transit · minutes
  | "opening_hours"            // business hours · days to weeks
  | "public_documentation"     // gov docs · weeks to months
  | "regulations_laws"         // MUST always verify current · treat as never-fresh
  | "geographic_coordinates"   // city / place coordinates · effectively stable
  | "historical_fact";         // dates / events in the past · effectively stable

// ── Freshness policies ────────────────────────────────────────────────

export type FreshnessVerdict =
  | "fresh"           // stored fact is still valid · no re-fetch needed
  | "stale"           // stored fact is past its window · re-fetch required
  | "verify_always"   // policy demands re-fetch every time regardless of age
  | "no_expiry";      // stored fact never expires under this policy

export interface FreshnessPolicy {
  readonly class: InformationClass;
  readonly max_age_ms: number | "always_verify" | "no_expiry";
  readonly rationale: string;
}

// The canonical table. All values are conservative (err on the side of
// re-fetching) — being too fresh is a latency cost; being too stale is
// an integrity cost, and integrity ranks above latency in NEX doctrine.
export const FRESHNESS_POLICY_TABLE: readonly FreshnessPolicy[] = [
  {
    class: "weather_current",
    max_age_ms: 60 * 60 * 1000, // 1 hour
    rationale: "Weather changes on hour-scale. BMKG updates hourly at most. Anything older should be re-fetched.",
  },
  {
    class: "prices_currency_market",
    max_age_ms: 5 * 60 * 1000, // 5 minutes
    rationale: "Market prices move constantly. A price older than 5 minutes should not be quoted as current.",
  },
  {
    class: "public_transport_status",
    max_age_ms: 3 * 60 * 1000, // 3 minutes
    rationale: "Real-time transit status is only useful in the very short term.",
  },
  {
    class: "opening_hours",
    max_age_ms: 7 * 24 * 60 * 60 * 1000, // 1 week
    rationale: "Business hours change on days/weeks. A week-old cached value is at material risk.",
  },
  {
    class: "public_documentation",
    max_age_ms: 30 * 24 * 60 * 60 * 1000, // 30 days
    rationale: "Government/public docs change on weeks/months. Monthly re-verification is a reasonable floor.",
  },
  {
    class: "regulations_laws",
    max_age_ms: "always_verify",
    rationale: "Regulatory information carries real-world consequence. Always verify against a current source, never cache.",
  },
  {
    class: "geographic_coordinates",
    max_age_ms: "no_expiry",
    rationale: "City / place coordinates do not meaningfully drift on any human timescale. No expiry needed.",
  },
  {
    class: "historical_fact",
    max_age_ms: "no_expiry",
    rationale: "Dates and events in the past do not change. Historical facts do not have freshness needs.",
  },
];

// ── Decision function ────────────────────────────────────────────────
//
// Given an information class and a stored retrieved_at timestamp,
// returns a freshness verdict. Unknown classes fail safe to
// verify_always (never assume forever-fresh for an unregistered class).

export interface FreshnessInputs {
  readonly info_class: InformationClass | string;
  readonly retrieved_at_iso: string | null | undefined;
  readonly now_ms?: number; // testing hook · defaults to Date.now()
}

export interface FreshnessResult {
  readonly verdict: FreshnessVerdict;
  readonly age_ms: number | null;
  readonly policy_applied: FreshnessPolicy | null;
  readonly rationale: string;
}

const POLICY_BY_CLASS: ReadonlyMap<string, FreshnessPolicy> = new Map(
  FRESHNESS_POLICY_TABLE.map((p) => [p.class as string, p]),
);

export function assessFreshness(inputs: FreshnessInputs): FreshnessResult {
  const now = inputs.now_ms ?? Date.now();
  const policy = POLICY_BY_CLASS.get(inputs.info_class) ?? null;
  if (!policy) {
    return {
      verdict: "verify_always",
      age_ms: null,
      policy_applied: null,
      rationale: `Information class '${inputs.info_class}' is not registered in FRESHNESS_POLICY_TABLE — fail-safe: verify against current source.`,
    };
  }
  if (policy.max_age_ms === "always_verify") {
    return { verdict: "verify_always", age_ms: null, policy_applied: policy, rationale: policy.rationale };
  }
  if (policy.max_age_ms === "no_expiry") {
    return { verdict: "no_expiry", age_ms: null, policy_applied: policy, rationale: policy.rationale };
  }
  if (!inputs.retrieved_at_iso) {
    return {
      verdict: "stale",
      age_ms: null,
      policy_applied: policy,
      rationale: `No retrieved_at timestamp available for a policy with a ${policy.max_age_ms}ms window — cannot prove freshness, treat as stale.`,
    };
  }
  const retrievedMs = Date.parse(inputs.retrieved_at_iso);
  if (Number.isNaN(retrievedMs)) {
    return {
      verdict: "stale",
      age_ms: null,
      policy_applied: policy,
      rationale: `Unparseable retrieved_at_iso '${inputs.retrieved_at_iso}' — cannot prove freshness, treat as stale.`,
    };
  }
  const age_ms = Math.max(0, now - retrievedMs);
  const verdict: FreshnessVerdict = age_ms <= policy.max_age_ms ? "fresh" : "stale";
  return {
    verdict,
    age_ms,
    policy_applied: policy,
    rationale: `age ${Math.round(age_ms / 1000)}s vs. window ${Math.round(policy.max_age_ms / 1000)}s · ${verdict}`,
  };
}

// ── Inventory ────────────────────────────────────────────────────────

export interface FreshnessInventory {
  readonly total_classes: number;
  readonly always_verify_classes: readonly InformationClass[];
  readonly no_expiry_classes: readonly InformationClass[];
  readonly windowed_classes: readonly { class: InformationClass; max_age_ms: number }[];
}

export function inventoryFreshnessPolicy(): FreshnessInventory {
  const always: InformationClass[] = [];
  const forever: InformationClass[] = [];
  const windowed: { class: InformationClass; max_age_ms: number }[] = [];
  for (const p of FRESHNESS_POLICY_TABLE) {
    if (p.max_age_ms === "always_verify") always.push(p.class);
    else if (p.max_age_ms === "no_expiry") forever.push(p.class);
    else windowed.push({ class: p.class, max_age_ms: p.max_age_ms });
  }
  return {
    total_classes: FRESHNESS_POLICY_TABLE.length,
    always_verify_classes: always,
    no_expiry_classes: forever,
    windowed_classes: windowed,
  };
}
