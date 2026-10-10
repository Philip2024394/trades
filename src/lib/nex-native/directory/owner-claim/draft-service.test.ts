// src/lib/nex-native/directory/owner-claim/draft-service.test.ts
//
// NEX Directory - Owner Claim - draft-service tests.
//
// Scope
//   - Guards (fingerprint length, blank canonical id, invalid channel,
//     invalid destination length / content)
//   - SQL shape (via a mocked withClient capturing query text + params)
//   - Status transition semantics (updateContact promotes
//     draft->contact_pending but never regresses verified->something)
//   - Doctrine 7 observed: no draft_json content in logs (we spy on
//     console.log and assert it never prints the draft payload)
//
// This test file does NOT:
//   - Touch the real DB. We mock @/lib/nex/db.withClient.
//   - Touch the network or filesystem.
//
// NB: the production module declares `import "server-only"`. The
// vitest config aliases that to src/test/emptyModule.ts so the import
// resolves at test time.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the shared pg pool. The service only consumes `withClient`;
// we expose a captured-calls API so each test can assert what SQL
// was issued + swap in per-test return values.
let withClientCalls: Array<{ sql: string; params: readonly unknown[] }>;
let withClientResponse: ((sql: string, params: readonly unknown[]) => unknown) | null;
let withClientRaw: ((client: unknown) => Promise<unknown>) | null;

vi.mock("@/lib/nex/db", () => ({
  withClient: async <T>(fn: (c: unknown) => Promise<T>): Promise<T | null> => {
    withClientRaw = fn as unknown as (client: unknown) => Promise<unknown>;
    const client = {
      query: async (sql: string, params?: readonly unknown[]) => {
        withClientCalls.push({ sql, params: params ?? [] });
        if (withClientResponse) {
          return withClientResponse(sql, params ?? []) as {
            rows: Record<string, unknown>[];
            rowCount: number | null;
          };
        }
        return { rows: [], rowCount: 0 };
      },
    };
    return (await fn(client)) ?? null;
  },
}));

// Import AFTER mocks.
import {
  loadDraft,
  saveDraft,
  updateContact,
  transitionStatus,
  listDraftsForCanonical,
  isClaimDraftStatus,
  CLAIM_DRAFT_STATUSES,
} from "./draft-service";
import type { OwnerClaimDraft } from "./types";

// =====================================================================
// Shared fixtures
// =====================================================================

const VALID_CANONICAL = "11111111-1111-4111-8111-111111111111";
const VALID_FINGERPRINT = "anon:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

const SAMPLE_FOOD_DRAFT: OwnerClaimDraft = {
  kind: "food",
  cuisines: ["Padang", "Street Food"],
  dietary: ["halal"],
  menuSections: [],
  openingHours: [1, 2, 3, 4, 5, 6, 7].map((d) => ({
    day: d as 1 | 2 | 3 | 4 | 5 | 6 | 7,
    closed: d > 5,
    open: d <= 5 ? "09:00" : "",
    close: d <= 5 ? "21:00" : "",
  })),
  description: "Family-run warung since 1998",
};

function sampleRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const base: Record<string, unknown> = {
    draft_id: "d1",
    canonical_business_id: VALID_CANONICAL,
    draft_fingerprint: VALID_FINGERPRINT,
    draft_json: SAMPLE_FOOD_DRAFT,
    contact_channel: null,
    contact_destination: null,
    status: "draft",
    status_reason: null,
    last_touched_at: new Date("2026-10-10T10:00:00Z"),
    expires_at: new Date("2026-11-09T10:00:00Z"),
    created_at: new Date("2026-10-10T10:00:00Z"),
  };
  return { ...base, ...overrides };
}

beforeEach(() => {
  withClientCalls = [];
  withClientResponse = null;
  withClientRaw = null;
});

afterEach(() => {
  vi.restoreAllMocks();
});

// =====================================================================
// Section 1 - Enum export + type guard
// =====================================================================

describe("CLAIM_DRAFT_STATUSES enum", () => {
  it("exports the sealed 7 states in migration-190 order", () => {
    expect(CLAIM_DRAFT_STATUSES).toEqual([
      "draft",
      "contact_pending",
      "code_requested",
      "verified",
      "abandoned",
      "rejected",
      "blocked",
    ]);
  });

  it("isClaimDraftStatus accepts the 7 sealed values and rejects others", () => {
    for (const s of CLAIM_DRAFT_STATUSES) {
      expect(isClaimDraftStatus(s)).toBe(true);
    }
    expect(isClaimDraftStatus("DRAFT")).toBe(false);
    expect(isClaimDraftStatus("pending")).toBe(false);
    expect(isClaimDraftStatus("")).toBe(false);
  });
});

