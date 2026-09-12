// src/lib/nex/lab/internet-gate.ts
//
// Founder rule (ADR-0304 §7):
// "Lab agents work INDEPENDENT of Claude or paid internet AI."
//
// This module blocks any Lab code path from reaching external LLM APIs
// or paid third-party services. It runs as a callable guard — every
// Lab agent that would make an outbound HTTP call must first pass its
// URL through `assertLabAllowed(url)`.
//
// Lab agents ARE allowed:
//   · localhost:11434  → Ollama (local LLM)
//   · localhost:5433   → Local Postgres
//   · localhost:9000   → MinIO S3
//   · localhost:8888   → SearXNG (self-hosted search)
//   · nominatim.openstreetmap.org  → free geocoder (ODbL)
//   · overpass-api.de              → free OSM query API
//   · query.wikidata.org           → free SPARQL endpoint
//   · id.wikipedia.org             → free content (CC-BY-SA)
//   · bmkg.go.id                   → Indonesian government meteorology
//   · bi.go.id                     → Bank of Indonesia
//   · kemenparekraf.go.id          → Indonesian Ministry of Tourism
//
// Lab agents are BLOCKED from:
//   · api.openai.com / api.anthropic.com / api.together.xyz / api.groq.com
//   · Any authenticated third-party API
//   · Any domain that isn't on the allowlist
//
// If a Lab agent needs a NEW domain, it writes a request to
// data/nex-lab/pending-external.jsonl for founder review. No auto-add.

const IS_LAB = process.env.NEX_LAB_MODE === "1";

const LAB_ALLOWLIST_HOSTS = new Set([
  // localhost services
  "localhost",
  "127.0.0.1",
  "::1",
  // OSM ecosystem (ODbL / free)
  "nominatim.openstreetmap.org",
  "overpass-api.de",
  "overpass.kumi.systems",
  "tile.openstreetmap.org",
  // Wikimedia (free · CC0/CC-BY-SA)
  "query.wikidata.org",
  "www.wikidata.org",
  "id.wikipedia.org",
  "en.wikipedia.org",
  "dumps.wikimedia.org",
  // Indonesian government open data
  "data.bmkg.go.id",
  "www.bmkg.go.id",
  "bmkg.go.id",
  "www.bi.go.id",
  "bi.go.id",
  "www.kemenparekraf.go.id",
  "kemenparekraf.go.id",
  "satudata.kemenparekraf.go.id",
]);

const BLOCKED_LLM_HOSTS = new Set([
  "api.openai.com",
  "api.anthropic.com",
  "api.together.xyz",
  "api.groq.com",
  "api.cerebras.ai",
  "api.mistral.ai",
  "api.cohere.ai",
  "api.deepseek.com",
  "openrouter.ai",
  "api.sambanova.ai",
  "api-inference.huggingface.co",
]);

export interface LabGateVerdict {
  allowed: boolean;
  reason:  string;
  host:    string;
  is_lab_mode: boolean;
}

/**
 * Non-throwing check · returns a verdict. Callers decide whether to
 * throw or log-and-write-pending. Prefer `assertLabAllowed(url)` for
 * the safe-by-default enforcement.
 */
export function checkLabAllowed(url: string): LabGateVerdict {
  if (!IS_LAB) {
    return { allowed: true, reason: "not_in_lab_mode", host: "", is_lab_mode: false };
  }
  let host = "";
  try { host = new URL(url).hostname.toLowerCase(); }
  catch { return { allowed: false, reason: "invalid_url", host: url.slice(0, 100), is_lab_mode: true }; }

  if (BLOCKED_LLM_HOSTS.has(host)) {
    return { allowed: false, reason: `blocked_llm_host:${host}`, host, is_lab_mode: true };
  }
  if (LAB_ALLOWLIST_HOSTS.has(host)) {
    return { allowed: true, reason: `allowlist:${host}`, host, is_lab_mode: true };
  }
  return {
    allowed: false,
    reason:  `host_not_on_allowlist:${host}`,
    host,
    is_lab_mode: true,
  };
}

/**
 * Throwing version · Lab agents MUST call this before any outbound
 * fetch. If blocked, writes a row to data/nex-lab/pending-external.jsonl
 * for founder review, then throws.
 */
export async function assertLabAllowed(url: string, context?: Record<string, unknown>): Promise<void> {
  const verdict = checkLabAllowed(url);
  if (verdict.allowed) return;
  await recordPendingExternal(url, verdict.reason, context ?? {});
  throw new LabGateBlockedError(url, verdict.reason);
}

export class LabGateBlockedError extends Error {
  readonly kind = "lab_gate_blocked";
  readonly url: string;
  readonly reason: string;
  constructor(url: string, reason: string) {
    super(`Lab agent blocked from ${url} · ${reason}`);
    this.url = url;
    this.reason = reason;
  }
}

async function recordPendingExternal(url: string, reason: string, context: Record<string, unknown>): Promise<void> {
  try {
    const { appendFileSync, mkdirSync, existsSync } = await import("node:fs");
    const { join } = await import("node:path");
    const dir = process.env.NEX_LAB_DATA_ROOT ?? join(process.cwd(), "data", "nex-lab");
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const row = {
      ts_iso: new Date().toISOString(),
      url,
      reason,
      context,
      requires: "founder_review",
    };
    appendFileSync(join(dir, "pending-external.jsonl"), JSON.stringify(row) + "\n", "utf8");
  } catch { /* never throw from the recorder */ }
}
