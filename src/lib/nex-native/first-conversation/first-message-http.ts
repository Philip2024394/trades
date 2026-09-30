// src/lib/nex-native/first-conversation/first-message-http.ts
//
// Bridge 99 · Stage 7 · testable core for POST /api/nex-native/first-message
// -----------------------------------------------------------------------------
// Pure body-validation + orchestrator invocation. Does NOT touch
// next/headers, cookies, or any Next.js runtime API. The route.ts
// thin wrapper handles Next.js binding; this module contains all the
// request-shape logic and result mapping.

import "server-only";
import {
  computeProvisionalFingerprint,
  type NexUaClass,
  type ProvisionalFingerprintConfig,
  type ProvisionalFingerprintInput,
} from "./provisional-fingerprint";
import { orchestrateFirstMessage } from "./first-message-orchestrator";
import type { NexResolvedSession } from "./provisional-session";
import type { CiphertextRowInput } from "./provisional-account-service";
import type { NexSessionCryptoConfig, NexSessionPayload } from "./session-crypto";

// ---------------------------------------------------------------------------
// Request body shape (public contract to the client)
// ---------------------------------------------------------------------------

export interface FirstMessageRequestBody {
  message_length: number;
  send_intent_id: string;
  message_group_id: string;
  ciphertext_rows: CiphertextRowInput[];
  device_id: string;
  device_public_key_b64: string;
  owner_account_id: string;
  owner_business_id: string | null;
  owner_bisnis_tier: "gratis" | "bisnis";
  fingerprint_client: {
    ua_class: NexUaClass;
    tz_offset_minutes: number;
    accept_language_primary: string;
  };
}

// ---------------------------------------------------------------------------
// Result shapes (mapped to HTTP status + body)
// ---------------------------------------------------------------------------

export interface FirstMessageResponseBody {
  status:
    | "created"
    | "existing_session"
    | "challenge"
    | "blocked"
    | "invalid_request"
    | "internal_error";
  [k: string]: unknown;
}

export interface ProcessFirstMessageResult {
  http_status: 200 | 400 | 403 | 429 | 500;
  body: FirstMessageResponseBody;
  /** When non-null, the route should write a nex_session cookie with
   *  this payload. Only ever set when http_status=200 + body.status='created'. */
  set_session_cookie?: {
    payload: NexSessionPayload;
  };
}

// ---------------------------------------------------------------------------
// Deps (injectable for tests)
// ---------------------------------------------------------------------------

export interface ProcessFirstMessageDeps {
  /** Session resolver · production wraps Stage 4d resolveNexAppOrProvisionalSession. */
  resolveSession: () => Promise<NexResolvedSession>;
  /** Full connecting IP · route derives from headers. */
  getConnectionIp: () => Promise<string>;
  /** Fingerprint salt config · from env in prod, explicit in tests. */
  fingerprintCfg: ProvisionalFingerprintConfig;
  /** Session-signing config · from env in prod, explicit in tests. */
  cryptoCfg: NexSessionCryptoConfig;
  /** Injectable clock. */
  now_ms?: number;
}

// ---------------------------------------------------------------------------
// Pure body validation
// ---------------------------------------------------------------------------

const ALLOWED_UA_CLASSES: readonly NexUaClass[] = [
  "chromium",
  "webkit",
  "gecko",
  "unknown",
];

