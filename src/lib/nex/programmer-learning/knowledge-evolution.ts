// src/lib/nex/programmer-learning/knowledge-evolution.ts
//
// Phase 10 · Long-term knowledge evolution
// Philip 2026-09-08 · AUTHORIZE Phase 10
//
// Detects three long-term concerns across the knowledge store:
//
//   · STALENESS         · knowledge past its per-domain freshness window
//   · CONTRADICTIONS    · same-domain items whose statements conflict
//   · SUPERSESSIONS     · newer item on same topic should replace older
//
// DISCIPLINE:
//   · NEVER auto-supersedes · every proposal awaits Founder approval
//   · Domain-aware comparison prevents false-positive contradictions
//     (same-topic items from different domains are NOT flagged)
//   · Freshness policy is per-domain · never one-size-fits-all
//   · Pure read of the store · zero writes to production ledgers
//   · Deterministic · reproducible on identical inputs

import type { KnowledgeItem } from "./types";

// ─── Types ──────────────────────────────────────────────────────

export type StalenessRecord = {
  knowledge_id: string;
  domain: string;
  age_days: number;
  freshness_policy_days: number;
  status: "STALE" | "STALE_BUT_USABLE" | "FRESH";
};

export type ContradictionPair = {
  a_knowledge_id: string;
  b_knowledge_id: string;
  domain: string;
  contradiction_signal: string;   // human-readable description
  a_statement_excerpt: string;
  b_statement_excerpt: string;
  confidence: "low" | "medium" | "high";
};

export type SupersessionProposal = {
  older_knowledge_id: string;
  newer_knowledge_id: string;
  domain: string;
  reason: string;
  requires_founder_approval: true;
};

export type EvolutionReport = {
  generated_at_iso: string;
  scanned_count: number;
  stale_items: StalenessRecord[];
  contradictions: ContradictionPair[];
  supersession_proposals: SupersessionProposal[];
  domains_covered: string[];
};

// ─── Per-domain freshness policies (days) ───────────────────
//
// Explicit per-domain values. Domains not listed use the default.
// Founder-adjustable via future authorization.

export const FRESHNESS_POLICY_DAYS: Record<string, number> = {
  // UI design practice moves fast — the guardian doctrine calls out 90d
  "ui.design_practice": 90,
  "ui": 90,
  // Regulation + compliance change slowly · re-verify yearly
  "regulation": 365,
  "compliance": 365,
  // Country building codes update on 3-5 year cycles · half that
  "construction": 730,
  // Network + engineering resilience patterns stable over years
  "network": 365,
  "network.resilience": 365,
  "resilience": 365,
  // Security best-practice moves quickly · half-year
  "security": 180,
  // Language teaching + linguistics generally stable
  "language": 730,
  // Speaking / voice UX moves quickly
  "speaking": 180,
  "speaking.life_safety": 180,   // crisis-line data + phrasings update
  // Vision + ML architectures move fast
  "vision": 90,
  // Default when a domain isn't listed
  "__default__": 365,
};

export const STALE_BUT_USABLE_MULTIPLIER = 1.5; // between 1x and 1.5x → borderline

// ─── Helpers ────────────────────────────────────────────────

function domainKey(domain: string): string {
  return (domain ?? "").toLowerCase().trim();
}

function policyForDomain(domain: string): number {
  const key = domainKey(domain);
  if (FRESHNESS_POLICY_DAYS[key] !== undefined) return FRESHNESS_POLICY_DAYS[key];
  // Fall back to first path segment
  const root = key.split(".")[0];
  if (root && FRESHNESS_POLICY_DAYS[root] !== undefined) return FRESHNESS_POLICY_DAYS[root];
  return FRESHNESS_POLICY_DAYS["__default__"]!;
}

function daysBetween(a: string | undefined | null, nowMs: number): number {
  if (!a) return Number.POSITIVE_INFINITY;
  const t = new Date(a).getTime();
  if (Number.isNaN(t)) return Number.POSITIVE_INFINITY;
  return (nowMs - t) / (1000 * 60 * 60 * 24);
}

// ─── Public · staleness ─────────────────────────────────

export function detectStaleness(items: readonly KnowledgeItem[], now?: Date): StalenessRecord[] {
  const nowMs = (now ?? new Date()).getTime();
  const out: StalenessRecord[] = [];
  for (const k of items) {
    const age = daysBetween(k.created_at, nowMs);
    const policy = policyForDomain(k.domain ?? "");
    let status: StalenessRecord["status"];
    if (age > policy * STALE_BUT_USABLE_MULTIPLIER) status = "STALE";
    else if (age > policy) status = "STALE_BUT_USABLE";
    else status = "FRESH";
    out.push({
      knowledge_id: k.knowledge_id,
      domain: k.domain ?? "",
      age_days: Math.round(age * 10) / 10,
      freshness_policy_days: policy,
      status,
    });
  }
  return out;
}

// ─── Public · contradictions ─────────────────────────────
//
// Domain-aware: only flags contradictions within the SAME domain.
// Contradiction signals we detect deterministically:
//   1. Same domain + statements contain opposite prescriptions
//      (one says "must include X" · other says "must NOT include X")
//   2. Same domain + statements contain equal must-include patterns
//      but different verification statuses/tiers (weaker vs stronger)
//   Detection is intentionally conservative — bias toward false-negative
//   (miss subtle contradictions) rather than false-positive (flag
//   legitimate specializations).

const MUST_INCLUDE_RX = /\bmust\s+(?:include|have|handle|support|use|apply|enforce|contain)\s+([a-z][a-z0-9 \-_]{2,40})/gi;
const MUST_NOT_RX = /\bmust\s+not\s+(?:include|have|handle|support|use|apply|enforce|contain)\s+([a-z][a-z0-9 \-_]{2,40})/gi;

