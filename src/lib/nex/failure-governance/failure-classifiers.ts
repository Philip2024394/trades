// src/lib/nex/failure-governance/failure-classifiers.ts
//
// UWI · Wave 6 · M25 · Failure classification helpers
// Founder-authorised programme.
//
// Deterministic classifiers that map raw failure signals into typed
// enums. Two separate classifier functions — one per taxonomy — to
// enforce Rule 5k at the API surface.

import type {
  DurabilityFailureMode,
  DurabilityFailureEvent,
  ResearchFailureClass,
  ResearchFailureEvent,
} from "./types";

// ═══ Durability classifier ══════════════════════════════════════════
export interface DurabilityFailureSignal {
  readonly kind: "exception" | "http_status" | "signal" | "explicit";
  readonly message?: string;
  readonly http_status?: number;
  readonly signal_name?: string;
  readonly explicit_mode?: DurabilityFailureMode;
}

/** Classify a raw durability signal into one of the 20 modes. Deterministic. */
export function classifyDurabilityFailure(sig: DurabilityFailureSignal): DurabilityFailureMode {
  if (sig.kind === "explicit" && sig.explicit_mode) return sig.explicit_mode;

  if (sig.kind === "http_status" && typeof sig.http_status === "number") {
    if (sig.http_status === 429) return "quota_exhausted";
    if (sig.http_status === 401 || sig.http_status === 403) return "authentication_expired";
    if (sig.http_status >= 500) return "downstream_unavailable";
    if (sig.http_status === 408) return "lock_timeout";
    return "unknown";
  }

  if (sig.kind === "signal" && sig.signal_name) {
    const s = sig.signal_name.toUpperCase();
    if (s === "SIGKILL" || s === "SIGTERM" || s === "SIGINT") return "worker_crash";
    if (s.includes("OOM") || s === "SIGBUS") return "out_of_memory";
    return "unknown";
  }

  if (sig.kind === "exception" && sig.message) {
    const m = sig.message.toLowerCase();
    if (/timeout/.test(m)) return "lock_timeout";
    if (/deadlock/.test(m)) return "deadlock";
    if (/oom|out of memory|heap/.test(m)) return "out_of_memory";
    if (/disk full|enospc|no space left/.test(m)) return "disk_full";
    if (/econnrefused|econnreset|network|eai_again/.test(m)) return "network_partition";
    if (/idempot/.test(m)) return "idempotency_key_collision";
    if (/schema|migration/.test(m)) return "schema_migration_mid_flight";
    if (/backlog|full queue|reject/.test(m)) return "queue_backlog";
    if (/lag/.test(m)) return "consumer_lag";
    if (/poison|malformed message/.test(m)) return "poison_message";
    if (/clock|skew/.test(m)) return "clock_skew";
    if (/replay diverg/.test(m)) return "replay_divergence";
    if (/config drift|config.*chang/.test(m)) return "configuration_drift";
    if (/version mismatch|peer dep/.test(m)) return "dependency_version_mismatch";
    if (/authentication|token expired|401|403/.test(m)) return "authentication_expired";
    if (/quota|rate limit|429/.test(m)) return "quota_exhausted";
    if (/downstream|dependency|upstream/.test(m)) return "downstream_unavailable";
    if (/worker.*(crash|die|kill|restart|exit)/.test(m)) return "worker_crash";
    if (/machine.*restart|host reboot/.test(m)) return "machine_restart";
    return "unknown";
  }

  return "unknown";
}

export function makeDurabilityFailureEvent(input: {
  signal: DurabilityFailureSignal;
  at_iso?: string;
  worker_id?: string | null;
  job_id?: string | null;
  detail: string;
  context?: Record<string, unknown>;
}): DurabilityFailureEvent {
  return {
    layer: "durability",
    failure_mode: classifyDurabilityFailure(input.signal),
    at_iso: input.at_iso ?? new Date().toISOString(),
    worker_id: input.worker_id ?? null,
    job_id: input.job_id ?? null,
    detail: input.detail,
    context: input.context ?? {},
  };
}

// ═══ Research classifier ═══════════════════════════════════════════
export interface ResearchFailureSignal {
  readonly kind: "no_sources_matched" | "source_5xx" | "robots_disallow" | "insufficient" | "conflicting" | "stale" | "duplicate" | "malformed" | "timeout" | "quota" | "worker" | "infrastructure" | "explicit";
  readonly detail?: string;
  readonly explicit_class?: ResearchFailureClass;
}

/** Classify a research signal into one of the 13 classes. Deterministic. */
export function classifyResearchFailure(sig: ResearchFailureSignal): ResearchFailureClass {
  if (sig.kind === "explicit" && sig.explicit_class) return sig.explicit_class;
  switch (sig.kind) {
    case "no_sources_matched": return "no_sources";
    case "source_5xx":         return "source_unavailable";
    case "robots_disallow":    return "crawl_blocked";
    case "insufficient":       return "insufficient_evidence";
    case "conflicting":        return "conflicting_evidence";
    case "stale":              return "stale_evidence";
    case "duplicate":          return "duplicate_evidence";
    case "malformed":          return "malformed_source";
    case "timeout":            return "research_timeout";
    case "quota":              return "quota_exhausted";
    case "worker":             return "worker_failure";
    case "infrastructure":     return "infrastructure_failure";
    default:                   return "unclassified";
  }
}

export function makeResearchFailureEvent(input: {
  signal: ResearchFailureSignal;
  at_iso?: string;
  workflow_id?: string | null;
  source?: string | null;
  source_class?: string | null;
  opportunity_id?: string | null;
  detail: string;
  context?: Record<string, unknown>;
}): ResearchFailureEvent {
  return {
    layer: "research",
    failure_class: classifyResearchFailure(input.signal),
    at_iso: input.at_iso ?? new Date().toISOString(),
    workflow_id: input.workflow_id ?? null,
    source: input.source ?? null,
    source_class: input.source_class ?? null,
    opportunity_id: input.opportunity_id ?? null,
    detail: input.detail,
    context: input.context ?? {},
  };
}
