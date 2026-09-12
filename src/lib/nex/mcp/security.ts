// src/lib/nex/mcp/security.ts
//
// WAVE-P-2 · MCP security · manifest verification + per-session allowlist
// Founder BEGIN WAVE-P-2 · 2026-09-08
//
// Per MCP security research (2026 OWASP MCP Top 10):
//   · Treat tool descriptions AND outputs as untrusted input
//   · Signed manifests · human approval before adding external servers
//   · Per-session allowlist · never allow all servers by default
//   · Refuse unknown / unsigned when NEX_MCP_STRICT is on

import { createHash } from "node:crypto";
import type { McpServerManifest, McpSessionAllowlist, McpTool } from "./types";

// ═══════════════════════════════════════════════════════════════════
// § A · MANIFEST HASHING
// ═══════════════════════════════════════════════════════════════════

/** Deterministic canonical serialization of a manifest for hashing.
 *  Excludes manifest_hash + signature + signed_by + approved_by_founder_at_iso
 *  because those are ABOUT the manifest · not part of its identity. This
 *  lets the same manifest be signed later or approved later without changing
 *  the identity hash. */
export function canonicalManifestBytes(manifest: Omit<McpServerManifest, "manifest_hash" | "signature" | "signed_by" | "approved_by_founder_at_iso">): string {
  return stableStringify({
    server_name: manifest.server_name,
    server_version: manifest.server_version,
    transport_kind: manifest.transport_kind,
    transport_uri: manifest.transport_uri ?? null,
    advertised_tools: manifest.advertised_tools.map(canonicalTool),
    approval_scope: manifest.approval_scope,
  });
}

function canonicalTool(t: McpTool): unknown {
  return {
    name: t.name,
    description: t.description,
    inputSchema: {
      type: t.inputSchema.type,
      properties: Object.keys(t.inputSchema.properties).sort().reduce<Record<string, unknown>>((acc, key) => {
        const p = t.inputSchema.properties[key];
        acc[key] = { type: p.type, description: p.description ?? null, enum: p.enum ?? null, items: p.items ?? null };
        return acc;
      }, {}),
      required: [...(t.inputSchema.required ?? [])].sort(),
    },
  };
}

function stableStringify(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(stableStringify).join(",") + "]";
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    return "{" + keys.map((k) => JSON.stringify(k) + ":" + stableStringify(obj[k])).join(",") + "}";
  }
  return "null";
}

export function computeManifestHash(manifest: Omit<McpServerManifest, "manifest_hash" | "signature" | "signed_by" | "approved_by_founder_at_iso">): string {
  return createHash("sha256").update(canonicalManifestBytes(manifest), "utf8").digest("hex").slice(0, 24);
}

// ═══════════════════════════════════════════════════════════════════
// § B · MANIFEST VERIFICATION
// ═══════════════════════════════════════════════════════════════════

export type ManifestVerificationResult =
  | { ok: true }
  | { ok: false; reason: string };

/** Verify a manifest's integrity + approval status.
 *  Strict mode refuses unsigned / unapproved. */
export function verifyManifest(input: {
  manifest: McpServerManifest;
  strict?: boolean;
}): ManifestVerificationResult {
  const { manifest, strict } = input;

  // 1 · hash integrity
  const expected_hash = computeManifestHash(manifest);
  if (manifest.manifest_hash !== expected_hash) {
    return { ok: false, reason: `manifest_hash mismatch · expected ${expected_hash} · got ${manifest.manifest_hash}` };
  }

  // 2 · approval scope
  if (manifest.approval_scope === "denied") {
    return { ok: false, reason: `manifest explicitly DENIED by Founder` };
  }

  // 3 · strict mode: require signature + approval
  if (strict) {
    if (!manifest.signed_by || !manifest.signature) {
      return { ok: false, reason: `strict mode: manifest requires signature (signed_by + signature)` };
    }
    if (!manifest.approved_by_founder_at_iso) {
      return { ok: false, reason: `strict mode: manifest requires Founder approval (approved_by_founder_at_iso)` };
    }
  }

  return { ok: true };
}

/** Whether strict mode is currently enabled via env. Default true —
 *  self-sustainment + doctrine discipline: refuse-first. */
export function isMcpStrictMode(): boolean {
  const v = process.env.NEX_MCP_STRICT;
  if (v === "false" || v === "0" || v === "no") return false;
  return true; // default STRICT
}

// ═══════════════════════════════════════════════════════════════════
// § C · SESSION ALLOWLIST
// ═══════════════════════════════════════════════════════════════════

/** Check whether a specific server/tool invocation is allowed for a session. */
export function checkAllowlist(input: {
  allowlist: McpSessionAllowlist;
  server_name: string;
  tool_full_name: string;    // "server_name.tool_name"
  tool_is_read_only: boolean;
  now_ms?: number;
}): { allowed: boolean; reason?: string } {
  const now = input.now_ms ?? Date.now();
  if (input.allowlist.expires_at_ms && now >= input.allowlist.expires_at_ms) {
    return { allowed: false, reason: `session allowlist expired at ${input.allowlist.expires_at_ms}` };
  }
  if (input.allowlist.allow_all_read_only && input.tool_is_read_only) {
    return { allowed: true };
  }
  if (!input.allowlist.allowed_servers.includes(input.server_name)) {
    return { allowed: false, reason: `server '${input.server_name}' not in session allowlist` };
  }
  if (input.allowlist.allowed_tools.length > 0 && !input.allowlist.allowed_tools.includes(input.tool_full_name)) {
    return { allowed: false, reason: `tool '${input.tool_full_name}' not in session allowlist` };
  }
  return { allowed: true };
}

/** Convenience helper for Founder to approve a manifest · returns a
 *  new record with approval fields set. Signature verification is
 *  the caller's responsibility (out of scope for this in-memory
 *  primitive · would use a real signing service in production). */
export function markManifestApproved(input: {
  manifest: McpServerManifest;
  approval_scope: "read_only" | "read_write";
}): McpServerManifest {
  return {
    ...input.manifest,
    approval_scope: input.approval_scope,
    approved_by_founder_at_iso: new Date().toISOString(),
  };
}
