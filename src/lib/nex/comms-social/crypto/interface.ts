// NEX Comms Centre · Social · KMS backend interface.
//
// Charter §S-IX (v0.2 hardened): envelope encryption per-tenant DEK
// wrapped by KMS master key. This interface abstracts the wrap/unwrap
// operation so the wrapping backend can be swapped without touching
// application code:
//   Phase 1 · local backend (env-var KEK) implementing this interface.
//   Later  · AWS KMS backend implementing the same interface.
//
// The interface intentionally accepts and returns only opaque bytes.
// No provider-specific field names, error codes, or key ARNs leak
// through this shape.

export interface KekWrapRequest {
  plaintext_dek: Buffer;                  // 32 raw bytes of DEK material
  purpose:       string;                  // 'access_token' | 'refresh_token' | 'oauth_state' · used for KMS encryption context
  tenant_id:     string;                  // additional binding context
}

export interface KekWrapResult {
  wrapped_dek:   Buffer;                  // ciphertext
  wrap_nonce:    Buffer;                  // AEAD nonce (12 bytes for AES-GCM)
  wrap_auth_tag: Buffer;                  // AEAD auth tag (16 bytes)
  kek_version:   string;                  // e.g. 'local:v1' · durably recorded so rotation knows which KEK to use
}

export interface KekUnwrapRequest {
  wrapped_dek:   Buffer;
  wrap_nonce:    Buffer;
  wrap_auth_tag: Buffer;
  kek_version:   string;
  purpose:       string;
  tenant_id:     string;
}

export interface KekBackend {
  /** Current KEK version identifier. Used when new DEKs are wrapped. */
  currentVersion(): string;
  /** Wrap a plaintext DEK with the current KEK. */
  wrap(req: KekWrapRequest): Promise<KekWrapResult>;
  /** Unwrap a previously-wrapped DEK. Must support all versions still in use so rotation is possible. */
  unwrap(req: KekUnwrapRequest): Promise<Buffer>;
  /** Reports which KEK versions the backend can decrypt for. */
  supportedVersions(): string[];
}
