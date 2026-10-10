// src/lib/nex-native/family-safety/id-verifier/id-verification-storage.ts
//
// NEX Family Safety · ID verifier · document storage.
// --------------------------------------------------------------------
// Writes ID document bytes to the SECURE PATH:
//
//   nex.id_verification_submission · metadata (opaque reference,
//     SHA256 integrity check, verifier state).
//   nex.id_document_blob            · the actual bytea payload. NEVER
//     exposed to a frontend-queryable path. The only reader is a
//     sealed admin service (`readDocumentBytesAsAdmin`) which this
//     module gates on an explicit admin-reader token.
//
// Doctrine:
//   · `document_storage_ref` is OPAQUE · never a URL. It is a
//     "nex-id-blob:<submission_id>" prefix that the admin reader
//     resolves to a bytea row.
//   · SHA256 is required at insert time · the DB enforces length 64;
//     the service layer additionally recomputes and verifies before
//     the write succeeds.
//   · `getSubmissionMetadata` NEVER returns the bytes · callers who
//     need bytes must use `readDocumentBytesAsAdmin` and provide the
//     admin reader token (opaque server-side secret).
//   · All v1 writes stamp simulated=TRUE (DB default; service refuses
//     to override).

import "server-only";

import { createHash } from "node:crypto";

import { withClient } from "@/lib/nex/db";
import type { PgClientLike } from "@/lib/nex/db";

import {
  CHILD_CREATION_ERROR_CODES,
  isIdDocumentType,
  type IdDocumentType,
  type IdVerificationOutcome,
  type IdVerificationSubmission,
} from "../child-account-creation/types";
import { selectAdapter } from "./select-adapter";

// ─────────────────────────────────────────────────────────────────────
// §1 · Internal constants + helpers
// ─────────────────────────────────────────────────────────────────────

const STORAGE_REF_PREFIX = "nex-id-blob:";
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const SHA256_HEX_LEN = 64;
const SHA256_HEX_RE = /^[0-9a-f]{64}$/;

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;
export type IdDocumentMimeType = (typeof ALLOWED_MIME_TYPES)[number];

export function isIdDocumentMimeType(v: unknown): v is IdDocumentMimeType {
  return (
    typeof v === "string" && (ALLOWED_MIME_TYPES as readonly string[]).includes(v)
  );
}

function nowIso(): string {
  return new Date().toISOString();
}

function toIso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") return new Date(v).toISOString();
  return nowIso();
}

function toIsoOrNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  return toIso(v);
}

function sha256Hex(bytes: Uint8Array): string {
  const h = createHash("sha256");
  h.update(bytes);
  return h.digest("hex");
}

function mapSubmissionRow(r: Record<string, unknown>): IdVerificationSubmission {
  const docType = String(r.document_type ?? "");
  if (!isIdDocumentType(docType)) {
    throw new Error(
      `id-verification-storage.unknown_document_type · got '${docType}' · migration drift`,
    );
  }
  const outcome = String(r.verification_outcome ?? "") as IdVerificationOutcome;
  return {
    submissionId: String(r.submission_id),
    submitterAccountId: String(r.submitter_account_id),
    documentType: docType,
    documentStorageRef: String(r.document_storage_ref),
    submittedAt: toIso(r.submitted_at),
    verifierAdapter: String(r.verifier_adapter),
    verificationOutcome: outcome,
    verifiedAt: toIsoOrNull(r.verified_at),
    verifierResponseSummaryRedacted:
      r.verifier_response_summary_redacted === null ||
      r.verifier_response_summary_redacted === undefined
        ? null
        : String(r.verifier_response_summary_redacted),
    simulated: Boolean(r.simulated),
  };
}

function requireNonEmpty(v: unknown, code: string): string {
  if (typeof v !== "string" || v.trim().length === 0) {
    throw new Error(code);
  }
  return v;
}

// ─────────────────────────────────────────────────────────────────────
// §2 · Admin reader token
// ─────────────────────────────────────────────────────────────────────

/**
 * The admin-reader token lives in the server-only environment
 * variable NEX_FAMILY_SAFETY_ID_ADMIN_READER_TOKEN. Callers of
 * `readDocumentBytesAsAdmin` MUST present the same string. The token
 * is never exposed to the frontend · a request handler that resolves
 * it must do so from the server-only secret table (future · wave
 * follow-up). For now, the operator sets it in `.env.local` and runs
 * manual verifier reviews.
 *
 * The function returns a frozen opaque reference so test fixtures
 * can override via `__TEST_ONLY_setAdminReaderTokenForTests()` without
 * mutating process.env between parallel test workers.
 */
