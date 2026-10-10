// src/lib/nex-native/family-safety/id-verifier/id-verification-storage.test.ts
//
// Unit tests for the ID-verification storage module. Validates that
// bytes are written to id_document_blob (not surfaced to frontend
// paths), that SHA256 integrity is enforced, and that the admin
// reader token is required for raw-bytes access.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";

type QueryResponder = (
  sql: string,
  params: readonly unknown[],
) => { rows: Record<string, unknown>[]; rowCount: number };

let withClientCalls: Array<{ sql: string; params: readonly unknown[] }>;
let withClientResponder: QueryResponder | null;
let withClientUnavailable: boolean;

vi.mock("@/lib/nex/db", () => ({
  withClient: async <T>(fn: (c: unknown) => Promise<T>): Promise<T | null> => {
    if (withClientUnavailable) return null;
    const client = {
      query: async (sql: string, params?: readonly unknown[]) => {
        withClientCalls.push({ sql, params: params ?? [] });
        if (withClientResponder) return withClientResponder(sql, params ?? []);
        return { rows: [], rowCount: 0 };
      },
    };
    return (await fn(client)) ?? null;
  },
}));

import {
  __TEST_ONLY_setAdminReaderTokenForTests,
  __MAX_BYTES,
  __STORAGE_REF_PREFIX,
  getSubmissionMetadata,
  readDocumentBytesAsAdmin,
  submitDocument,
} from "./id-verification-storage";
import { CHILD_CREATION_ERROR_CODES } from "../child-account-creation/types";

const PARENT = "parent-11111111-1111-4111-8111-111111111111";
const OTHER = "other-22222222-2222-4222-8222-222222222222";
const SOME_BYTES = new Uint8Array([
  0x49, 0x44, 0x45, 0x4e, 0x54, 0x49, 0x54, 0x59, 0x5f, 0x44, 0x4f, 0x43,
]);
const SOME_SHA = createHash("sha256").update(SOME_BYTES).digest("hex");

beforeEach(() => {
  withClientCalls = [];
  withClientResponder = null;
  withClientUnavailable = false;
  __TEST_ONLY_setAdminReaderTokenForTests(null);
});

afterEach(() => {
  __TEST_ONLY_setAdminReaderTokenForTests(null);
});

// ─────────────────────────────────────────────────────────────────────
// submitDocument
// ─────────────────────────────────────────────────────────────────────

describe("submitDocument · validation + hashing", () => {
  it("rejects empty bytes", async () => {
    await expect(
      submitDocument({
        submitterAccountId: PARENT,
        documentType: "indonesian_kk",
        documentBytes: new Uint8Array(0),
        mimeType: "image/jpeg",
        idempotencyKey: "k1",
      }),
    ).rejects.toThrow(CHILD_CREATION_ERROR_CODES.BYTES_EMPTY);
  });

  it("rejects bytes > 10 MB", async () => {
    const bytes = new Uint8Array(__MAX_BYTES + 1);
    await expect(
      submitDocument({
        submitterAccountId: PARENT,
        documentType: "passport",
        documentBytes: bytes,
        mimeType: "image/png",
        idempotencyKey: "k1",
      }),
    ).rejects.toThrow(CHILD_CREATION_ERROR_CODES.BYTES_TOO_LARGE);
  });

  it("rejects invalid MIME type", async () => {
    await expect(
      submitDocument({
        submitterAccountId: PARENT,
        documentType: "passport",
        documentBytes: SOME_BYTES,
        // @ts-expect-error purposefully invalid
        mimeType: "image/gif",
        idempotencyKey: "k1",
      }),
    ).rejects.toThrow(CHILD_CREATION_ERROR_CODES.INVALID_MIME);
  });

  it("rejects empty idempotencyKey", async () => {
    await expect(
      submitDocument({
        submitterAccountId: PARENT,
        documentType: "passport",
        documentBytes: SOME_BYTES,
        mimeType: "image/png",
        idempotencyKey: "",
      }),
    ).rejects.toThrow(CHILD_CREATION_ERROR_CODES.INVALID_IDEMPOTENCY_KEY);
  });

  it("rejects empty submitterAccountId", async () => {
    await expect(
      submitDocument({
        submitterAccountId: "",
        documentType: "passport",
        documentBytes: SOME_BYTES,
        mimeType: "image/png",
        idempotencyKey: "k1",
      }),
    ).rejects.toThrow(CHILD_CREATION_ERROR_CODES.INVALID_PARENT);
  });
});