// =====================================================================
// Section 2 - Argument guards
// =====================================================================

describe("argument guards", () => {
  it("loadDraft rejects a blank canonicalId", async () => {
    await expect(
      loadDraft({ canonicalId: "", fingerprint: VALID_FINGERPRINT }),
    ).rejects.toThrow("blank_canonical_id");
  });

  it("loadDraft rejects a too-short fingerprint", async () => {
    await expect(
      loadDraft({ canonicalId: VALID_CANONICAL, fingerprint: "abc" }),
    ).rejects.toThrow("invalid_fingerprint");
  });

  it("loadDraft rejects a too-long fingerprint", async () => {
    await expect(
      loadDraft({
        canonicalId: VALID_CANONICAL,
        fingerprint: "a".repeat(129),
      }),
    ).rejects.toThrow("invalid_fingerprint");
  });

  it("saveDraft rejects a draft missing the kind discriminator", async () => {
    await expect(
      saveDraft({
        canonicalId: VALID_CANONICAL,
        fingerprint: VALID_FINGERPRINT,
        draft: {} as OwnerClaimDraft,
      }),
    ).rejects.toThrow("invalid_draft_shape");
  });

  it("saveDraft rejects an invalid status override", async () => {
    await expect(
      saveDraft({
        canonicalId: VALID_CANONICAL,
        fingerprint: VALID_FINGERPRINT,
        draft: SAMPLE_FOOD_DRAFT,
        status: "DRAFT" as unknown as "draft",
      }),
    ).rejects.toThrow("invalid_status");
  });

  it("updateContact rejects an invalid channel", async () => {
    await expect(
      updateContact({
        canonicalId: VALID_CANONICAL,
        fingerprint: VALID_FINGERPRINT,
        channel: "pager" as unknown as "sms",
        destination: "+62 812 3456 7890",
      }),
    ).rejects.toThrow("invalid_channel");
  });

  it("updateContact rejects a blank destination", async () => {
    await expect(
      updateContact({
        canonicalId: VALID_CANONICAL,
        fingerprint: VALID_FINGERPRINT,
        channel: "email",
        destination: "   ",
      }),
    ).rejects.toThrow("invalid_destination");
  });

  it("updateContact rejects a destination over 160 chars", async () => {
    await expect(
      updateContact({
        canonicalId: VALID_CANONICAL,
        fingerprint: VALID_FINGERPRINT,
        channel: "email",
        destination: "a".repeat(161),
      }),
    ).rejects.toThrow("invalid_destination");
  });

  it("transitionStatus rejects an invalid nextStatus", async () => {
    await expect(
      transitionStatus({
        canonicalId: VALID_CANONICAL,
        fingerprint: VALID_FINGERPRINT,
        nextStatus: "COMPLETED" as unknown as "verified",
      }),
    ).rejects.toThrow("invalid_status");
  });
});

// =====================================================================
// Section 3 - loadDraft SQL shape + row mapping
// =====================================================================

describe("loadDraft", () => {
  it("issues a SELECT scoped by canonical_business_id + fingerprint + non-expired", async () => {
    withClientResponse = () => ({ rows: [sampleRow()], rowCount: 1 });
    const row = await loadDraft({
      canonicalId: VALID_CANONICAL,
      fingerprint: VALID_FINGERPRINT,
    });
    expect(row).not.toBeNull();
    expect(row?.canonical_business_id).toBe(VALID_CANONICAL);
    expect(row?.status).toBe("draft");

    // Doctrine: the loaded SQL filters by canonical + fingerprint +
    // expires_at > now() so expired drafts never leak.
    const call = withClientCalls[0];
    expect(call.sql).toMatch(/FROM\s+nex\.business_claim_draft/i);
    expect(call.sql).toMatch(/canonical_business_id\s*=\s*\$1/i);
    expect(call.sql).toMatch(/draft_fingerprint\s*=\s*\$2/i);
    expect(call.sql).toMatch(/expires_at\s*>\s*now\(\)/i);
    expect(call.params).toEqual([VALID_CANONICAL, VALID_FINGERPRINT]);
  });

  it("returns null when the pool returns no rows", async () => {
    withClientResponse = () => ({ rows: [], rowCount: 0 });
    const row = await loadDraft({
      canonicalId: VALID_CANONICAL,
      fingerprint: VALID_FINGERPRINT,
    });
    expect(row).toBeNull();
  });

  it("throws when an unknown status is seen on the row (fail loud, never coerce)", async () => {
    withClientResponse = () => ({
      rows: [sampleRow({ status: "COMPLETED" })],
      rowCount: 1,
    });
    await expect(
      loadDraft({ canonicalId: VALID_CANONICAL, fingerprint: VALID_FINGERPRINT }),
    ).rejects.toThrow("unknown_status");
  });
});

