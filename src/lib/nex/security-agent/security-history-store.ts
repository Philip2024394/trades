// src/lib/nex/security-agent/security-history-store.ts
//
// In-memory history of Security Agent inspections. Persists across requests
// in the process · replaced by nex.security_growth_ledger once migration lands.

import type { SecurityDecision } from "./types";

export interface HistoryRow {
  readonly runId: string;
  readonly at: string;
  readonly agentId: string;
  readonly capabilityId: string | null;
  readonly action: string;
  readonly verdict: "ACCEPT" | "REJECT";
  readonly rejectionCodes: readonly string[];
  readonly reason: string | null;
}

class SecurityHistoryStore {
  private rows: HistoryRow[] = [];

  record(decision: SecurityDecision, ctx: { agentId: string; capabilityId: string | null; action: string }): void {
    const row: HistoryRow = {
      runId: decision.runId,
      at: new Date().toISOString(),
      agentId: ctx.agentId,
      capabilityId: ctx.capabilityId,
      action: ctx.action,
      verdict: decision.verdict,
      rejectionCodes: decision.verdict === "REJECT" ? (decision as any).rejectionCodes ?? [] : [],
      reason: decision.verdict === "REJECT" ? ((decision as any).reason ?? null) : null,
    };
    this.rows.unshift(row);
    if (this.rows.length > 200) this.rows = this.rows.slice(0, 200);
  }

  recent(limit = 50): readonly HistoryRow[] {
    return this.rows.slice(0, limit);
  }

  countByVerdict(): { accept: number; reject: number } {
    let accept = 0, reject = 0;
    for (const r of this.rows) {
      if (r.verdict === "ACCEPT") accept++; else reject++;
    }
    return { accept, reject };
  }

  countByCode(): Record<string, number> {
    const map: Record<string, number> = {};
    for (const r of this.rows) {
      for (const c of r.rejectionCodes) map[c] = (map[c] ?? 0) + 1;
    }
    return map;
  }
}

const g = globalThis as unknown as { __nex_security_history?: SecurityHistoryStore };
if (!g.__nex_security_history) g.__nex_security_history = new SecurityHistoryStore();
export const securityHistoryStore: SecurityHistoryStore = g.__nex_security_history;
