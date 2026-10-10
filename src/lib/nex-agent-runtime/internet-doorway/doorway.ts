// WO-NEX-RUNTIME-09 · governed Internet doorway.
//
// Founder-locked 2026-09-14. The SINGLE entry point for any Internet
// request from any NEX agent. Refuses without a valid founder
// delegation carrying `internet_scope`. Enforces host allow-list,
// method allow-list, size cap (bounded streaming), timeout, rate
// limits, per-hop redirect check. Signs the resulting UntrustedContent
// record with the requesting agent's identity.

import { randomUUID, sign as ed25519Sign, createHash, createPublicKey, verify as ed25519Verify } from "node:crypto";
import { getStorage } from "@/lib/nex/storage/registry";
import type { AgentIdentity } from "@/lib/nex-agent-runtime/process/identity";
import type { FounderDelegationEnvelope, DelegatedAuthorizationEnvelope } from "@/lib/nex-agent-runtime/founder-authority/types";
import { verifyDelegationSignature, isDelegationRevoked } from "@/lib/nex-agent-runtime/founder-authority/delegation";
import { verifyAuthorizationSignature } from "@/lib/nex-agent-runtime/founder-authority/authorization";
import { boundedFetch, type BoundedFetchTransport } from "./bounded-fetch";
import { inspectExternalContent } from "./authority-boundary";
import {
  type UntrustedContentRecord,
  type InternetDoorwayVerdict,
  DOORWAY_DEFAULTS,
  UNTRUSTED_CONTENT_COLLECTION,
} from "./types";

// ── Per-host rate limiter (in-memory · per-process) ────────────────────

const rateLimitState = new Map<string, { window_start_ms: number; count: number }>();

function checkAndBumpRate(host: string, max_rps: number, now_ms: number): { ok: true } | { ok: false; retry_after_ms: number } {
  const state = rateLimitState.get(host);
  if (!state || now_ms - state.window_start_ms >= 1000) {
    rateLimitState.set(host, { window_start_ms: now_ms, count: 1 });
    return { ok: true };
  }
  if (state.count >= max_rps) {
    return { ok: false, retry_after_ms: 1000 - (now_ms - state.window_start_ms) };
  }
  state.count += 1;
  return { ok: true };
}

// ── Canonical retrieval-record serialisation ───────────────────────────

function canonicaliseRetrieval(r: Omit<UntrustedContentRecord, "signature_hex">): Buffer {
  const ordered = {
    record_type: r.record_type,
    retrieval_id: r.retrieval_id,
    url: r.url,
    effective_host: r.effective_host,
    method: r.method,
    delegation_id: r.delegation_id,
    authorization_id: r.authorization_id,
    requested_at: r.requested_at,
    completed_at: r.completed_at,
    verdict: r.verdict,
    response_status: r.response_status,
    response_content_type: r.response_content_type,
    response_bytes: r.response_bytes,
    response_sha256_hex: r.response_sha256_hex,
    response_prefix_utf8: r.response_prefix_utf8,
    response_prefix_is_bounded: r.response_prefix_is_bounded,
    audit_findings: r.audit_findings.map((f) => ({ kind: f.kind, detail: f.detail, evidence_snippet: f.evidence_snippet })),
    authority_level: r.authority_level,
    retrieved_by_agent_id: r.retrieved_by_agent_id,
    retrieved_by_public_key_der_hex: r.retrieved_by_public_key_der_hex,
  };
  return Buffer.from(JSON.stringify(ordered), "utf8");
}

export function verifyUntrustedContentSignature(record: UntrustedContentRecord): boolean {
  try {
    const { signature_hex: _drop, ...base } = record;
    void _drop;
    const pub = createPublicKey({ key: Buffer.from(record.retrieved_by_public_key_der_hex, "hex"), format: "der", type: "spki" });
    return ed25519Verify(null, canonicaliseRetrieval(base), pub, Buffer.from(record.signature_hex, "hex"));
  } catch { return false; }
}

// ── Public API · doorway fetch ─────────────────────────────────────────

export interface DoorwayFetchInput {
  readonly delegate_identity: AgentIdentity;
  readonly delegation: FounderDelegationEnvelope;
  readonly authorization: DelegatedAuthorizationEnvelope;
  readonly trusted_founder_public_keys_hex: readonly string[];
  readonly url: string;
  readonly method: "GET";
  /** Optional transport injection for tests. Production leaves undefined. */
  readonly transport?: BoundedFetchTransport;
  readonly now_ms?: number;
}

export interface DoorwayFetchResult {
  readonly record: UntrustedContentRecord;
  readonly verdict: InternetDoorwayVerdict;
}

