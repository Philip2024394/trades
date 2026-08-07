// NEX Comms Centre · Social · KMS backend · local implementation.
//
// Charter §S-IX (v0.2 hardened): "Automatic DEK rotation every 90 days
// without service interruption." Rotation is a pipeline operation; this
// backend supports it structurally by tagging each wrapped DEK with a
// `kek_version` and supporting unwrap against every KEK it still knows
// about.
//
// Phase 1 backend: KEK material comes from environment variable
// NEX_COMMS_SOCIAL_KEK (64 hex chars = 32 bytes). AWS-KMS replacement
// (Phase 2 or later) implements the same KekBackend interface without
// touching application code.
//
// Symmetric primitive: AES-256-GCM · nonce 12 bytes · auth tag 16 bytes.
// Encryption context (tenant_id + purpose) is bound as Additional
// Authenticated Data (AAD) so wrapped DEKs cannot be swapped between
// tenants or purposes.

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { KekBackend, KekUnwrapRequest, KekWrapRequest, KekWrapResult } from "./interface";

const CURRENT_VERSION = "local:v1";
const KEY_ENV_VAR     = "NEX_COMMS_SOCIAL_KEK";

let cachedKey: Buffer | null = null;

function getKek(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = process.env[KEY_ENV_VAR];
  if (!raw) {
    throw new Error(
      `[comms-social/crypto] ${KEY_ENV_VAR} not set. In dev use a random 32-byte value: openssl rand -hex 32`,
    );
  }
  if (!/^[0-9a-fA-F]{64}$/.test(raw)) {
    throw new Error(`[comms-social/crypto] ${KEY_ENV_VAR} must be 64 hex characters (32 bytes)`);
  }
  cachedKey = Buffer.from(raw, "hex");
  return cachedKey;
}

function aad(tenant_id: string, purpose: string): Buffer {
  // Additional Authenticated Data binds the ciphertext to a tenant +
  // purpose. Any attempt to reuse a wrapped DEK across tenants/purposes
  // fails auth-tag verification.
  return Buffer.from(`nex-comms-social|${tenant_id}|${purpose}`, "utf8");
}

export function createLocalKekBackend(): KekBackend {
  return {
    currentVersion() { return CURRENT_VERSION; },

    async wrap(req: KekWrapRequest): Promise<KekWrapResult> {
      const kek = getKek();
      if (req.plaintext_dek.length !== 32) {
        throw new Error("[comms-social/crypto] plaintext_dek must be 32 bytes");
      }
      const nonce  = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", kek, nonce);
      cipher.setAAD(aad(req.tenant_id, req.purpose));
      const wrapped = Buffer.concat([cipher.update(req.plaintext_dek), cipher.final()]);
      const tag     = cipher.getAuthTag();
      return {
        wrapped_dek:   wrapped,
        wrap_nonce:    nonce,
        wrap_auth_tag: tag,
        kek_version:   CURRENT_VERSION,
      };
    },

    async unwrap(req: KekUnwrapRequest): Promise<Buffer> {
      if (!this.supportedVersions().includes(req.kek_version)) {
        throw new Error(`[comms-social/crypto] unsupported KEK version ${req.kek_version}`);
      }
      const kek      = getKek();
      const decipher = createDecipheriv("aes-256-gcm", kek, req.wrap_nonce);
      decipher.setAuthTag(req.wrap_auth_tag);
      decipher.setAAD(aad(req.tenant_id, req.purpose));
      return Buffer.concat([decipher.update(req.wrapped_dek), decipher.final()]);
    },

    supportedVersions() { return [CURRENT_VERSION]; },
  };
}

// Test-only affordance — reset the cached KEK so tests can rotate env
// vars between assertions. Not exported through index.ts.
export const __resetKekCacheForTests = () => { cachedKey = null; };
