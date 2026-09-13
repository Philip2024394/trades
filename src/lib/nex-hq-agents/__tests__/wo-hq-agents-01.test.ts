// WO-HQ-AGENTS-01 · acceptance tests
//
// Adversarial pattern: "secretly try to make this page grant/mutate → refused".
// Plus positive tests verifying the derivation is deterministic and honest.

import { describe, it, expect } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { AGENT_REGISTRY, READABLE_COLLECTIONS } from "../registry";
import { deriveSnapshot } from "../derive-snapshot";
import type { AgentDescriptor } from "../types";
import { COLLECTIONS } from "@/lib/nex/storage/types";

const REPO_ROOT = process.cwd();
const PAGE_FILES = [
  "src/app/nex-head-quarters/agents/page.tsx",
  "src/app/api/nex/hq/agents/route.ts",
  "src/lib/nex-hq-agents/registry.ts",
  "src/lib/nex-hq-agents/derive-snapshot.ts",
  "src/lib/nex-hq-agents/types.ts",
];

async function readAll(): Promise<string> {
  const bufs = await Promise.all(PAGE_FILES.map((f) => fs.readFile(path.join(REPO_ROOT, f), "utf8")));
  return bufs.join("\n\n// FILE BOUNDARY\n\n");
}

// ═════════════════════════════════════════════════════════════════════════
// ADVERSARIAL (§9)
// ═════════════════════════════════════════════════════════════════════════