let TEST_ONLY_ADMIN_READER_TOKEN: string | null = null;

export function __TEST_ONLY_setAdminReaderTokenForTests(token: string | null): void {
  TEST_ONLY_ADMIN_READER_TOKEN = token;
}

function readAdminReaderToken(): string | null {
  if (TEST_ONLY_ADMIN_READER_TOKEN !== null) return TEST_ONLY_ADMIN_READER_TOKEN;
  const v = process.env.NEX_FAMILY_SAFETY_ID_ADMIN_READER_TOKEN;
  if (typeof v !== "string" || v.trim().length === 0) return null;
  return v;
}

// ─────────────────────────────────────────────────────────────────────
// §3 · submitDocument
// ─────────────────────────────────────────────────────────────────────

export interface SubmitDocumentArgs {
  readonly submitterAccountId: string;
  readonly documentType: IdDocumentType;
  readonly documentBytes: Uint8Array;
  readonly mimeType: IdDocumentMimeType;
  readonly idempotencyKey: string;
}

export interface SubmitDocumentResult {
  readonly submissionId: string;
  readonly storageRef: string;
  readonly sha256: string;
}

/**
 * Writes the document bytes + metadata atomically:
 *   1. Compute SHA256 (service-layer integrity check).
 *   2. Call the sealed adapter.submit() to obtain a provisional
 *      submission id. (Stub adapter returns a fresh UUID; a real
 *      vendor would return their own id.)
 *   3. INSERT into id_verification_submission (opaque storage_ref,
 *      sha256, pending outcome).
 *   4. INSERT bytea into id_document_blob (FK to submission).
 *
 * Idempotency: when a row already exists for `idempotency_key`, we
 * return the existing row unchanged (no second blob write).
 */
