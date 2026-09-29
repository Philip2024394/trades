// src/lib/nex-native/intelligence/gateway-telemetry.ts
//
// Bridge 91 · Audit sink for the NEX Intelligence Gateway. Every call
// through the gateway writes one JSONL line to
// data/nex-intelligence-audit/YYYY-MM-DD.jsonl so operators can trace
// intent → retrieval → generation → validation → response for any
// business-customer reply.
//
// Design decisions:
//   · Append-only JSONL · no schema migrations, no DB writes, no risk
//     of blocking the reply path on audit failure
//   · Sink is `try {...} catch { /* silent */ }` · audit is non-critical
//   · No plaintext personal chat is EVER logged here · gateway only
//     runs on business-customer conversations which are the authorised
//     server-visible surface
//   · No secrets, no private keys, no auth tokens

import "server-only";
import * as fs from "node:fs";
import * as path from "node:path";

const AUDIT_DIR = path.join(process.cwd(), "data", "nex-intelligence-audit");

export interface GatewayAuditRow {
  ts: string;
  correlation_id: string | null;
  conversation_id: string;
  business_id: string | null;
  product_id: string | null;
  requester_side: "customer" | "business" | null;
  path: "reflex" | "grounded" | "gap" | "error";
  intent_length: number;
  reflex_hit: boolean;
  retrieval: {
    empty: boolean;
    total_candidates: number;
    kept_items: number;
    sources_consulted: string[];
    item_ids: string[];
  } | null;
  generation: {
    model_id: string | null;
    total_latency_ms: number;
    attempts: number;
    findings: string[];
    ok: boolean;
  } | null;
  reply_length: number;
  gap_reason: string | null;
  total_latency_ms: number;
}

export async function recordGatewayAudit(row: GatewayAuditRow): Promise<void> {
  try {
    if (!fs.existsSync(AUDIT_DIR)) {
      fs.mkdirSync(AUDIT_DIR, { recursive: true });
    }
    const dayFile = path.join(
      AUDIT_DIR,
      `${row.ts.slice(0, 10)}.jsonl`,
    );
    await fs.promises.appendFile(dayFile, JSON.stringify(row) + "\n", "utf-8");
  } catch {
    // Audit is best-effort · never break the reply path if disk / perms fail.
  }
}
