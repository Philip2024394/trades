// src/lib/nex/marketing/deliverability/__tests__/readiness.test.ts
//
// NEX Deliverability · Sending-safety chain readiness acceptance
// Founder-authorised programme · Session-9 · Part 13b/c · 2026-09-21.

import { describe, it, expect } from "vitest";
import type { PoolClient, QueryResult } from "pg";
import {
  generateSendingSafetyReadinessReport,
  readVerifierReadinessFromEnv,
  readActivationGatesFromEnv,
  WEBHOOK_SECRET_ENV_KEYS,
  _READINESS_READ_ONLY,
  _READINESS_NEVER_LEAKS_SECRETS,
  _READINESS_NEVER_RETURNS_ADDRESSES,
} from "..";

// ─── SQL-faithful in-memory mock ────────────────────────────────────
function makeMock(opts: {
  migration_applied?: boolean;
  bounce_log_total?: number;
  bounce_log_last_24h?: number;
  reputation_total?: number;
  reputation_fresh?: number;
  domain_auth_total?: number;
  domain_auth_aligned?: number;
  fail_reputation?: boolean;
  fail_domain_auth?: boolean;
} = {}) {
  const state = {
    migration_applied: opts.migration_applied ?? true,
    bounce_log_total: opts.bounce_log_total ?? 0,
    bounce_log_last_24h: opts.bounce_log_last_24h ?? 0,
    reputation_total: opts.reputation_total ?? 0,
    reputation_fresh: opts.reputation_fresh ?? 0,
    domain_auth_total: opts.domain_auth_total ?? 0,
    domain_auth_aligned: opts.domain_auth_aligned ?? 0,
  };
  const client: PoolClient = {
    async query(sql: string): Promise<QueryResult<any>> {
      const norm = sql.replace(/\s+/g, " ").trim();
      if (/information_schema\.columns/i.test(norm) && /event_fingerprint/i.test(norm)) {
        return { rows: [{ has: state.migration_applied }], rowCount: 1, command: "", oid: 0, fields: [] };
      }
      if (/FROM nex\.marketing_bounce_log/i.test(norm)) {
        return { rows: [{ total: String(state.bounce_log_total), last_24h: String(state.bounce_log_last_24h) }], rowCount: 1, command: "", oid: 0, fields: [] };
      }
      if (/FROM nex\.marketing_sender_reputation/i.test(norm)) {
        if (opts.fail_reputation) throw new Error("relation nex.marketing_sender_reputation does not exist");
        return { rows: [{ total: String(state.reputation_total), fresh: String(state.reputation_fresh) }], rowCount: 1, command: "", oid: 0, fields: [] };
      }
      if (/FROM nex\.marketing_sender_domain_auth/i.test(norm)) {
        if (opts.fail_domain_auth) throw new Error("relation nex.marketing_sender_domain_auth does not exist");
        return { rows: [{ total: String(state.domain_auth_total), aligned: String(state.domain_auth_aligned) }], rowCount: 1, command: "", oid: 0, fields: [] };
      }
      throw new Error(`readiness mock · unhandled SQL: ${norm.slice(0, 120)}`);
    },
    release() {},
  } as unknown as PoolClient;
  return { client };
}

// ═══════════════════════════════════════════════════════════════════
// A · Verifier env readiness
// ═══════════════════════════════════════════════════════════════════
describe("Readiness · (A) verifier env presence", () => {
  it("(A1) all providers dormant when env is empty", () => {
    const v = readVerifierReadinessFromEnv({} as NodeJS.ProcessEnv);
    expect(v.every(x => x.state === "dormant")).toBe(true);
    expect(v.every(x => x.secret_configured === false)).toBe(true);
  });
  it("(A2) presence flag flips to ready when env var set · never leaks value", () => {
    const env = { [WEBHOOK_SECRET_ENV_KEYS.resend]: "supersecret_shhh" } as NodeJS.ProcessEnv;
    const v = readVerifierReadinessFromEnv(env);
    const resend = v.find(x => x.provider === "resend")!;
    expect(resend.secret_configured).toBe(true);
    expect(resend.state).toBe("ready");
    expect(JSON.stringify(v)).not.toContain("supersecret_shhh");
  });
  it("(A3) empty-string env var still dormant (not truly configured)", () => {
    const env = { [WEBHOOK_SECRET_ENV_KEYS.postmark]: "" } as NodeJS.ProcessEnv;
    const v = readVerifierReadinessFromEnv(env);
    const postmark = v.find(x => x.provider === "postmark")!;
    expect(postmark.secret_configured).toBe(false);
    expect(postmark.state).toBe("dormant");
  });
});

