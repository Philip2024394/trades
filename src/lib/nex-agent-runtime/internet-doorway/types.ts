// WO-NEX-RUNTIME-09 · Internet doorway types.
//
// Founder-locked 2026-09-14.
//   Doctrine: "The Internet may supply information to NEX. It may
//             never supply authority to NEX."
//
// Retrieved content is DATA. Even if NEX fails to recognise an
// injection, the injected text still has ZERO authority. The
// sanitisation layer is called the External-Content Authority
// Boundary · not "prompt-injection immunity".

/** Locked · every UntrustedContentRecord carries this. There is no
 *  other legitimate authority level for retrieved Internet content. */
export type ContentAuthorityLevel = "UNTRUSTED";

export type InternetDoorwayVerdict =
  | "RETRIEVED"
  | "REJECTED_NO_DELEGATION"
  | "REJECTED_NO_INTERNET_SCOPE"
  | "REJECTED_HOST_NOT_ALLOWED"
  | "REJECTED_METHOD_NOT_ALLOWED"
  | "REJECTED_SIZE"
  | "REJECTED_TIMEOUT"
  | "REJECTED_RATE_LIMIT"
  | "REJECTED_REDIRECT_ESCAPE"
  | "REJECTED_CONTENT_TYPE"
  | "REJECTED_URL_MALFORMED"
  | "REJECTED_SCHEME_NOT_ALLOWED"
  | "ERRORED";

export interface UntrustedContentRecord {
  readonly record_type: "NEX_UNTRUSTED_CONTENT";
  readonly retrieval_id: string;
  readonly url: string;
  readonly effective_host: string;
  readonly method: "GET";                             // GET-only default · POST requires explicit founder carve-out (future)
  readonly delegation_id: string;
  readonly authorization_id: string;
  readonly requested_at: string;
  readonly completed_at: string;
  readonly verdict: InternetDoorwayVerdict;
  readonly response_status: number | null;
  readonly response_content_type: string | null;
  readonly response_bytes: number;
  readonly response_sha256_hex: string | null;
  /** Prefix of the response body · MAY be truncated for storage · MUST
   *  NOT be represented as the complete source. RUNTIME-09 default:
   *  first 65 536 bytes as UTF-8-decoded string. */
  readonly response_prefix_utf8: string;
  readonly response_prefix_is_bounded: boolean;
  /** Audit-only findings from the External-Content Authority Boundary.
   *  These are informational · they never grant or reduce authority. */
  readonly audit_findings: readonly ExternalContentAuditFinding[];
  readonly authority_level: ContentAuthorityLevel;    // LOCKED · always "UNTRUSTED"
  readonly retrieved_by_agent_id: string;
  readonly retrieved_by_public_key_der_hex: string;
  readonly signature_hex: string;                     // NEX identity signature over canonical payload
}

export type ExternalContentAuditKind =
  | "instruction_pattern_detected"                    // e.g. "ignore previous instructions" · audit only
  | "credential_pattern_detected"                     // e.g. AWS key shape in retrieved bytes
  | "control_char_present"
  | "unusual_encoding"
  | "html_script_tag_present"
  | "javascript_scheme_url"
  | "base64_blob_present"
  | "unicode_bidi_present";

export interface ExternalContentAuditFinding {
  readonly kind: ExternalContentAuditKind;
  readonly detail: string;
  readonly evidence_snippet: string;                  // bounded snippet (max 200 chars)
}

/** Delegation scope amendment: to grant Internet access, a delegation
 *  MUST include `allowed.internet_scope`. Absence = access denied. */
export interface DelegationInternetScope {
  readonly allowed_hosts: readonly string[];          // exact host match · no substring/prefix
  readonly allowed_methods: readonly ("GET")[];       // POST requires explicit founder carve-out (future)
  readonly max_request_bytes: number;
  readonly max_response_bytes: number;
  readonly max_rps_per_host: number;
  readonly timeout_ms: number;
  readonly allow_redirects: false;                    // LOCKED · redirects re-checked per hop, never followed to unallowed hosts
}

export const UNTRUSTED_CONTENT_COLLECTION = "nex_untrusted_content" as const;

// ── Doorway config (defaults) ──────────────────────────────────────────

export const DOORWAY_DEFAULTS = Object.freeze({
  max_response_bytes: 5 * 1024 * 1024,    // 5 MB hard cap
  timeout_ms: 15_000,
  max_rps_per_host: 2,
  prefix_bytes_kept: 65_536,               // 64 KB stored as prefix for audit
  audit_snippet_max: 200,
});
