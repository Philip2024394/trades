// WO-CAP-FOUNDER-VIEW-01 · founder-facing CAP classification + recommendation.
//
// Founder-locked 2026-09-13. Requirements:
//
//   1. KEEP the underlying CAP registry unchanged. This module is pure
//      read + classification. It never mutates state, never persists,
//      never grants any authority.
//
//   2. Distinguish REAL production capability risks from adversarial /
//      test-generated CAPs so the founder-facing UI cannot mistake a
//      deliberate registry-tamper test for a genuine failure.
//
//   3. Provide a deterministic "recommended next action" selector that
//      is registry-driven (no hardcoded CAP IDs).
//
//   4. Never claim RESOLVED. RESOLVED reflects the underlying CAP
//      registry status, which only transitions on real evidence chain.
//
// Governing doctrine (2026-09-13):
//   - "NEX can govern weaknesses" (today)
//   - "NEX can actually resolve a bounded weakness" (post-WO-CAP-EXECUTION-03)
//   - This module is the govern surface, NOT a resolve surface.

import type { CapabilityGap } from "./types";

// ── Classification tags (founder-facing) ────────────────────────────────

export type FounderClass =
  | "REAL_RISK"            // 🔴 genuine unresolved production capability weakness
  | "TEST_EVENT"           // 🧪 adversarial/test-namespace CAP · not a real failure
  | "SECURITY_ESCALATION"  // 🛡  security issue · founder-only, no autonomous resolution
  | "WAITING_FOUNDER"      // ⏳ proposal drafted · awaits founder Ed25519 signature
  | "NEX1_ACTIONABLE"      // 🤖 eligible for NEX1 diagnose / propose
  | "RESOLVED";            // ✅ registry status = RESOLVED (real evidence chain)

export const FOUNDER_CLASS_LABEL: Record<FounderClass, string> = {
  REAL_RISK:           "🔴 Real capability risk",
  TEST_EVENT:          "🧪 Adversarial test event",
  SECURITY_ESCALATION: "🛡 Security escalation · founder required",
  WAITING_FOUNDER:     "⏳ Waiting for founder authorization",
  NEX1_ACTIONABLE:     "🤖 NEX1 action available",
  RESOLVED:            "✅ Resolved · evidence verified",
};

// ── Test-namespace detection (shared with API filters) ─────────────────

/**
 * Test-namespace detection. A CAP is a TEST_EVENT if its kind, title,
 * detector agent, or evidence points identify it as a test artefact.
 *
 * Founder-locked: the underlying registry retains every CAP for audit;
 * this classifier only changes the founder-facing tag. False positives
 * are far less dangerous than false negatives — a genuine CAP mistagged
 * as TEST_EVENT is still visible in the full list; a test artefact
 * mistagged as production is what the founder specifically forbade.
 */
export function isTestNamespaceCap(cap: CapabilityGap): boolean {
  const k = (cap.kind ?? "").toLowerCase();
  const t = (cap.title ?? "").toLowerCase();
  const d = (cap.detector_agent_id ?? "").toLowerCase();
  // Kind-based
  if (k.startsWith("test.") || k.startsWith("test-") || k.startsWith("wo02.")) return true;
  if (k === "any.kind") return true;              // legacy adversarial-test placeholder
  if (k.startsWith("workmap.test.")) return true; // W-2 seed of TEST fixture
  // Title-based (exact / narrow matches only · never broad prefixes that could
  // catch a real production CAP that legitimately uses those words)
  if (t === "test" || t.startsWith("test ") || t.startsWith("seed test.")) return true;
  if (t.startsWith("wo02-seed")) return true;
  if (t === "critical test") return true;         // legacy E-2 title
  if (t === "must escalate" || t === "registry tamper" || t === "run") return true;
  // Titles under 8 chars are always test-fixture · real CAPs are descriptive
  if (t.length > 0 && t.length < 8) return true;
  // Distinctive test-fixture markers (uppercase phrases · never appear in production)
  if (t.includes("test-fixture") || t.includes("test-seed") || t.includes("test-namespace")) return true;
  // Legacy N-4/N-6 seed titles pre-dating the marker convention
  if (t.startsWith("genuine · ")) return true;
  if (t.startsWith("live count")) return true;
  if (t === "must escalate" || t === "seed rate_limiter.persistent_backoff") return true;
  if (t === "doctrine echo") return true;
  if (t.startsWith("wo02-seed") || t.startsWith("critical noise")) return true;
  if (t.startsWith("adversarial test event")) return true;
  // Detector agent
  if (d === "test" || d.startsWith("test-") || d.includes("adversarial")) return true;
  return false;
}

