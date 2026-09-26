// src/lib/nex-native/webauthn-config.ts
//
// Shared runtime config for WebAuthn ceremonies · server-only.
// -------------------------------------------------------------------------
// rpID must be a hostname (no scheme, no port). Origin is the full URL
// the browser sees. Both must match what the browser sends in the
// ClientDataJSON or verification fails.

import "server-only";

export interface NexWebauthnConfig {
  rpName: string;
  rpID: string;
  origin: string;
}

/**
 * Resolve WebAuthn RP configuration from the incoming request.
 * Prefers explicit NEX_WEBAUTHN_* env vars, falls back to the Host header.
 * Falls back to localhost:3008 for CLI/reality-check contexts without a
 * request object.
 */
export function resolveWebauthnConfig(req?: Request): NexWebauthnConfig {
  const envRpID = process.env.NEX_WEBAUTHN_RP_ID?.trim();
  const envOrigin = process.env.NEX_WEBAUTHN_ORIGIN?.trim();
  const rpName = process.env.NEX_WEBAUTHN_RP_NAME?.trim() || "NEX";
  if (envRpID && envOrigin) {
    return { rpName, rpID: envRpID, origin: envOrigin };
  }
  if (req) {
    const url = new URL(req.url);
    return {
      rpName,
      rpID: url.hostname,
      origin: `${url.protocol}//${url.host}`,
    };
  }
  return { rpName, rpID: "localhost", origin: "http://localhost:3008" };
}
