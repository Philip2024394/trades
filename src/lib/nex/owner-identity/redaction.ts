// src/lib/nex/owner-identity/redaction.ts
//
// FOUNDER MASTER ACCESS · credential-detection + redaction pipeline
// Philip 2026-09-08 · AUTHORIZE Founder Master Access mission
//
// The "chat cleanup" rule (per doctrine):
//   credential detected → immediately consume securely → prevent persistence
//   → remove/redact from conversational state → establish Owner session
//
// This module is the SINGLE choke point through which every incoming
// user message passes BEFORE it's persisted / synced / logged anywhere.
//
// Hard rules:
//   · If a message CONTAINS a credential, the plaintext credential is
//     stripped from the message BEFORE anything else happens
//   · The redacted message that flows on is SAFE to persist (contains
//     no recoverable credential)
//   · The credential is verified in-memory against stored hashes and
//     never survives past the verify call
//   · If verification fails, we STILL redact (protect against attackers
//     probing what shape the credential is)

import type { OwnerCredentialHash } from "./hash";
import { verifyOwnerCredential } from "./hash";

/** Heuristic patterns for credential-shaped tokens in free text.
 *  A message is inspected for any of these · every match is redacted.
 *  We tolerate false positives (users occasionally see "[REDACTED]")
 *  because they're SAFER than false negatives (plaintext leakage). */
const CREDENTIAL_TOKEN_PATTERNS: RegExp[] = [
  // High-entropy alphanumeric ≥ 12 chars (typical private secret)
  /(?<![a-zA-Z0-9])[a-zA-Z0-9]{12,}(?![a-zA-Z0-9])/g,
  // Hyphenated / underscored passphrase-style credentials ≥ 16 chars total
  /(?<![a-zA-Z0-9\-_])[a-zA-Z0-9][a-zA-Z0-9\-_]{14,}[a-zA-Z0-9](?![a-zA-Z0-9\-_])/g,
  // Explicit credential prefix followed by any token
  /(?:cred(?:ential)?|passcode|passphrase|founder[_-]?auth|owner[_-]?auth|nexmaster)[\s:=]+\S+/gi,
];

export const REDACTION_MARKER = "[FOUNDER_CREDENTIAL_REDACTED]";

export type IngestionResult =
  | {
      kind: "no_credential_detected";
      safe_to_persist_message: string;    // = original message · nothing to redact
    }
  | {
      kind: "credential_detected_verified";
      safe_to_persist_message: string;    // redacted message · zero recoverable credential
      matched_hash_fingerprint: string;   // audit hint · never the credential
      session_should_be_established: true;
    }
  | {
      kind: "credential_detected_invalid";
      safe_to_persist_message: string;    // still redacted (protect probe pattern)
      reason: "no_matching_hash" | "malformed";
      session_should_be_established: false;
    };

/** Redact all credential-shaped tokens from a message string. Idempotent. */
export function redactCredentialTokens(message: string): { redacted: string; matches: string[] } {
  if (typeof message !== "string" || message.length === 0) {
    return { redacted: message, matches: [] };
  }
  const matches: string[] = [];
  let out = message;
  // Skip anything that IS the marker or is contained within an existing marker
  const MARKER_INNER = "FOUNDER_CREDENTIAL_REDACTED";
  for (const pat of CREDENTIAL_TOKEN_PATTERNS) {
    out = out.replace(pat, (m) => {
      if (m === MARKER_INNER || m.includes(MARKER_INNER) || MARKER_INNER.includes(m)) return m;
      matches.push(m);
      return REDACTION_MARKER;
    });
  }
  return { redacted: out, matches };
}

/** The single choke point. Given a raw message + the store of known credential
 *  hashes, return an IngestionResult indicating (a) what to persist, (b) whether
 *  to establish an Owner session. The returned `safe_to_persist_message` is
 *  ALWAYS safe to write to database / logs / analytics · it NEVER contains a
 *  recoverable credential. */
export function ingestUserMessage(input: {
  raw_message: string;
  known_credential_hashes: readonly OwnerCredentialHash[];
}): IngestionResult {
  const { raw_message, known_credential_hashes } = input;

  const { redacted, matches } = redactCredentialTokens(raw_message);

  if (matches.length === 0) {
    return { kind: "no_credential_detected", safe_to_persist_message: raw_message };
  }

  // Try to verify each detected token against each known credential hash.
  // First match wins. Verification happens BEFORE we return the redacted
  // message so the caller can decide session creation.
  for (const token of matches) {
    // Strip common wrapping (whitespace + colon + equals + label prefix)
    const trimmedCandidates = new Set<string>();
    trimmedCandidates.add(token);
    // If the token contained a label like "credential: XYZ", extract the tail
    const tail = token.split(/[\s:=]+/).pop();
    if (tail && tail.length >= 8) trimmedCandidates.add(tail);
    for (const cand of trimmedCandidates) {
      for (const hash of known_credential_hashes) {
        const v = verifyOwnerCredential(cand, hash);
        if (v.valid) {
          return {
            kind: "credential_detected_verified",
            safe_to_persist_message: redacted,
            matched_hash_fingerprint: `cred_fp_${hash.encoded.split("$").pop()?.slice(0, 12) ?? "unknown"}`,
            session_should_be_established: true,
          };
        }
      }
    }
  }

  return {
    kind: "credential_detected_invalid",
    safe_to_persist_message: redacted,
    reason: "no_matching_hash",
    session_should_be_established: false,
  };
}