// =====================================================================
// Section 4 - saveDraft SQL shape (UPSERT contract)
// =====================================================================

describe("saveDraft", () => {
  it("UPSERTs on (canonical_business_id, draft_fingerprint) and preserves status when caller omits it", async () => {
    withClientResponse = () => ({ rows: [], rowCount: 1 });
    await saveDraft({
      canonicalId: VALID_CANONICAL,
      fingerprint: VALID_FINGERPRINT,
      draft: SAMPLE_FOOD_DRAFT,
    });

    const call = withClientCalls[0];
    expect(call.sql).toMatch(/INSERT\s+INTO\s+nex\.business_claim_draft/i);
    expect(call.sql).toMatch(/ON\s+CONFLICT\s*\(\s*canonical_business_id\s*,\s*draft_fingerprint\s*\)/i);
    expect(call.sql).toMatch(/draft_json\s*=\s*EXCLUDED\.draft_json/i);
    expect(call.sql).toMatch(/last_touched_at\s*=\s*now\(\)/i);
    // When caller omits status, UPDATE path preserves existing status
    // via COALESCE($4, existing_status).
    expect(call.sql).toMatch(/COALESCE\s*\(\s*\$4\s*,\s*nex\.business_claim_draft\.status\s*\)/i);
    expect(call.params[0]).toBe(VALID_CANONICAL);
    expect(call.params[1]).toBe(VALID_FINGERPRINT);
    expect(call.params[3]).toBeNull(); // omitted status
  });

  it("passes an explicit status override through to the UPSERT", async () => {
    withClientResponse = () => ({ rows: [], rowCount: 1 });
    await saveDraft({
      canonicalId: VALID_CANONICAL,
      fingerprint: VALID_FINGERPRINT,
      draft: SAMPLE_FOOD_DRAFT,
      status: "contact_pending",
    });
    const call = withClientCalls[0];
    expect(call.params[3]).toBe("contact_pending");
  });

  it("stringifies draft_json before send (never passes a JS object straight to the driver)", async () => {
    withClientResponse = () => ({ rows: [], rowCount: 1 });
    await saveDraft({
      canonicalId: VALID_CANONICAL,
      fingerprint: VALID_FINGERPRINT,
      draft: SAMPLE_FOOD_DRAFT,
    });
    const call = withClientCalls[0];
    expect(typeof call.params[2]).toBe("string");
    expect(JSON.parse(String(call.params[2]))).toEqual(SAMPLE_FOOD_DRAFT);
  });
});

// =====================================================================
// Section 5 - updateContact (status machine)
// =====================================================================

describe("updateContact", () => {
  it("promotes draft -> contact_pending via CASE WHEN never regressing verified rows", async () => {
    withClientResponse = () => ({ rows: [], rowCount: 1 });
    await updateContact({
      canonicalId: VALID_CANONICAL,
      fingerprint: VALID_FINGERPRINT,
      channel: "email",
      destination: "owner@example.com",
    });
    const call = withClientCalls[0];
    expect(call.sql).toMatch(/UPDATE\s+nex\.business_claim_draft/i);
    expect(call.sql).toMatch(/CASE[\s\S]{1,200}'contact_pending'[\s\S]{1,200}ELSE\s+status\s+END/i);
    // The CASE only promotes from draft/contact_pending; any other
    // existing state (code_requested, verified, blocked, etc.) is
    // preserved.
    expect(call.sql).toMatch(/status\s+IN\s*\(\s*'draft'\s*,\s*'contact_pending'\s*\)/i);
    expect(call.params[2]).toBe("email");
    expect(call.params[3]).toBe("owner@example.com");
  });

  it("throws draft_not_found when no row matches", async () => {
    withClientResponse = () => ({ rows: [], rowCount: 0 });
    await expect(
      updateContact({
        canonicalId: VALID_CANONICAL,
        fingerprint: VALID_FINGERPRINT,
        channel: "email",
        destination: "owner@example.com",
      }),
    ).rejects.toThrow("draft_not_found");
  });
});