export async function doorwayFetch(input: DoorwayFetchInput): Promise<DoorwayFetchResult> {
  const now_ms = input.now_ms ?? Date.now();
  const requested_at = new Date(now_ms).toISOString();
  const retrieval_id = `RET-${randomUUID()}`;

  const build = (verdict: InternetDoorwayVerdict, effective_host: string, extras: Partial<UntrustedContentRecord> = {}): UntrustedContentRecord => {
    const base: Omit<UntrustedContentRecord, "signature_hex"> = {
      record_type: "NEX_UNTRUSTED_CONTENT",
      retrieval_id,
      url: input.url,
      effective_host,
      method: input.method,
      delegation_id: input.delegation.delegation_id,
      authorization_id: input.authorization.authorization_id,
      requested_at,
      completed_at: new Date().toISOString(),
      verdict,
      response_status: null,
      response_content_type: null,
      response_bytes: 0,
      response_sha256_hex: null,
      response_prefix_utf8: "",
      response_prefix_is_bounded: false,
      audit_findings: [],
      authority_level: "UNTRUSTED",
      retrieved_by_agent_id: input.delegate_identity.agent_id,
      retrieved_by_public_key_der_hex: input.delegate_identity.public_key_der_hex,
      ...extras,
    };
    const sig = ed25519Sign(null, canonicaliseRetrieval(base), input.delegate_identity.private).toString("hex");
    return { ...base, signature_hex: sig };
  };

  // 1 · URL parse + host extraction
  let host: string;
  try {
    const u = new URL(input.url);
    host = u.hostname.toLowerCase();
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      const rec = build("REJECTED_SCHEME_NOT_ALLOWED", host);
      await getStorage().save(UNTRUSTED_CONTENT_COLLECTION, rec);
      return { record: rec, verdict: rec.verdict };
    }
  } catch {
    const rec = build("REJECTED_URL_MALFORMED", "");
    await getStorage().save(UNTRUSTED_CONTENT_COLLECTION, rec);
    return { record: rec, verdict: rec.verdict };
  }

  // 2 · Delegation signature must be valid + not expired + not revoked
  if (!verifyDelegationSignature(input.delegation, input.trusted_founder_public_keys_hex)) {
    const rec = build("REJECTED_NO_DELEGATION", host);
    await getStorage().save(UNTRUSTED_CONTENT_COLLECTION, rec);
    return { record: rec, verdict: rec.verdict };
  }
  if (now_ms >= Date.parse(input.delegation.expires_at)) {
    const rec = build("REJECTED_NO_DELEGATION", host);
    await getStorage().save(UNTRUSTED_CONTENT_COLLECTION, rec);
    return { record: rec, verdict: rec.verdict };
  }
  const revStatus = await isDelegationRevoked(input.delegation.delegation_id, input.trusted_founder_public_keys_hex);
  if (revStatus.revoked) {
    const rec = build("REJECTED_NO_DELEGATION", host);
    await getStorage().save(UNTRUSTED_CONTENT_COLLECTION, rec);
    return { record: rec, verdict: rec.verdict };
  }

  // 3 · Authorization signature must be valid + not expired + delegate matches
  if (!verifyAuthorizationSignature(input.authorization)) {
    const rec = build("REJECTED_NO_DELEGATION", host);
    await getStorage().save(UNTRUSTED_CONTENT_COLLECTION, rec);
    return { record: rec, verdict: rec.verdict };
  }
  if (
    input.authorization.authorized_by_agent_id !== input.delegation.delegate_agent_id ||
    input.authorization.authorized_by_public_key_der_hex !== input.delegation.delegate_public_key_der_hex
  ) {
    const rec = build("REJECTED_NO_DELEGATION", host);
    await getStorage().save(UNTRUSTED_CONTENT_COLLECTION, rec);
    return { record: rec, verdict: rec.verdict };
  }

  // 4 · The presenting agent MUST match the delegate empowered by the delegation
  if (input.delegate_identity.agent_id !== input.delegation.delegate_agent_id ||
      input.delegate_identity.public_key_der_hex !== input.delegation.delegate_public_key_der_hex) {
    const rec = build("REJECTED_NO_DELEGATION", host);
    await getStorage().save(UNTRUSTED_CONTENT_COLLECTION, rec);
    return { record: rec, verdict: rec.verdict };
  }

  // 5 · Delegation must carry internet_scope
  const iscope = input.delegation.allowed.internet_scope;
  if (!iscope) {
    const rec = build("REJECTED_NO_INTERNET_SCOPE", host);
    await getStorage().save(UNTRUSTED_CONTENT_COLLECTION, rec);
    return { record: rec, verdict: rec.verdict };
  }

  // 6 · Host allow-list (exact match · lowercase)
  const allowedHosts = new Set(iscope.allowed_hosts.map((h) => h.toLowerCase()));
  if (!allowedHosts.has(host)) {
    const rec = build("REJECTED_HOST_NOT_ALLOWED", host);
    await getStorage().save(UNTRUSTED_CONTENT_COLLECTION, rec);
    return { record: rec, verdict: rec.verdict };
  }

  // 7 · Method allow-list
  if (!iscope.allowed_methods.includes(input.method)) {
    const rec = build("REJECTED_METHOD_NOT_ALLOWED", host);
    await getStorage().save(UNTRUSTED_CONTENT_COLLECTION, rec);
    return { record: rec, verdict: rec.verdict };
  }

  // 8 · Rate limit
  const rate = checkAndBumpRate(host, iscope.max_rps_per_host, now_ms);
  if (!rate.ok) {
    const rec = build("REJECTED_RATE_LIMIT", host);
    await getStorage().save(UNTRUSTED_CONTENT_COLLECTION, rec);
    return { record: rec, verdict: rec.verdict };
  }

  // 9 · Bounded streaming fetch
  const fetchOutcome = await boundedFetch({
    url: input.url, method: input.method,
    max_response_bytes: iscope.max_response_bytes,
    timeout_ms: iscope.timeout_ms,
    follow_redirects: false,
    transport: input.transport,
  });

  if (fetchOutcome.kind === "url_malformed") {
    const rec = build("REJECTED_URL_MALFORMED", host);
    await getStorage().save(UNTRUSTED_CONTENT_COLLECTION, rec);
    return { record: rec, verdict: rec.verdict };
  }
  if (fetchOutcome.kind === "scheme_not_allowed") {
    const rec = build("REJECTED_SCHEME_NOT_ALLOWED", host);
    await getStorage().save(UNTRUSTED_CONTENT_COLLECTION, rec);
    return { record: rec, verdict: rec.verdict };
  }
  if (fetchOutcome.kind === "redirect_escape") {
    const rec = build("REJECTED_REDIRECT_ESCAPE", fetchOutcome.from_host, {
      response_status: fetchOutcome.status,
    });
    await getStorage().save(UNTRUSTED_CONTENT_COLLECTION, rec);
    return { record: rec, verdict: rec.verdict };
  }
  if (fetchOutcome.kind === "timeout") {
    const rec = build("REJECTED_TIMEOUT", host);
    await getStorage().save(UNTRUSTED_CONTENT_COLLECTION, rec);
    return { record: rec, verdict: rec.verdict };
  }
  if (fetchOutcome.kind === "size_exceeded") {
    // Bounded prefix is retained for audit only · NEVER as the complete source
    const prefixBytes = fetchOutcome.partial_prefix.subarray(0, DOORWAY_DEFAULTS.prefix_bytes_kept);
    const rec = build("REJECTED_SIZE", fetchOutcome.effective_host, {
      response_status: fetchOutcome.status,
      response_content_type: fetchOutcome.content_type,
      response_bytes: fetchOutcome.bytes_received,
      response_sha256_hex: null,   // do NOT hash a truncated blob as if it were complete
      response_prefix_utf8: safeUtf8(prefixBytes),
      response_prefix_is_bounded: true,
    });
    await getStorage().save(UNTRUSTED_CONTENT_COLLECTION, rec);
    return { record: rec, verdict: rec.verdict };
  }
  if (fetchOutcome.kind === "errored") {
    const rec = build("ERRORED", host);
    await getStorage().save(UNTRUSTED_CONTENT_COLLECTION, rec);
    return { record: rec, verdict: rec.verdict };
  }

  // 10 · Success · compute hash + inspect + persist
  const bytes = fetchOutcome.bytes;
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const prefix = bytes.subarray(0, DOORWAY_DEFAULTS.prefix_bytes_kept);
  const prefixUtf8 = safeUtf8(prefix);
  const audits = inspectExternalContent(prefixUtf8);

  // Content-type validation (accept common text types · reject clearly binary)
  const ct = fetchOutcome.content_type ?? "";
  const isText =
    ct.startsWith("text/") ||
    ct.includes("json") ||
    ct.includes("xml") ||
    ct.includes("javascript") ||    // note: retrieved as data · never executed
    ct === "" ||                     // some hosts omit; accept
    ct.startsWith("application/vnd.");
  if (!isText) {
    const rec = build("REJECTED_CONTENT_TYPE", fetchOutcome.effective_host, {
      response_status: fetchOutcome.status, response_content_type: ct || null,
      response_bytes: bytes.length, response_sha256_hex: sha256,
      response_prefix_utf8: "", response_prefix_is_bounded: false,
    });
    await getStorage().save(UNTRUSTED_CONTENT_COLLECTION, rec);
    return { record: rec, verdict: rec.verdict };
  }

  const rec = build("RETRIEVED", fetchOutcome.effective_host, {
    response_status: fetchOutcome.status,
    response_content_type: ct || null,
    response_bytes: bytes.length,
    response_sha256_hex: sha256,
    response_prefix_utf8: prefixUtf8,
    response_prefix_is_bounded: bytes.length > DOORWAY_DEFAULTS.prefix_bytes_kept,
    audit_findings: audits,
  });
  await getStorage().save(UNTRUSTED_CONTENT_COLLECTION, rec);
  return { record: rec, verdict: rec.verdict };
}

function safeUtf8(buf: Buffer): string {
  try { return buf.toString("utf8"); } catch { return ""; }
}

// ── Read helpers ───────────────────────────────────────────────────────

export async function loadRetrievalsForHost(host: string, limit = 50): Promise<UntrustedContentRecord[]> {
  return getStorage().query<UntrustedContentRecord>(UNTRUSTED_CONTENT_COLLECTION, {
    where: { effective_host: host }, limit, order_by: "requested_at", order_dir: "desc",
  }).catch(() => [] as UntrustedContentRecord[]);
}