// ── Security-escalate-only kinds (mirror resolver.ts doctrine) ─────────

/**
 * CAP kinds that MUST escalate to founder regardless of priority.
 * Mirrors the ESCALATE_ONLY_KINDS set in resolver.ts. Keeping them in
 * sync is a doctrinal invariant — the classifier must treat these as
 * SECURITY_ESCALATION even if their status column has drifted.
 */
export const SECURITY_ESCALATE_ONLY_KINDS: ReadonlySet<string> = new Set([
  "guardian.te.evidence_source_registry_untrusted",
  "guardian.te.evidence_source_test_masquerade",
]);

// ── Classifier ─────────────────────────────────────────────────────────

/**
 * Pure classifier. Same CAP shape → same tag. No side effects.
 * Priority of resolution when multiple flags could apply:
 *   1. RESOLVED (registry status is authoritative)
 *   2. TEST_EVENT (never treat test artefacts as production risks)
 *   3. SECURITY_ESCALATION (either kind is security-escalate-only OR status ESCALATED)
 *   4. WAITING_FOUNDER (status PROPOSED or IN_PROGRESS · proposal exists)
 *   5. NEX1_ACTIONABLE (status OPEN or TRIAGED · eligible for diagnose)
 *   6. REAL_RISK (fallback for any other unresolved genuine CAP)
 */
export function classifyForFounder(cap: CapabilityGap): FounderClass {
  if (cap.status === "RESOLVED") return "RESOLVED";
  if (isTestNamespaceCap(cap)) return "TEST_EVENT";
  if (SECURITY_ESCALATE_ONLY_KINDS.has(cap.kind) || cap.status === "ESCALATED") return "SECURITY_ESCALATION";
  if (cap.status === "PROPOSED" || cap.status === "IN_PROGRESS") return "WAITING_FOUNDER";
  if (cap.status === "OPEN" || cap.status === "TRIAGED") return "NEX1_ACTIONABLE";
  return "REAL_RISK";
}

// ── Founder summary counts ─────────────────────────────────────────────

export interface FounderSummary {
  readonly total: number;
  readonly critical_actions: number;      // priority=CRITICAL AND class=REAL_RISK|NEX1_ACTIONABLE
  readonly high_priority: number;         // priority=HIGH AND (NEX1_ACTIONABLE|REAL_RISK)
  readonly waiting_for_founder: number;   // class=WAITING_FOUNDER
  readonly security_escalations: number;  // class=SECURITY_ESCALATION (excluding TEST_EVENT)
  readonly nex1_actionable: number;       // class=NEX1_ACTIONABLE
  readonly test_events: number;           // class=TEST_EVENT
  readonly resolved: number;              // class=RESOLVED (real evidence)
}

export function summariseForFounder(caps: readonly CapabilityGap[]): FounderSummary {
  const classes = caps.map((c) => ({ cap: c, cls: classifyForFounder(c) }));

  return {
    total: caps.length,
    critical_actions: classes.filter(
      ({ cap, cls }) => cap.priority === "CRITICAL" && (cls === "REAL_RISK" || cls === "NEX1_ACTIONABLE"),
    ).length,
    high_priority: classes.filter(
      ({ cap, cls }) => cap.priority === "HIGH" && (cls === "REAL_RISK" || cls === "NEX1_ACTIONABLE"),
    ).length,
    waiting_for_founder: classes.filter(({ cls }) => cls === "WAITING_FOUNDER").length,
    security_escalations: classes.filter(({ cls }) => cls === "SECURITY_ESCALATION").length,
    nex1_actionable: classes.filter(({ cls }) => cls === "NEX1_ACTIONABLE").length,
    test_events: classes.filter(({ cls }) => cls === "TEST_EVENT").length,
    resolved: classes.filter(({ cls }) => cls === "RESOLVED").length,
  };
}