describe("submitDocument · insert path", () => {
  it("inserts into id_verification_submission AND id_document_blob", async () => {
    withClientResponder = (sql) => {
      if (/SELECT submission_id/.test(sql)) return { rows: [], rowCount: 0 };
      if (/INSERT INTO nex\.id_verification_submission/i.test(sql)) {
        return { rows: [], rowCount: 1 };
      }
      if (/INSERT INTO nex\.id_document_blob/i.test(sql)) {
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    };
    const result = await submitDocument({
      submitterAccountId: PARENT,
      documentType: "indonesian_kk",
      documentBytes: SOME_BYTES,
      mimeType: "image/png",
      idempotencyKey: "idem-abc",
    });
    expect(result.sha256).toBe(SOME_SHA);
    expect(result.storageRef.startsWith(__STORAGE_REF_PREFIX)).toBe(true);
    const sawSubmission = withClientCalls.some((c) =>
      /INSERT INTO nex\.id_verification_submission/i.test(c.sql),
    );
    const sawBlob = withClientCalls.some((c) =>
      /INSERT INTO nex\.id_document_blob/i.test(c.sql),
    );
    expect(sawSubmission).toBe(true);
    expect(sawBlob).toBe(true);
  });

  it("insert uses simulated=TRUE and stub adapter name", async () => {
    withClientResponder = (sql) => {
      if (/SELECT submission_id/.test(sql)) return { rows: [], rowCount: 0 };
      return { rows: [], rowCount: 1 };
    };
    await submitDocument({
      submitterAccountId: PARENT,
      documentType: "passport",
      documentBytes: SOME_BYTES,
      mimeType: "application/pdf",
      idempotencyKey: "idem-xyz",
    });
    const submitInsert = withClientCalls.find((c) =>
      /INSERT INTO nex\.id_verification_submission/i.test(c.sql),
    );
    expect(submitInsert).toBeTruthy();
    expect(submitInsert?.sql).toMatch(/TRUE\)/);
    expect(submitInsert?.params).toContain("stub_pending_vendor");
  });

  it("returns existing row when idempotency_key already present", async () => {
    const prior = {
      submission_id: "prior-id",
      document_storage_ref: `${__STORAGE_REF_PREFIX}prior-id`,
      document_bytes_sha256: SOME_SHA,
    };
    withClientResponder = (sql) => {
      if (/SELECT submission_id/.test(sql)) return { rows: [prior], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    };
    const result = await submitDocument({
      submitterAccountId: PARENT,
      documentType: "passport",
      documentBytes: SOME_BYTES,
      mimeType: "image/png",
      idempotencyKey: "idem-prior",
    });
    expect(result.submissionId).toBe("prior-id");
    const inserts = withClientCalls.filter((c) => /INSERT/i.test(c.sql));
    expect(inserts.length).toBe(0);
  });

  it("computes SHA256 that matches node:crypto baseline", async () => {
    withClientResponder = (sql) => {
      if (/SELECT submission_id/.test(sql)) return { rows: [], rowCount: 0 };
      return { rows: [], rowCount: 1 };
    };
    const result = await submitDocument({
      submitterAccountId: PARENT,
      documentType: "indonesian_akta",
      documentBytes: SOME_BYTES,
      mimeType: "image/webp",
      idempotencyKey: "idem-sha",
    });
    expect(result.sha256).toBe(SOME_SHA);
    expect(result.sha256.length).toBe(64);
    expect(/^[0-9a-f]{64}$/.test(result.sha256)).toBe(true);
  });

  it("storageRef is opaque (nex-id-blob prefix) · never a URL", async () => {
    withClientResponder = (sql) => {
      if (/SELECT submission_id/.test(sql)) return { rows: [], rowCount: 0 };
      return { rows: [], rowCount: 1 };
    };
    const result = await submitDocument({
      submitterAccountId: PARENT,
      documentType: "indonesian_akta",
      documentBytes: SOME_BYTES,
      mimeType: "image/webp",
      idempotencyKey: "idem-url",
    });
    expect(result.storageRef).not.toMatch(/^https?:\/\//);
    expect(result.storageRef.startsWith(__STORAGE_REF_PREFIX)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────
// getSubmissionMetadata
// ─────────────────────────────────────────────────────────────────────

describe("getSubmissionMetadata · never returns bytes", () => {
  it("returns metadata (no document_bytes field) for the owner", async () => {
    const row = {
      submission_id: "sub-1",
      submitter_account_id: PARENT,
      document_type: "passport",
      document_storage_ref: `${__STORAGE_REF_PREFIX}sub-1`,
      submitted_at: new Date("2026-10-10T10:00:00Z"),
      verifier_adapter: "stub_pending_vendor",
      verification_outcome: "pending",
      verified_at: null,
      verifier_response_summary_redacted: null,
      simulated: true,
    };
    withClientResponder = () => ({ rows: [row], rowCount: 1 });
    const result = await getSubmissionMetadata("sub-1", PARENT);
    expect(result).not.toBeNull();
    expect(result?.submissionId).toBe("sub-1");
    // Shape guard · the row shape does not expose a 'documentBytes' key.
    expect("documentBytes" in (result ?? {})).toBe(false);
    expect(withClientCalls[0].sql).not.toMatch(/id_document_blob/i);
  });

  it("returns null when viewer is not the submitter", async () => {
    const row = {
      submission_id: "sub-1",
      submitter_account_id: OTHER,
      document_type: "passport",
      document_storage_ref: "nex-id-blob:sub-1",
      submitted_at: new Date(),
      verifier_adapter: "stub_pending_vendor",
      verification_outcome: "pending",
      verified_at: null,
      verifier_response_summary_redacted: null,
      simulated: true,
    };
    withClientResponder = () => ({ rows: [row], rowCount: 1 });
    const result = await getSubmissionMetadata("sub-1", PARENT);
    expect(result).toBeNull();
  });

  it("returns null when the submission is missing", async () => {
    withClientResponder = () => ({ rows: [], rowCount: 0 });
    const result = await getSubmissionMetadata("missing", PARENT);
    expect(result).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────
// readDocumentBytesAsAdmin
// ─────────────────────────────────────────────────────────────────────

describe("readDocumentBytesAsAdmin · strict access control", () => {
  it("throws ADMIN_READER_REQUIRED when no server token is set", async () => {
    __TEST_ONLY_setAdminReaderTokenForTests(null);
    await expect(
      readDocumentBytesAsAdmin({
        submissionId: "sub-1",
        adminReaderToken: "any-token",
      }),
    ).rejects.toThrow(CHILD_CREATION_ERROR_CODES.ADMIN_READER_REQUIRED);
  });

  it("throws ADMIN_READER_REQUIRED when token mismatch", async () => {
    __TEST_ONLY_setAdminReaderTokenForTests("correct-token");
    await expect(
      readDocumentBytesAsAdmin({
        submissionId: "sub-1",
        adminReaderToken: "wrong-token",
      }),
    ).rejects.toThrow(CHILD_CREATION_ERROR_CODES.ADMIN_READER_REQUIRED);
  });

  it("throws ADMIN_READER_REQUIRED when adminReaderToken is empty", async () => {
    __TEST_ONLY_setAdminReaderTokenForTests("correct-token");
    await expect(
      readDocumentBytesAsAdmin({ submissionId: "sub-1", adminReaderToken: "" }),
    ).rejects.toThrow(CHILD_CREATION_ERROR_CODES.ADMIN_READER_REQUIRED);
  });

  it("returns bytes when token matches AND SHA256 verifies", async () => {
    __TEST_ONLY_setAdminReaderTokenForTests("correct-token");
    withClientResponder = () => ({
      rows: [
        {
          submission_id: "sub-1",
          document_bytes_sha256: SOME_SHA,
          document_bytes: Buffer.from(SOME_BYTES),
          mime_type: "image/png",
        },
      ],
      rowCount: 1,
    });
    const result = await readDocumentBytesAsAdmin({
      submissionId: "sub-1",
      adminReaderToken: "correct-token",
    });
    expect(result.submissionId).toBe("sub-1");
    expect(result.mimeType).toBe("image/png");
    expect(result.sha256).toBe(SOME_SHA);
    expect(result.bytes).toBeInstanceOf(Uint8Array);
  });

  it("throws SHA256_MISMATCH when stored hash disagrees with bytes", async () => {
    __TEST_ONLY_setAdminReaderTokenForTests("correct-token");
    const wrongHash = "0".repeat(64);
    withClientResponder = () => ({
      rows: [
        {
          submission_id: "sub-1",
          document_bytes_sha256: wrongHash,
          document_bytes: Buffer.from(SOME_BYTES),
          mime_type: "image/png",
        },
      ],
      rowCount: 1,
    });
    await expect(
      readDocumentBytesAsAdmin({
        submissionId: "sub-1",
        adminReaderToken: "correct-token",
      }),
    ).rejects.toThrow(CHILD_CREATION_ERROR_CODES.SHA256_MISMATCH);
  });

  it("throws BLOB_NOT_FOUND when the submission has no blob row", async () => {
    __TEST_ONLY_setAdminReaderTokenForTests("correct-token");
    withClientResponder = () => ({ rows: [], rowCount: 0 });
    await expect(
      readDocumentBytesAsAdmin({
        submissionId: "sub-1",
        adminReaderToken: "correct-token",
      }),
    ).rejects.toThrow(CHILD_CREATION_ERROR_CODES.BLOB_NOT_FOUND);
  });

  it("joins against id_document_blob · readDocumentBytesAsAdmin is the ONLY code path that touches the blob table", async () => {
    __TEST_ONLY_setAdminReaderTokenForTests("correct-token");
    withClientResponder = () => ({
      rows: [
        {
          submission_id: "sub-1",
          document_bytes_sha256: SOME_SHA,
          document_bytes: Buffer.from(SOME_BYTES),
          mime_type: "image/png",
        },
      ],
      rowCount: 1,
    });
    await readDocumentBytesAsAdmin({
      submissionId: "sub-1",
      adminReaderToken: "correct-token",
    });
    expect(withClientCalls[0].sql).toMatch(/JOIN\s+nex\.id_document_blob/i);
  });
});