// ═══════════════════════════════════════════════════════════════════
// B · Activation gates env readiness
// ═══════════════════════════════════════════════════════════════════
describe("Readiness · (B) activation gates", () => {
  it("(B1) all four gates off by default", () => {
    const g = readActivationGatesFromEnv({} as NodeJS.ProcessEnv);
    expect(g.production_page_fetcher).toBe(false);
    expect(g.continuous_cron).toBe(false);
    expect(g.production_domain_auth_checker).toBe(false);
    expect(g.webhook_endpoint_activation).toBe(false);
  });
  it("(B2) gate flips true ONLY when env is exactly 'on'", () => {
    const g = readActivationGatesFromEnv({
      NEX_PAGE_FETCHER_ACTIVATION: "on",
      NEX_DISCOVERY_CRON_ACTIVATION: "true", // NOT 'on' · must stay false
      NEX_DOMAIN_AUTH_CHECKER_ACTIVATION: "1", // NOT 'on'
      NEX_WEBHOOK_ENDPOINTS_ACTIVATION: "yes", // NOT 'on'
    } as any);
    expect(g.production_page_fetcher).toBe(true);
    expect(g.continuous_cron).toBe(false);
    expect(g.production_domain_auth_checker).toBe(false);
    expect(g.webhook_endpoint_activation).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// C · Recorder readiness
// ═══════════════════════════════════════════════════════════════════
describe("Readiness · (C) recorder", () => {
  it("(C1) migration applied · zero events → ready with counts", async () => {
    const m = makeMock({ migration_applied: true });
    const r = await generateSendingSafetyReadinessReport(m.client, {} as NodeJS.ProcessEnv);
    expect(r.recorder.state).toBe("ready");
    expect(r.recorder.bounce_log_migration_applied).toBe(true);
    expect(r.recorder.total_recorded_events).toBe(0);
  });
  it("(C2) migration NOT applied → state=missing", async () => {
    const m = makeMock({ migration_applied: false });
    const r = await generateSendingSafetyReadinessReport(m.client, {} as NodeJS.ProcessEnv);
    expect(r.recorder.state).toBe("missing");
    expect(r.recorder.bounce_log_migration_applied).toBe(false);
  });
  it("(C3) events counted correctly", async () => {
    const m = makeMock({ migration_applied: true, bounce_log_total: 42, bounce_log_last_24h: 5 });
    const r = await generateSendingSafetyReadinessReport(m.client, {} as NodeJS.ProcessEnv);
    expect(r.recorder.total_recorded_events).toBe(42);
    expect(r.recorder.recorded_last_24h).toBe(5);
  });
});

// ═══════════════════════════════════════════════════════════════════
// D · Reputation readiness
// ═══════════════════════════════════════════════════════════════════
describe("Readiness · (D) reputation", () => {
  it("(D1) zero senders → dormant", async () => {
    const m = makeMock();
    const r = await generateSendingSafetyReadinessReport(m.client, {} as NodeJS.ProcessEnv);
    expect(r.reputation.state).toBe("dormant");
  });
  it("(D2) senders with fresh computes → ready", async () => {
    const m = makeMock({ reputation_total: 3, reputation_fresh: 2 });
    const r = await generateSendingSafetyReadinessReport(m.client, {} as NodeJS.ProcessEnv);
    expect(r.reputation.state).toBe("ready");
    expect(r.reputation.senders_with_reputation).toBe(3);
    expect(r.reputation.senders_computed_within_24h).toBe(2);
  });
  it("(D3) senders but stale computes → dormant", async () => {
    const m = makeMock({ reputation_total: 3, reputation_fresh: 0 });
    const r = await generateSendingSafetyReadinessReport(m.client, {} as NodeJS.ProcessEnv);
    expect(r.reputation.state).toBe("dormant");
  });
  it("(D4) reputation table missing → state=missing (soft)", async () => {
    const m = makeMock({ fail_reputation: true });
    const r = await generateSendingSafetyReadinessReport(m.client, {} as NodeJS.ProcessEnv);
    expect(r.reputation.state).toBe("missing");
  });
});

// ═══════════════════════════════════════════════════════════════════
// E · Domain auth readiness
// ═══════════════════════════════════════════════════════════════════
describe("Readiness · (E) domain auth", () => {
  it("(E1) zero domains → dormant", async () => {
    const m = makeMock();
    const r = await generateSendingSafetyReadinessReport(m.client, {} as NodeJS.ProcessEnv);
    expect(r.domain_auth.state).toBe("dormant");
  });
  it("(E2) domains tracked → ready + alignment count", async () => {
    const m = makeMock({ domain_auth_total: 5, domain_auth_aligned: 3 });
    const r = await generateSendingSafetyReadinessReport(m.client, {} as NodeJS.ProcessEnv);
    expect(r.domain_auth.state).toBe("ready");
    expect(r.domain_auth.domains_tracked).toBe(5);
    expect(r.domain_auth.domains_aligned).toBe(3);
  });
  it("(E3) table missing → state=missing", async () => {
    const m = makeMock({ fail_domain_auth: true });
    const r = await generateSendingSafetyReadinessReport(m.client, {} as NodeJS.ProcessEnv);
    expect(r.domain_auth.state).toBe("missing");
  });
});

// ═══════════════════════════════════════════════════════════════════
// F · Overall roll-up + summary line
// ═══════════════════════════════════════════════════════════════════
describe("Readiness · (F) overall roll-up", () => {
  it("(F1) any layer missing → overall=missing", async () => {
    const m = makeMock({ migration_applied: false });
    const r = await generateSendingSafetyReadinessReport(m.client, {} as NodeJS.ProcessEnv);
    expect(r.overall_state).toBe("missing");
    expect(r.summary_line).toContain("not yet migrated");
  });
  it("(F2) all layers dormant (no data yet) → overall=dormant · MACHINERY UNDER TEST language", async () => {
    const m = makeMock({ migration_applied: true });
    const r = await generateSendingSafetyReadinessReport(m.client, {} as NodeJS.ProcessEnv);
    expect(r.overall_state).toBe("dormant");
    expect(r.summary_line).toContain("proven under test");
    expect(r.summary_line).toContain("not yet running against the world");
  });
  it("(F3) all layers ready + all verifiers configured → overall=ready", async () => {
    const m = makeMock({
      migration_applied: true, bounce_log_total: 1, bounce_log_last_24h: 1,
      reputation_total: 1, reputation_fresh: 1,
      domain_auth_total: 1, domain_auth_aligned: 1,
    });
    const env: any = {};
    for (const p of Object.values(WEBHOOK_SECRET_ENV_KEYS)) env[p] = "configured";
    const r = await generateSendingSafetyReadinessReport(m.client, env);
    expect(r.overall_state).toBe("ready");
    expect(r.summary_line).toContain("FULLY READY");
  });
  it("(F4) summary reports gate count · off by default", async () => {
    const m = makeMock({ migration_applied: true });
    const r = await generateSendingSafetyReadinessReport(m.client, {} as NodeJS.ProcessEnv);
    expect(r.summary_line).toContain("0/4 Founder-controlled activation gates on");
  });
  it("(F5) partial gate activation reflected in summary", async () => {
    const m = makeMock({ migration_applied: true });
    const env: any = { NEX_PAGE_FETCHER_ACTIVATION: "on", NEX_WEBHOOK_ENDPOINTS_ACTIVATION: "on" };
    const r = await generateSendingSafetyReadinessReport(m.client, env);
    expect(r.summary_line).toContain("2/4 Founder-controlled activation gates on");
  });
});

// ═══════════════════════════════════════════════════════════════════
// G · Governance canaries
// ═══════════════════════════════════════════════════════════════════
describe("Readiness · (G) governance canaries", () => {
  it("(G1) boundary markers exported", () => {
    expect(_READINESS_READ_ONLY).toContain("never_writes");
    expect(_READINESS_NEVER_LEAKS_SECRETS).toContain("presence_flag_only");
    expect(_READINESS_NEVER_RETURNS_ADDRESSES).toContain("aggregate_counts_only");
  });
  it("(G2) module exports NO mutating function · no activate/enable/setSecret/writeReport", async () => {
    const mod = await import("..");
    expect((mod as any).activateWebhooks).toBeUndefined();
    expect((mod as any).activateGate).toBeUndefined();
    expect((mod as any).enableProvider).toBeUndefined();
    expect((mod as any).setWebhookSecret).toBeUndefined();
    expect((mod as any).writeReadinessReport).toBeUndefined();
  });
  it("(G3) report body contains ZERO email local-parts · zero @ characters", async () => {
    const m = makeMock({ migration_applied: true, bounce_log_total: 10, bounce_log_last_24h: 3 });
    const r = await generateSendingSafetyReadinessReport(m.client, {} as NodeJS.ProcessEnv);
    const body = JSON.stringify(r);
    // aggregate counts + state strings only · no email data present in report body
    expect(body).not.toMatch(/[a-z0-9._-]+@[a-z0-9.-]+/i);
  });
  it("(G4) secret value never appears anywhere in the report", async () => {
    const m = makeMock({ migration_applied: true });
    const env: any = { [WEBHOOK_SECRET_ENV_KEYS.resend]: "hunter2_do_not_leak" };
    const r = await generateSendingSafetyReadinessReport(m.client, env);
    const body = JSON.stringify(r);
    expect(body).not.toContain("hunter2_do_not_leak");
  });
  it("(G5) report includes generated_at timestamp · ISO-8601 shape", async () => {
    const m = makeMock({ migration_applied: true });
    const r = await generateSendingSafetyReadinessReport(m.client, {} as NodeJS.ProcessEnv);
    expect(r.generated_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });
});