describe("WO-HQ-AGENTS-01 · adversarial", () => {
  it("A-1 · page and API contain zero getStorage().save calls", async () => {
    const src = await readAll();
    // Grep for any storage save invocation.
    expect(src).not.toMatch(/getStorage\(\)\.save\s*\(/);
    expect(src).not.toMatch(/\.save\s*\(\s*COLLECTIONS\./);
  });

  it("A-2 · page and API contain zero signing helpers", async () => {
    const src = await readAll();
    expect(src).not.toMatch(/signAuthorization/);
    expect(src).not.toMatch(/signCrawlerManifest/);
    expect(src).not.toMatch(/signFounderKeyManifest/);
    // Even inside comments this would be a bad signal; grep is intentional
  });

  it("A-3 · API only reads from allowlisted collections", async () => {
    // Every collection the API attempts to query MUST be in READABLE_COLLECTIONS.
    for (const agent of AGENT_REGISTRY) {
      expect(READABLE_COLLECTIONS).toContain(agent.source_collection);
    }
    // The allowlist itself must not contain any unexpected collection —
    // it is derived from AGENT_REGISTRY.
    for (const c of READABLE_COLLECTIONS) {
      const known = Object.values(COLLECTIONS).includes(c as (typeof COLLECTIONS)[keyof typeof COLLECTIONS]);
      expect(known).toBe(true);
    }
  });

  it("A-4 · mutating HTTP methods return 405", async () => {
    const mod = await import("@/app/api/nex/hq/agents/route");
    for (const method of ["POST", "PUT", "PATCH", "DELETE"] as const) {
      const handler = (mod as unknown as Record<string, () => Promise<Response>>)[method];
      expect(typeof handler).toBe("function");
      const res = await handler();
      expect(res.status).toBe(405);
      const body = await res.json();
      expect(body).toEqual({ error: "method_not_allowed" });
    }
  });

  it("A-5 · zero external LLM SDK imports", async () => {
    const src = await readAll();
    const forbidden = /from\s+["'](openai|@anthropic-ai\/sdk|@anthropic\/sdk|@google\/generative-ai|@google-ai|cohere|@cohere-ai|mistral|@mistralai|@aws-sdk\/client-bedrock)/;
    expect(src).not.toMatch(forbidden);
  });

  it("A-6 · page fetches only same-origin /api/nex/hq/agents", async () => {
    const pageSrc = await fs.readFile(path.join(REPO_ROOT, "src/app/nex-head-quarters/agents/page.tsx"), "utf8");
    // The page's only fetch call points at the local API route
    const fetches = [...pageSrc.matchAll(/fetch\(\s*(["'`])([^"'`]+)\1/g)].map((m) => m[2]);
    for (const url of fetches) {
      expect(url).toBe("/api/nex/hq/agents");
    }
    // No node:http.request / node:https.request / axios / undici anywhere
    expect(pageSrc).not.toMatch(/from\s+["'](axios|undici|node-fetch)/);
    expect(pageSrc).not.toMatch(/node:https?\.request/);
  });

  it("A-7 · route ordering + no auth-bypass patterns", async () => {
    const routeSrc = await fs.readFile(path.join(REPO_ROOT, "src/app/api/nex/hq/agents/route.ts"), "utf8");
    // We don't add our own auth bypass — the existing NEX HQ auth pattern
    // sits at a higher middleware layer. Verify this route does NOT contain
    // any auth-disable shortcut.
    expect(routeSrc).not.toMatch(/SKIP_AUTH|BYPASS_AUTH|DISABLE_AUTH/i);
    expect(routeSrc).not.toMatch(/process\.env\.[A-Z_]*SKIP/);
    expect(routeSrc).not.toMatch(/process\.env\.[A-Z_]*BYPASS/);
  });

  it("A-8 · secret fields are stripped before responding", async () => {
    // Compose a synthetic record containing every "forbidden" field name and
    // verify the scrubber removes them all.
    const routeMod = await import("@/app/api/nex/hq/agents/route");
    // scrubSecrets is not exported; enforce via a full end-to-end assertion.
    // Persist a synthetic knowledge_objects record with signature-like fields.
    const { getStorage } = await import("@/lib/nex/storage/registry");
    const store = getStorage();
    const testId = `hq-test-secret-${Date.now()}`;
    await store.save(COLLECTIONS.nex_intelligence_knowledge_objects, {
      record_type: "NEX_INTELLIGENCE_KNOWLEDGE_OBJECT",
      knowledge_id: testId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      attestation_signature_hex: "SECRETSHOULDBESTRIPPED",
      signature: "ALSOSECRETSHOULDBESTRIPPED",
      raw_content_ref: "inline:base64:MUST_BE_STRIPPED",
      founder_key_id: "FOUNDER_KEY_SHOULD_BE_STRIPPED",
      status: "PROPOSED",
    });
    try {
      // Import the route and call GET() directly (no HTTP round-trip needed).
      const getHandler = (routeMod as unknown as { GET: () => Promise<Response> }).GET;
      const res = await getHandler();
      const body = JSON.stringify(await res.json());
      expect(body).not.toContain("SECRETSHOULDBESTRIPPED");
      expect(body).not.toContain("ALSOSECRETSHOULDBESTRIPPED");
      expect(body).not.toContain("MUST_BE_STRIPPED");
      expect(body).not.toContain("FOUNDER_KEY_SHOULD_BE_STRIPPED");
    } finally {
      // Cleanup: overwrite the file to not leak the synthetic record
      try {
        await fs.unlink(path.join(REPO_ROOT, "data/nex-storage/nex_intelligence_knowledge_objects.jsonl"));
      } catch { /* ok */ }
    }
  }, 15_000);
});

// ═════════════════════════════════════════════════════════════════════════
// POSITIVE / PROPERTY
// ═════════════════════════════════════════════════════════════════════════

describe("WO-HQ-AGENTS-01 · positive / property", () => {
  const testAgent: AgentDescriptor = {
    id: "test-agent",
    name: "Test Agent",
    kind: "author-stage",
    lane: "orchestrator",
    source_collection: "test-collection",
    wire_downstream: [],
  };

  it("P-1 · empty collection produces WAITING + grey health", () => {
    const now = new Date();
    const snap = deriveSnapshot({ agent: testAgent, records: [], now });
    expect(snap.state).toBe("WAITING");
    expect(snap.health).toBe("grey");
    expect(snap.total_records_observed).toBe(0);
    expect(snap.last_activity_at).toBeNull();
    expect(snap.non_normal_state).toBeNull();
  });

  it("P-2 · recent SUCCESS record produces WORKING (orchestrator) or RESEARCHING (intelligence)", () => {
    const now = new Date();
    const recent = new Date(now.getTime() - 5000).toISOString();
    const record = {
      record_type: "NEX1_BUILD_REPORT",
      report_id: "rep-1",
      started_at: recent,
      exit_code: 0,
    };
    const orchSnap = deriveSnapshot({ agent: { ...testAgent, lane: "orchestrator" }, records: [record], now });
    expect(orchSnap.state).toBe("WORKING");
    expect(orchSnap.health).toBe("green");
    expect(orchSnap.last_activity_at).toBe(recent);
    expect(orchSnap.last_successful_task?.record_id).toBe("rep-1");

    const intelSnap = deriveSnapshot({ agent: { ...testAgent, lane: "intelligence" }, records: [record], now });
    expect(intelSnap.state).toBe("RESEARCHING");
  });

  it("P-3 · deterministic snapshot — same records + same now → identical result (by shape)", () => {
    const now = new Date("2026-09-13T12:00:00Z");
    const records = [
      { record_type: "NEX1_BUILD_REPORT", report_id: "b1", started_at: "2026-09-13T11:00:00Z", exit_code: 0 },
      { record_type: "NEX1_BUILD_REPORT", report_id: "b2", started_at: "2026-09-13T10:00:00Z", exit_code: 0 },
    ];
    const s1 = deriveSnapshot({ agent: testAgent, records, now });
    const s2 = deriveSnapshot({ agent: testAgent, records, now });
    expect(s1).toEqual(s2);
  });

  it("mixed recent SUCCESS+FAIL produces DEGRADED", () => {
    const now = new Date();
    const succ = { record_type: "NEX1_BUILD_REPORT", report_id: "s1", started_at: new Date(now.getTime() - 3600_000).toISOString(), exit_code: 0 };
    const fail = { record_type: "NEX1_BUILD_REPORT", report_id: "f1", started_at: new Date(now.getTime() - 7200_000).toISOString(), exit_code: 1 };
    const snap = deriveSnapshot({ agent: testAgent, records: [succ, fail], now });
    expect(snap.state).toBe("DEGRADED");
    expect(snap.health).toBe("amber");
    expect(snap.non_normal_state).not.toBeNull();
    expect(snap.non_normal_state?.reason).toMatch(/failure.*success|intermittent/i);
  });

  it("only-fail-in-24h produces FAILED with recovery path", () => {
    const now = new Date();
    const fail = { record_type: "NEX1_BUILD_REPORT", report_id: "f1", started_at: new Date(now.getTime() - 3600_000).toISOString(), exit_code: 1 };
    const snap = deriveSnapshot({ agent: testAgent, records: [fail], now });
    expect(snap.state).toBe("FAILED");
    expect(snap.health).toBe("red");
    expect(snap.non_normal_state?.recovery_path).toBeTruthy();
  });

  it("agent registry contains 14 named agents in two lanes", () => {
    expect(AGENT_REGISTRY.length).toBe(14);
    expect(AGENT_REGISTRY.filter((a) => a.lane === "orchestrator").length).toBe(8);
    expect(AGENT_REGISTRY.filter((a) => a.lane === "intelligence").length).toBe(6);
  });
});