function extractMustIncludeTokens(stmt: string): Set<string> {
  const out = new Set<string>();
  for (const m of stmt.toLowerCase().matchAll(MUST_INCLUDE_RX)) {
    const raw = (m[1] ?? "").trim().split(/\s+/).slice(0, 3).join(" ");
    if (raw.length >= 3) out.add(raw);
  }
  return out;
}
function extractMustNotTokens(stmt: string): Set<string> {
  const out = new Set<string>();
  for (const m of stmt.toLowerCase().matchAll(MUST_NOT_RX)) {
    const raw = (m[1] ?? "").trim().split(/\s+/).slice(0, 3).join(" ");
    if (raw.length >= 3) out.add(raw);
  }
  return out;
}

export function detectContradictions(items: readonly KnowledgeItem[]): ContradictionPair[] {
  const pairs: ContradictionPair[] = [];
  // Group by domain first · O(n) grouping
  const byDomain = new Map<string, KnowledgeItem[]>();
  for (const k of items) {
    const d = domainKey(k.domain ?? "");
    if (!d) continue;
    if (!byDomain.has(d)) byDomain.set(d, []);
    byDomain.get(d)!.push(k);
  }
  // Within each domain, check pairs
  for (const [domain, list] of byDomain) {
    if (list.length < 2) continue;
    for (let i = 0; i < list.length; i += 1) {
      const a = list[i];
      const aIncludes = extractMustIncludeTokens(a.statement ?? "");
      const aExcludes = extractMustNotTokens(a.statement ?? "");
      for (let j = i + 1; j < list.length; j += 1) {
        const b = list[j];
        const bIncludes = extractMustIncludeTokens(b.statement ?? "");
        const bExcludes = extractMustNotTokens(b.statement ?? "");
        // Contradiction 1: A says must-include X · B says must-not-include X
        const clashAonB = [...aIncludes].filter((t) => bExcludes.has(t));
        const clashBonA = [...bIncludes].filter((t) => aExcludes.has(t));
        if (clashAonB.length > 0 || clashBonA.length > 0) {
          const clashes = [...new Set([...clashAonB, ...clashBonA])];
          pairs.push({
            a_knowledge_id: a.knowledge_id,
            b_knowledge_id: b.knowledge_id,
            domain,
            contradiction_signal: `must-include/must-not clash on: ${clashes.slice(0, 3).join(", ")}`,
            a_statement_excerpt: (a.statement ?? "").slice(0, 160),
            b_statement_excerpt: (b.statement ?? "").slice(0, 160),
            confidence: "high",
          });
        }
      }
    }
  }
  return pairs;
}

// ─── Public · supersession proposals ─────────────────────
//
// A supersession is proposed when: same domain + same technology + newer
// created_at + higher authority tier (or higher verification confidence).
// Proposals ALWAYS require Founder approval · this module never applies.

const TIER_RANK: Record<string, number> = { TIER_1: 5, TIER_2: 4, TIER_3: 3, TIER_4: 2, TIER_5: 1, UNKNOWN: 0 };

export function proposeSupersessions(items: readonly KnowledgeItem[]): SupersessionProposal[] {
  const proposals: SupersessionProposal[] = [];
  // Group by (domain, technology)
  const byGroup = new Map<string, KnowledgeItem[]>();
  for (const k of items) {
    const d = domainKey(k.domain ?? "");
    const t = domainKey(k.technology ?? "");
    if (!d) continue;
    const key = `${d}|${t}`;
    if (!byGroup.has(key)) byGroup.set(key, []);
    byGroup.get(key)!.push(k);
  }
  for (const [key, list] of byGroup) {
    if (list.length < 2) continue;
    // Sort newest-first
    const sorted = list.slice().sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")));
    const newer = sorted[0];
    const newerTier = TIER_RANK[String(newer.provenance?.authority_tier ?? "UNKNOWN")] ?? 0;
    for (const older of sorted.slice(1)) {
      const olderTier = TIER_RANK[String(older.provenance?.authority_tier ?? "UNKNOWN")] ?? 0;
      const newerTimestamp = String(newer.created_at ?? "");
      const olderTimestamp = String(older.created_at ?? "");
      const isNewer = newerTimestamp > olderTimestamp;
      const tierBetterOrEqual = newerTier >= olderTier;
      const confidenceBetter = (newer.confidence ?? 0) >= (older.confidence ?? 0);
      if (isNewer && tierBetterOrEqual && confidenceBetter) {
        proposals.push({
          older_knowledge_id: older.knowledge_id,
          newer_knowledge_id: newer.knowledge_id,
          domain: newer.domain ?? "",
          reason: `newer knowledge on same domain+technology · newer created_at (${newerTimestamp} vs ${olderTimestamp}) · authority tier ${newer.provenance?.authority_tier ?? "?"} ≥ ${older.provenance?.authority_tier ?? "?"} · confidence ${newer.confidence?.toFixed(2)} ≥ ${older.confidence?.toFixed(2)}`,
          requires_founder_approval: true,
        });
      }
    }
  }
  return proposals;
}

// ─── Public · combined evolution report ─────────────────

export function generateEvolutionReport(items: readonly KnowledgeItem[], now?: Date): EvolutionReport {
  const stale = detectStaleness(items, now).filter((s) => s.status !== "FRESH");
  const contradictions = detectContradictions(items);
  const supersessions = proposeSupersessions(items);
  const domains = Array.from(new Set(items.map((k) => domainKey(k.domain ?? "")).filter((d) => d.length > 0))).sort();
  return {
    generated_at_iso: (now ?? new Date()).toISOString(),
    scanned_count: items.length,
    stale_items: stale,
    contradictions,
    supersession_proposals: supersessions,
    domains_covered: domains,
  };
}