// ── Recommended next action selector ────────────────────────────────────

export interface RecommendedNextAction {
  readonly kind: "NEX1_DIAGNOSE" | "AWAIT_FOUNDER_SIGNATURE" | "FOUNDER_REVIEW" | "NONE";
  readonly cap_id: string | null;
  readonly cap_kind: string | null;
  readonly cap_category: string | null;
  readonly cap_priority: string | null;
  readonly cap_title: string | null;
  readonly proposed_wo_id: string | null;
  readonly rationale: string;
}

const PRIORITY_ORDER: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

/**
 * Deterministic selector. Same CAP set → same recommendation.
 * Priority order:
 *   1. If any CRITICAL security escalation exists → FOUNDER_REVIEW (that one)
 *   2. Highest-priority CAP in WAITING_FOUNDER → AWAIT_FOUNDER_SIGNATURE (oldest updated)
 *   3. Highest-priority NEX1_ACTIONABLE REAL_RISK CAP → NEX1_DIAGNOSE
 *   4. NONE
 *
 * TEST_EVENT CAPs are never recommended.
 * RESOLVED CAPs are never recommended.
 */
export function recommendNextAction(caps: readonly CapabilityGap[]): RecommendedNextAction {
  const enriched = caps.map((c) => ({ cap: c, cls: classifyForFounder(c) }));

  const cmpPriorityThenAge = (a: CapabilityGap, b: CapabilityGap): number => {
    const p = (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9);
    if (p !== 0) return p;
    return a.detected_at.localeCompare(b.detected_at);
  };

  // 1. Critical security escalations first
  const critEsc = enriched
    .filter(({ cap, cls }) => cls === "SECURITY_ESCALATION" && cap.priority === "CRITICAL")
    .map((e) => e.cap)
    .sort(cmpPriorityThenAge);
  if (critEsc.length > 0) {
    const c = critEsc[0];
    return {
      kind: "FOUNDER_REVIEW", cap_id: c.cap_id, cap_kind: c.kind,
      cap_category: c.category, cap_priority: c.priority, cap_title: c.title,
      proposed_wo_id: c.proposed_wo_id,
      rationale: "CRITICAL security escalation · founder must review · autonomous resolution FORBIDDEN by doctrine",
    };
  }

  // 2. Highest-priority CAP awaiting founder signature
  const waiting = enriched
    .filter(({ cls }) => cls === "WAITING_FOUNDER")
    .map((e) => e.cap)
    .sort(cmpPriorityThenAge);
  if (waiting.length > 0) {
    const c = waiting[0];
    return {
      kind: "AWAIT_FOUNDER_SIGNATURE", cap_id: c.cap_id, cap_kind: c.kind,
      cap_category: c.category, cap_priority: c.priority, cap_title: c.title,
      proposed_wo_id: c.proposed_wo_id,
      rationale: "Proposal drafted · awaiting founder Ed25519 signature before Authority Broker will allow execution",
    };
  }

  // 3. Highest-priority NEX1_ACTIONABLE real risk
  const actionable = enriched
    .filter(({ cls }) => cls === "NEX1_ACTIONABLE")
    .map((e) => e.cap)
    .sort(cmpPriorityThenAge);
  if (actionable.length > 0) {
    const c = actionable[0];
    return {
      kind: "NEX1_DIAGNOSE", cap_id: c.cap_id, cap_kind: c.kind,
      cap_category: c.category, cap_priority: c.priority, cap_title: c.title,
      proposed_wo_id: c.proposed_wo_id,
      rationale: `Highest-priority ${c.priority} NEX1-actionable CAP · ready for deterministic diagnosis + proposal`,
    };
  }

  return {
    kind: "NONE", cap_id: null, cap_kind: null, cap_category: null,
    cap_priority: null, cap_title: null, proposed_wo_id: null,
    rationale: "No actionable production CAPs · registry is clean (excluding test events + resolved CAPs)",
  };
}