// =====================================================================
// Section 6 - transitionStatus (explicit lifecycle)
// =====================================================================

describe("transitionStatus", () => {
  it("writes the given status + reason", async () => {
    withClientResponse = () => ({ rows: [], rowCount: 1 });
    await transitionStatus({
      canonicalId: VALID_CANONICAL,
      fingerprint: VALID_FINGERPRINT,
      nextStatus: "blocked",
      reason: "channel_adapter_not_implemented:sms",
    });
    const call = withClientCalls[0];
    expect(call.sql).toMatch(/SET\s+status\s*=\s*\$3/i);
    expect(call.params[2]).toBe("blocked");
    expect(call.params[3]).toBe("channel_adapter_not_implemented:sms");
  });

  it("caps reason at 300 chars", async () => {
    withClientResponse = () => ({ rows: [], rowCount: 1 });
    await transitionStatus({
      canonicalId: VALID_CANONICAL,
      fingerprint: VALID_FINGERPRINT,
      nextStatus: "rejected",
      reason: "x".repeat(400),
    });
    const call = withClientCalls[0];
    expect((call.params[3] as string).length).toBe(300);
  });

  it("throws draft_not_found when no row matches", async () => {
    withClientResponse = () => ({ rows: [], rowCount: 0 });
    await expect(
      transitionStatus({
        canonicalId: VALID_CANONICAL,
        fingerprint: VALID_FINGERPRINT,
        nextStatus: "verified",
      }),
    ).rejects.toThrow("draft_not_found");
  });
});

// =====================================================================
// Section 7 - listDraftsForCanonical (admin read)
// =====================================================================

describe("listDraftsForCanonical", () => {
  it("returns an empty array when no drafts exist for the canonical", async () => {
    withClientResponse = () => ({ rows: [], rowCount: 0 });
    const rows = await listDraftsForCanonical(VALID_CANONICAL);
    expect(rows).toEqual([]);
  });

  it("maps multiple rows in last_touched_at DESC order (SQL enforces)", async () => {
    withClientResponse = () => ({
      rows: [
        sampleRow({ draft_id: "d2", status: "verified" }),
        sampleRow({ draft_id: "d1", status: "draft" }),
      ],
      rowCount: 2,
    });
    const rows = await listDraftsForCanonical(VALID_CANONICAL);
    expect(rows).toHaveLength(2);
    expect(rows[0].status).toBe("verified");
    expect(rows[1].status).toBe("draft");
    expect(withClientCalls[0].sql).toMatch(/ORDER\s+BY\s+last_touched_at\s+DESC/i);
  });
});

// =====================================================================
// Section 8 - Doctrine 7 (never log draft_json content)
// =====================================================================

describe("doctrine 7: no draft_json content in logs", () => {
  it("saveDraft logs only draft_id and status, never draft_json", async () => {
    withClientResponse = () => ({ rows: [], rowCount: 1 });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await saveDraft({
      canonicalId: VALID_CANONICAL,
      fingerprint: VALID_FINGERPRINT,
      draft: SAMPLE_FOOD_DRAFT,
    });
    // None of the log lines should contain the sentinel text that
    // only exists inside draft_json.
    const sentinel = "Family-run warung since 1998";
    const allLog = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(allLog).not.toContain(sentinel);
    expect(allLog).not.toContain("Padang");
    expect(allLog).toContain("canonical=");
    expect(allLog).toContain("status=");
  });

  it("transitionStatus logs only canonical + next status, never draft content", async () => {
    withClientResponse = () => ({ rows: [], rowCount: 1 });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await transitionStatus({
      canonicalId: VALID_CANONICAL,
      fingerprint: VALID_FINGERPRINT,
      nextStatus: "code_requested",
    });
    const allLog = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(allLog).toContain("code_requested");
    expect(allLog).not.toContain("Padang");
    expect(allLog).not.toContain(VALID_FINGERPRINT);
  });
});