export function validateFirstMessageBody(
  body: unknown,
): { field: string; message: string } | null {
  if (!body || typeof body !== "object") {
    return { field: "body", message: "body must be a JSON object" };
  }
  const x = body as Record<string, unknown>;
  const required = [
    "message_length",
    "send_intent_id",
    "message_group_id",
    "ciphertext_rows",
    "device_id",
    "device_public_key_b64",
    "owner_account_id",
    "owner_business_id",
    "owner_bisnis_tier",
    "fingerprint_client",
  ] as const;
  for (const k of required) {
    if (!(k in x)) {
      return { field: k, message: `missing required field '${k}'` };
    }
  }
  if (typeof x.message_length !== "number" || x.message_length < 0) {
    return { field: "message_length", message: "message_length must be a non-negative number" };
  }
  if (typeof x.send_intent_id !== "string" || x.send_intent_id.length < 8) {
    return { field: "send_intent_id", message: "send_intent_id required" };
  }
  if (typeof x.message_group_id !== "string" || x.message_group_id.length < 8) {
    return { field: "message_group_id", message: "message_group_id required" };
  }
  if (!Array.isArray(x.ciphertext_rows) || x.ciphertext_rows.length === 0) {
    return { field: "ciphertext_rows", message: "ciphertext_rows must be a non-empty array" };
  }
  if (typeof x.device_id !== "string" || x.device_id.length < 8) {
    return { field: "device_id", message: "device_id must be at least 8 chars" };
  }
  if (typeof x.device_public_key_b64 !== "string" || x.device_public_key_b64.length < 40) {
    return { field: "device_public_key_b64", message: "device_public_key_b64 must be at least 40 chars" };
  }
  if (typeof x.owner_account_id !== "string" || x.owner_account_id.length === 0) {
    return { field: "owner_account_id", message: "owner_account_id required" };
  }
  if (x.owner_business_id !== null && typeof x.owner_business_id !== "string") {
    return { field: "owner_business_id", message: "owner_business_id must be string or null" };
  }
  if (x.owner_bisnis_tier !== "gratis" && x.owner_bisnis_tier !== "bisnis") {
    return { field: "owner_bisnis_tier", message: "owner_bisnis_tier must be 'gratis' or 'bisnis'" };
  }
  const fc = x.fingerprint_client as Record<string, unknown> | undefined;
  if (!fc || typeof fc !== "object") {
    return { field: "fingerprint_client", message: "fingerprint_client object required" };
  }
  if (
    typeof fc.ua_class !== "string" ||
    !ALLOWED_UA_CLASSES.includes(fc.ua_class as NexUaClass)
  ) {
    return {
      field: "fingerprint_client.ua_class",
      message: "ua_class must be one of chromium|webkit|gecko|unknown",
    };
  }
  if (typeof fc.tz_offset_minutes !== "number" || !Number.isInteger(fc.tz_offset_minutes)) {
    return {
      field: "fingerprint_client.tz_offset_minutes",
      message: "tz_offset_minutes must be integer",
    };
  }
  if (
    typeof fc.accept_language_primary !== "string" ||
    !/^[a-z]{2}$/i.test(fc.accept_language_primary)
  ) {
    return {
      field: "fingerprint_client.accept_language_primary",
      message: "accept_language_primary must be a 2-letter primary tag",
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// IP → /24 bucket
// ---------------------------------------------------------------------------

export function deriveIp24Bucket(fullIp: string): string {
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(fullIp)) {
    return fullIp.split(".").slice(0, 3).join(".");
  }
  const parts = fullIp.split(":").filter(Boolean).slice(0, 3);
  const digits = parts.map((p) => (parseInt(p, 16) || 0).toString());
  while (digits.length < 3) digits.push("0");
  // Cap each to 3 digits so the fingerprint regex accepts it.
  return digits.map((d) => d.slice(-3)).join(".");
}

// ---------------------------------------------------------------------------
// Pure core · takes a parsed body + deps and returns HTTP-shaped result
// ---------------------------------------------------------------------------

export async function processFirstMessagePayload(
  body: unknown,
  deps: ProcessFirstMessageDeps,
): Promise<ProcessFirstMessageResult> {
  // 1. Validate body shape
  const shapeError = validateFirstMessageBody(body);
  if (shapeError) {
    return {
      http_status: 400,
      body: {
        status: "invalid_request",
        message: shapeError.message,
        field: shapeError.field,
      },
    };
  }
  const b = body as FirstMessageRequestBody;

  // 2. Resolve session
  let session: NexResolvedSession;
  try {
    session = await deps.resolveSession();
  } catch {
    return { http_status: 500, body: { status: "internal_error" } };
  }

  // 3. Compute fingerprint
  let fingerprint: string;
  try {
    const ip = await deps.getConnectionIp();
    const fpInput: ProvisionalFingerprintInput = {
      device_id: b.device_id,
      ua_class: b.fingerprint_client.ua_class,
      ip_24_bucket: deriveIp24Bucket(ip),
      tz_offset_minutes: b.fingerprint_client.tz_offset_minutes,
      accept_language_primary: b.fingerprint_client.accept_language_primary,
    };
    fingerprint = computeProvisionalFingerprint(fpInput, deps.fingerprintCfg);
  } catch {
    return { http_status: 500, body: { status: "internal_error" } };
  }

  // 4. Orchestrator
  let result;
  try {
    result = await orchestrateFirstMessage({
      session,
      message_length: b.message_length,
      send_intent_id: b.send_intent_id,
      message_group_id: b.message_group_id,
      ciphertext_rows: b.ciphertext_rows,
      device_id: b.device_id,
      device_public_key_b64: b.device_public_key_b64,
      fingerprint,
      owner_account_id: b.owner_account_id,
      owner_business_id: b.owner_business_id,
      owner_bisnis_tier: b.owner_bisnis_tier,
      crypto_cfg: deps.cryptoCfg,
      now_ms: deps.now_ms,
    });
  } catch {
    return { http_status: 500, body: { status: "internal_error" } };
  }

  // 5. Map result → HTTP
  switch (result.status) {
    case "created":
      return {
        http_status: 200,
        body: {
          status: "created",
          account_id: result.account_id,
          conversation_id: result.conversation_id,
          first_message_id: result.first_message_id,
          deduplicated: result.deduplicated,
          redirect_to: result.redirect_to,
        },
        set_session_cookie: {
          payload: {
            account_id: result.account_id,
            session_id: result.session.session_id,
            issued_at_ms: deps.now_ms ?? Date.now(),
            expires_at_ms: result.session.expires_at_ms,
          },
        },
      };
    case "existing_session":
      return {
        http_status: 200,
        body: {
          status: "existing_session",
          account_id: result.account_id,
          redirect_to: result.redirect_to,
        },
      };
    case "challenge":
      return {
        http_status: 429,
        body: { status: "challenge", challenge_kind: result.challenge_kind },
      };
    case "blocked":
      return {
        http_status: 403,
        body: { status: "blocked", reason: result.reason },
      };
  }
}