export async function submitDocument(
  args: SubmitDocumentArgs,
): Promise<SubmitDocumentResult> {
  requireNonEmpty(args.submitterAccountId, CHILD_CREATION_ERROR_CODES.INVALID_PARENT);
  requireNonEmpty(args.idempotencyKey, CHILD_CREATION_ERROR_CODES.INVALID_IDEMPOTENCY_KEY);
  if (!isIdDocumentType(args.documentType)) {
    throw new Error(CHILD_CREATION_ERROR_CODES.INVALID_MIME);
  }
  if (!isIdDocumentMimeType(args.mimeType)) {
    throw new Error(CHILD_CREATION_ERROR_CODES.INVALID_MIME);
  }
  if (!(args.documentBytes instanceof Uint8Array) || args.documentBytes.length === 0) {
    throw new Error(CHILD_CREATION_ERROR_CODES.BYTES_EMPTY);
  }
  if (args.documentBytes.length > MAX_BYTES) {
    throw new Error(CHILD_CREATION_ERROR_CODES.BYTES_TOO_LARGE);
  }

  const sha256 = sha256Hex(args.documentBytes);
  if (!SHA256_HEX_RE.test(sha256)) {
    // defensive · unreachable in practice
    throw new Error(CHILD_CREATION_ERROR_CODES.INVALID_SHA256);
  }

  const adapter = selectAdapter();
  const submitted = await adapter.submit({
    submitterAccountId: args.submitterAccountId,
    documentType: args.documentType,
    documentBytes: args.documentBytes,
    idempotencyKey: args.idempotencyKey,
  });

  const storageRef = `${STORAGE_REF_PREFIX}${submitted.submissionId}`;

  const result = await withClient(async (c: PgClientLike) => {
    // Idempotency check: existing row for this idempotency_key wins.
    const existing = await c.query(
      `SELECT submission_id, document_storage_ref, document_bytes_sha256
         FROM nex.id_verification_submission
        WHERE idempotency_key = $1`,
      [args.idempotencyKey],
    );
    if ((existing.rowCount ?? 0) > 0) {
      const row = existing.rows[0];
      return {
        submissionId: String(row.submission_id),
        storageRef: String(row.document_storage_ref),
        sha256: String(row.document_bytes_sha256),
      };
    }

    await c.query(
      `INSERT INTO nex.id_verification_submission (
         submission_id,
         submitter_account_id,
         document_type,
         document_storage_ref,
         document_bytes_sha256,
         idempotency_key,
         verifier_adapter,
         verification_outcome,
         simulated
       )
       VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, 'pending', TRUE)`,
      [
        submitted.submissionId,
        args.submitterAccountId,
        args.documentType,
        storageRef,
        sha256,
        args.idempotencyKey,
        adapter.adapterName,
      ],
    );

    await c.query(
      `INSERT INTO nex.id_document_blob (submission_id, document_bytes, mime_type)
       VALUES ($1::uuid, $2::bytea, $3)`,
      [submitted.submissionId, Buffer.from(args.documentBytes), args.mimeType],
    );

    return {
      submissionId: submitted.submissionId,
      storageRef,
      sha256,
    };
  });

  if (!result) {
    // DB unavailable · we never return "success without a row".
    throw new Error("id-verification-storage.db_unavailable");
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────
// §4 · getSubmissionMetadata · NEVER returns bytes
// ─────────────────────────────────────────────────────────────────────

/**
 * Metadata-only read. The viewer MUST be the submitter OR the submission
 * must be owned via an open creation request where the viewer is the
 * parent. For the primitive layer, we enforce `viewer === submitter`;
 * the creation-request service does the cross-check for the request
 * surface.
 */
export async function getSubmissionMetadata(
  submissionId: string,
  viewerAccountId: string,
): Promise<IdVerificationSubmission | null> {
  requireNonEmpty(submissionId, CHILD_CREATION_ERROR_CODES.SUBMISSION_NOT_FOUND);
  requireNonEmpty(viewerAccountId, CHILD_CREATION_ERROR_CODES.INVALID_ACTOR);

  const row = await withClient(async (c: PgClientLike) => {
    const r = await c.query(
      `SELECT * FROM nex.id_verification_submission
        WHERE submission_id = $1::uuid`,
      [submissionId],
    );
    if ((r.rowCount ?? 0) === 0) return null;
    return r.rows[0];
  });
  if (!row) return null;
  if (String(row.submitter_account_id) !== viewerAccountId) return null;
  return mapSubmissionRow(row);
}

// ─────────────────────────────────────────────────────────────────────
// §5 · readDocumentBytesAsAdmin · strict access control
// ─────────────────────────────────────────────────────────────────────

export interface AdminBytesReadResult {
  readonly submissionId: string;
  readonly mimeType: string;
  readonly bytes: Uint8Array;
  readonly sha256: string;
}

/**
 * The ONLY path that returns the raw bytes. GATED on the admin reader
 * token · the frontend NEVER has it. The operator presents the token
 * through an internal admin surface before running a verifier review.
 *
 * We re-verify the SHA256 before returning · if the on-disk bytes do
 * not match the stored hash, we throw SHA256_MISMATCH rather than
 * silently returning potentially-tampered bytes.
 */
export async function readDocumentBytesAsAdmin(args: {
  readonly submissionId: string;
  readonly adminReaderToken: string;
}): Promise<AdminBytesReadResult> {
  requireNonEmpty(args.submissionId, CHILD_CREATION_ERROR_CODES.SUBMISSION_NOT_FOUND);
  requireNonEmpty(args.adminReaderToken, CHILD_CREATION_ERROR_CODES.ADMIN_READER_REQUIRED);

  const expected = readAdminReaderToken();
  if (expected === null || args.adminReaderToken !== expected) {
    throw new Error(CHILD_CREATION_ERROR_CODES.ADMIN_READER_REQUIRED);
  }

  const row = await withClient(async (c: PgClientLike) => {
    const r = await c.query(
      `SELECT s.submission_id, s.document_bytes_sha256,
              b.document_bytes, b.mime_type
         FROM nex.id_verification_submission s
         JOIN nex.id_document_blob b USING (submission_id)
        WHERE s.submission_id = $1::uuid`,
      [args.submissionId],
    );
    if ((r.rowCount ?? 0) === 0) return null;
    return r.rows[0];
  });
  if (!row) throw new Error(CHILD_CREATION_ERROR_CODES.BLOB_NOT_FOUND);

  const bytes = row.document_bytes instanceof Uint8Array
    ? row.document_bytes
    : row.document_bytes instanceof Buffer
      ? new Uint8Array(row.document_bytes.buffer, row.document_bytes.byteOffset, row.document_bytes.byteLength)
      : new Uint8Array(0);

  const sha256 = sha256Hex(bytes);
  if (sha256 !== String(row.document_bytes_sha256)) {
    throw new Error(CHILD_CREATION_ERROR_CODES.SHA256_MISMATCH);
  }

  return {
    submissionId: String(row.submission_id),
    mimeType: String(row.mime_type),
    bytes,
    sha256,
  };
}

// Re-export the storage-ref prefix for test inspection + boundary assertions.
export const __STORAGE_REF_PREFIX = STORAGE_REF_PREFIX;
export const __MAX_BYTES = MAX_BYTES;
export const __SHA256_HEX_LEN = SHA256_HEX_LEN;
