// src/lib/nex/review-queue/review-queue.test.ts
//
// Stage 6 · change-request validation tests.

import { describe, it, expect } from "vitest";
import { validateChangeRequest } from "./index";
import type { ChangeRequestInput } from "./index";

const validUuid = "12345678-1234-1234-1234-123456789012";

const baseInput = (overrides: Partial<ChangeRequestInput> = {}): ChangeRequestInput => ({
  targetCapabilityId: "CAP-091",
  targetRevisionId: validUuid,
  founderMessage: "Please increase the padding of the header card",
  attachedManifestIds: [],
  founderSignature: "founder-sig-abc",
  ...overrides,
});

describe("validateChangeRequest", () => {
  it("accepts a well-formed request", () => {
    expect(validateChangeRequest(baseInput()).ok).toBe(true);
  });

  it("rejects malformed capability", () => {
    const r = validateChangeRequest(baseInput({ targetCapabilityId: "cap-1" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("sec.change_request_bad_capability");
  });

  it("rejects malformed revision UUID", () => {
    const r = validateChangeRequest(baseInput({ targetRevisionId: "not-a-uuid" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("sec.change_request_bad_revision_id");
  });

  it("rejects empty founder message", () => {
    const r = validateChangeRequest(baseInput({ founderMessage: "" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("sec.change_request_empty_message");
  });

  it("rejects too-short founder message", () => {
    const r = validateChangeRequest(baseInput({ founderMessage: "hi" }));
    expect(r.ok).toBe(false);
  });

  it("rejects too-long founder message", () => {
    const r = validateChangeRequest(baseInput({ founderMessage: "x".repeat(9000) }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("sec.change_request_message_too_long");
  });

  it("rejects missing signature", () => {
    const r = validateChangeRequest(baseInput({ founderSignature: "" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("sec.change_request_missing_signature");
  });

  it("rejects too many attachments", () => {
    const many = Array.from({ length: 40 }, (_, i) => `img_${i}`);
    const r = validateChangeRequest(baseInput({ attachedManifestIds: many }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("sec.change_request_too_many_attachments");
  });

  it("rejects manifest id with bad chars", () => {
    const r = validateChangeRequest(baseInput({ attachedManifestIds: ["hello world"] }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("sec.change_request_bad_manifest_id");
  });

  it("accepts valid manifest ids", () => {
    const r = validateChangeRequest(
      baseInput({ attachedManifestIds: ["img_abc", "img-123", "IMG_XYZ_42"] }),
    );
    expect(r.ok).toBe(true);
  });
});
