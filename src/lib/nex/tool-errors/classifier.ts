// src/lib/nex/tool-errors/classifier.ts
//
// WAVE-P-1.3 · Deterministic classifier that turns raw exceptions
// or HTTP responses into typed ToolFailure records.
// Founder BEGIN WAVE-P-1 · 2026-09-08

import type { ToolFailure, ToolFailureKind } from "./types";

const RETRYABLE: readonly ToolFailureKind[] = [
  "transient_upstream", "rate_limited", "timeout", "malformed_output", "unknown",
];

export function isRetryable(kind: ToolFailureKind): boolean {
  return RETRYABLE.includes(kind);
}

export function classifyToolFailure(input: {
  tool_name: string;
  error?: unknown;
  http_status?: number;
  retry_after_header?: string | number | null;
  message_override?: string;
}): ToolFailure {
  const captured_at_iso = new Date().toISOString();
  const errMsg = input.error instanceof Error ? input.error.message : (input.error !== undefined ? String(input.error) : "");
  const retry_after_ms = parseRetryAfter(input.retry_after_header);

  let kind: ToolFailureKind;
  if (typeof input.http_status === "number") {
    if (input.http_status === 429) kind = "rate_limited";
    else if (input.http_status === 401 || input.http_status === 403) kind = "not_authorized";
    else if (input.http_status === 402) kind = "quota_exhausted";
    else if (input.http_status >= 500) kind = "transient_upstream";
    else if (input.http_status >= 400) kind = "permanent_upstream";
    else kind = "unknown";
  } else if (/ECONNREFUSED|ETIMEDOUT|ENOTFOUND|ECONNRESET|EAI_AGAIN/i.test(errMsg)) {
    kind = "transient_upstream";
  } else if (/timeout|timed.out/i.test(errMsg)) {
    kind = "timeout";
  } else if (/sandbox|forbidden.path|policy.denied|repair.skill.not.allowed/i.test(errMsg)) {
    kind = "sandbox_denied";
  } else if (/invalid.input|schema.violation|missing.required.field|malformed.request/i.test(errMsg)) {
    kind = "invalid_input";
  } else if (/malformed.response|unexpected.token|invalid.json/i.test(errMsg)) {
    kind = "malformed_output";
  } else if (/quota|budget/i.test(errMsg)) {
    kind = "quota_exhausted";
  } else if (errMsg.length === 0) {
    kind = "unknown";
  } else {
    kind = "unknown";
  }

  return {
    kind,
    message: input.message_override ?? errMsg ?? `Tool failure (${kind})`,
    retryable: isRetryable(kind),
    retry_after_ms,
    http_status: input.http_status,
    tool_name: input.tool_name,
    captured_at_iso,
  };
}

function parseRetryAfter(v: string | number | null | undefined): number | undefined {
  if (v === null || v === undefined) return undefined;
  if (typeof v === "number") return v * 1000;
  const asNum = Number.parseInt(v, 10);
  if (Number.isFinite(asNum)) return asNum * 1000;
  const asDate = Date.parse(v);
  if (Number.isFinite(asDate)) return Math.max(0, asDate - Date.now());
  return undefined;
}
