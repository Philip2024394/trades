// src/lib/nex-native/emergency/trusted-contacts-service.test.ts

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type QCall = { sql: string; params: readonly unknown[] };
let qCalls: QCall[];
let qResponse: ((sql: string, params: readonly unknown[]) =>
  { rows: Record<string, unknown>[]; rowCount: number | null } | null
) | null;
let withClientNullMode = false;

vi.mock("@/lib/nex/db", () => ({
  withClient: async <T>(fn: (c: unknown) => Promise<T>): Promise<T | null> => {
    if (withClientNullMode) return null;
    const client = {
      query: async (sql: string, params?: readonly unknown[]) => {
        qCalls.push({ sql, params: params ?? [] });
        if (qResponse) {
          const r = qResponse(sql, params ?? []);
          if (r !== null) return r;
        }
        return { rows: [], rowCount: 0 };
      },
    };
    return (await fn(client)) ?? null;
  },
}));

import {
  addContact,
  isContact,
  listContacts,
  removeContact,
  TRUSTED_CONTACT_RULES,
} from "./trusted-contacts-service";

const OWNER = "11111111-1111-4111-8111-111111111111";
const CONTACT = "22222222-2222-4222-8222-222222222222";
const TRUSTED_ID = "99999999-9999-4999-8999-999999999999";

function row(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    trusted_contact_id: TRUSTED_ID,
    owner_account_id: OWNER,
    contact_account_id: CONTACT,
    contact_email: null,
    contact_phone: null,
    added_at: new Date("2026-10-10T10:00:00Z"),
    contact_label: null,
    ...overrides,
  };
}

function insertRespondOnce(overrides: Record<string, unknown> = {}): void {
  qResponse = (sql) =>
    sql.includes("INSERT INTO nex.trusted_contact")
      ? { rows: [row(overrides)], rowCount: 1 }
      : null;
}

beforeEach(() => {
  qCalls = [];
  qResponse = null;
  withClientNullMode = false;
});

afterEach(() => vi.restoreAllMocks());

// =====================================================================
// Back-compat positional signature (preserved for L1 actions.ts)
// =====================================================================

describe("addContact · back-compat positional signature · guards", () => {
  it("rejects empty owner", async () => {
    await expect(addContact("", CONTACT)).rejects.toThrow(/invalid_owner_account_id/);
  });

  it("rejects empty contact", async () => {
    await expect(addContact(OWNER, "")).rejects.toThrow(/invalid_contact_account_id/);
  });

  it("rejects self-contact", async () => {
    await expect(addContact(OWNER, OWNER)).rejects.toThrow(/self_contact_not_allowed/);
  });

  it("rejects label > 60 chars", async () => {
    await expect(addContact(OWNER, CONTACT, "x".repeat(61))).rejects.toThrow(
      /label_too_long/,
    );
  });

  it("accepts and persists a labelled contact (upsert on owner+account)", async () => {
    insertRespondOnce({ contact_label: "Mum" });
    // Back-compat positional form returns the legacy (L1-shaped) row.
    const r = await addContact(OWNER, CONTACT, "Mum");
    expect(r.contactLabel).toBe("Mum");
    expect(r.contactAccountId).toBe(CONTACT);
    const call = qCalls.find((c) => c.sql.includes("INSERT INTO nex.trusted_contact"));
    expect(call?.sql).toMatch(/ON\s+CONFLICT\s*\(\s*owner_account_id\s*,\s*contact_account_id\s*\)/);
  });

  it("drops control characters from label", async () => {
    insertRespondOnce({ contact_label: "Mum" });
    await addContact(OWNER, CONTACT, "Mum");
    const call = qCalls.find((c) => c.sql.includes("INSERT INTO nex.trusted_contact"));
    // params = [owner, safeAccount, safeEmail, safePhone, safeLabel]
    expect(call?.params[4]).toBe("Mum");
  });

  it("throws db_unavailable when pool unset", async () => {
    withClientNullMode = true;
    await expect(addContact(OWNER, CONTACT)).rejects.toThrow(/db_unavailable/);
  });
});

// =====================================================================
// Multi-channel args signature (migration 196)
// =====================================================================

describe("addContact · multi-channel · account-only", () => {
  it("inserts a contact identified only by account id", async () => {
    insertRespondOnce({ contact_account_id: CONTACT });
    const r = await addContact({ ownerAccountId: OWNER, contactAccountId: CONTACT });
    expect(r.contactAccountId).toBe(CONTACT);
    expect(r.contactEmail).toBeNull();
    expect(r.contactPhone).toBeNull();
    const call = qCalls.find((c) => c.sql.includes("INSERT INTO nex.trusted_contact"));
    expect(call?.sql).toMatch(/ON\s+CONFLICT\s*\(\s*owner_account_id\s*,\s*contact_account_id\s*\)/);
  });
});

describe("addContact · multi-channel · email-only", () => {
  it("inserts a contact identified only by email", async () => {
    insertRespondOnce({
      contact_account_id: null,
      contact_email: "mum@example.com",
    });
    const r = await addContact({
      ownerAccountId: OWNER,
      contactEmail: "Mum@Example.com",
      label: "Mum",
    });
    expect(r.contactAccountId).toBeNull();
    expect(r.contactEmail).toBe("mum@example.com");
    const call = qCalls.find((c) => c.sql.includes("INSERT INTO nex.trusted_contact"));
    // sanitiseEmail lower-cases + trims
    expect(call?.params[2]).toBe("mum@example.com");
    expect(call?.sql).toMatch(/ON\s+CONFLICT\s*\(\s*owner_account_id\s*,\s*lower\(contact_email\)\s*\)/);
  });

  it("rejects malformed emails", async () => {
    await expect(
      addContact({ ownerAccountId: OWNER, contactEmail: "not-an-email" }),
    ).rejects.toThrow(/invalid_email/);
  });

  it("rejects an email missing a tld", async () => {
    await expect(
      addContact({ ownerAccountId: OWNER, contactEmail: "someone@localhost" }),
    ).rejects.toThrow(/invalid_email/);
  });
});

describe("addContact · multi-channel · phone-only", () => {
  it("inserts a contact identified only by phone", async () => {
    insertRespondOnce({
      contact_account_id: null,
      contact_phone: "+6281234567",
    });
    const r = await addContact({
      ownerAccountId: OWNER,
      contactPhone: "+62 812-345-67",
    });
    expect(r.contactPhone).toBe("+6281234567");
    const call = qCalls.find((c) => c.sql.includes("INSERT INTO nex.trusted_contact"));
    // sanitisePhone strips spaces, dashes, parens
    expect(call?.params[3]).toBe("+6281234567");
    expect(call?.sql).toMatch(/ON\s+CONFLICT\s*\(\s*owner_account_id\s*,\s*contact_phone\s*\)/);
  });

  it("rejects a phone shorter than 5 digits", async () => {
    await expect(
      addContact({ ownerAccountId: OWNER, contactPhone: "123" }),
    ).rejects.toThrow(/invalid_phone/);
  });

  it("rejects a phone with non-numeric characters", async () => {
    await expect(
      addContact({ ownerAccountId: OWNER, contactPhone: "call-me-maybe" }),
    ).rejects.toThrow(/invalid_phone/);
  });
});

describe("addContact · multi-channel · combinations + edge cases", () => {
  it("accepts a contact with all three identifiers", async () => {
    insertRespondOnce({
      contact_email: "a@b.co",
      contact_phone: "+1234567890",
    });
    const r = await addContact({
      ownerAccountId: OWNER,
      contactAccountId: CONTACT,
      contactEmail: "a@b.co",
      contactPhone: "+1234567890",
    });
    expect(r.contactAccountId).toBe(CONTACT);
    expect(r.contactEmail).toBe("a@b.co");
    expect(r.contactPhone).toBe("+1234567890");
  });

  it("rejects the no-identifier case (no account, no email, no phone)", async () => {
    await expect(
      addContact({ ownerAccountId: OWNER, label: "Nobody" }),
    ).rejects.toThrow(/no_identifier/);
  });

  it("still rejects self-contact when account id is provided", async () => {
    await expect(
      addContact({ ownerAccountId: OWNER, contactAccountId: OWNER }),
    ).rejects.toThrow(/self_contact_not_allowed/);
  });

  it("prefers the account-id ON CONFLICT path when account is present", async () => {
    insertRespondOnce({ contact_email: "a@b.co" });
    await addContact({
      ownerAccountId: OWNER,
      contactAccountId: CONTACT,
      contactEmail: "a@b.co",
    });
    const call = qCalls.find((c) => c.sql.includes("INSERT INTO nex.trusted_contact"));
    expect(call?.sql).toMatch(/ON\s+CONFLICT\s*\(\s*owner_account_id\s*,\s*contact_account_id\s*\)/);
  });
});

// =====================================================================
// removeContact
// =====================================================================

describe("removeContact · back-compat (owner, contactAccountId)", () => {
  it("deletes the edge", async () => {
    qResponse = (sql) =>
      sql.includes("DELETE FROM nex.trusted_contact")
        ? { rows: [], rowCount: 1 }
        : null;
    await removeContact(OWNER, CONTACT);
    const call = qCalls.find((c) => c.sql.includes("DELETE FROM nex.trusted_contact"));
    expect(call?.sql).toMatch(/contact_account_id\s*=\s*\$2/);
  });
});

describe("removeContact · PK-based (migration 196)", () => {
  it("deletes by trusted_contact_id", async () => {
    qResponse = (sql) =>
      sql.includes("DELETE FROM nex.trusted_contact")
        ? { rows: [], rowCount: 1 }
        : null;
    await removeContact({ ownerAccountId: OWNER, trustedContactId: TRUSTED_ID });
    const call = qCalls.find((c) => c.sql.includes("DELETE FROM nex.trusted_contact"));
    expect(call?.sql).toMatch(/trusted_contact_id\s*=\s*\$2/);
    expect(call?.params[1]).toBe(TRUSTED_ID);
  });

  it("rejects empty trustedContactId", async () => {
    await expect(
      removeContact({ ownerAccountId: OWNER, trustedContactId: "" }),
    ).rejects.toThrow(/invalid_trusted_contact_id/);
  });
});

// =====================================================================
// listContacts · multi-channel shape
// =====================================================================

describe("listContacts", () => {
  it("clamps limit to [1,200]", async () => {
    qResponse = () => ({ rows: [], rowCount: 0 });
    await listContacts(OWNER, 9999);
    const call = qCalls.find((c) => c.sql.includes("ORDER BY added_at DESC"));
    expect(call?.params[1]).toBe(200);
  });

  it("returns the full multi-channel shape", async () => {
    qResponse = (sql) =>
      sql.includes("ORDER BY added_at DESC")
        ? {
            rows: [
              row({ contact_email: "a@b.co", contact_phone: "+123456789" }),
              row({
                contact_account_id: null,
                contact_email: "friend@example.com",
                contact_phone: null,
              }),
            ],
            rowCount: 2,
          }
        : null;
    const r = await listContacts(OWNER, 10);
    expect(r.length).toBe(2);
    expect(r[0].contactEmail).toBe("a@b.co");
    expect(r[0].contactPhone).toBe("+123456789");
    expect(r[1].contactAccountId).toBeNull();
    expect(r[1].contactEmail).toBe("friend@example.com");
  });

  it("maps legacy pre-196 rows (no new columns) to nullable fields", async () => {
    qResponse = (sql) =>
      sql.includes("ORDER BY added_at DESC")
        ? {
            rows: [
              {
                owner_account_id: OWNER,
                contact_account_id: CONTACT,
                added_at: new Date("2026-10-10T10:00:00Z"),
                contact_label: "Mum",
                // trusted_contact_id, contact_email, contact_phone absent
              },
            ],
            rowCount: 1,
          }
        : null;
    const r = await listContacts(OWNER, 10);
    expect(r[0].trustedContactId).toBeNull();
    expect(r[0].contactEmail).toBeNull();
    expect(r[0].contactPhone).toBeNull();
    expect(r[0].contactLabel).toBe("Mum");
  });
});

describe("isContact", () => {
  it("true when SELECT 1 returns a row", async () => {
    qResponse = () => ({ rows: [{ "?column?": 1 }], rowCount: 1 });
    expect(await isContact(OWNER, CONTACT)).toBe(true);
  });

  it("false when nothing found", async () => {
    qResponse = () => ({ rows: [], rowCount: 0 });
    expect(await isContact(OWNER, CONTACT)).toBe(false);
  });

  it("false when DB is unavailable", async () => {
    withClientNullMode = true;
    expect(await isContact(OWNER, CONTACT)).toBe(false);
  });
});

describe("TRUSTED_CONTACT_RULES", () => {
  it("exposes sealed bounds (back-compat + new phone bounds)", () => {
    expect(TRUSTED_CONTACT_RULES.maxLabelLen).toBe(60);
    expect(TRUSTED_CONTACT_RULES.listHardLimit).toBe(200);
    expect(TRUSTED_CONTACT_RULES.minPhoneLen).toBe(5);
    expect(TRUSTED_CONTACT_RULES.maxPhoneLen).toBe(20);
  });
});

// =====================================================================
// EH hardening audit 2026-10-10 · additions
// See docs/doctrine/nex-emergency-hardening-audit-2026-10-10.md
// =====================================================================

describe("hardening · at-least-one-identifier enforcement (audit item 6)", () => {
  // Doctrine: the DB has a CHECK constraint; the service enforces the
  // same contract in-process so the error surfaces as a typed throw
  // instead of a pg CHECK violation.
  it("rejects when all three identifiers (account/email/phone) are null", async () => {
    await expect(
      addContact({ ownerAccountId: OWNER }),
    ).rejects.toThrow(/no_identifier/);
  });

  it("rejects when all three identifiers are blank/undefined", async () => {
    await expect(
      addContact({
        ownerAccountId: OWNER,
        contactAccountId: null,
        contactEmail: null,
        contactPhone: null,
      }),
    ).rejects.toThrow(/no_identifier/);
  });

  it("accepts an email-only contact (no account, no phone)", async () => {
    insertRespondOnce({
      contact_account_id: null,
      contact_email: "friend@example.com",
      contact_phone: null,
    });
    const r = await addContact({
      ownerAccountId: OWNER,
      contactEmail: "friend@example.com",
    });
    expect("contactEmail" in r && r.contactEmail).toBe("friend@example.com");
  });

  it("accepts a phone-only contact (no account, no email)", async () => {
    insertRespondOnce({
      contact_account_id: null,
      contact_email: null,
      contact_phone: "+628123456789",
    });
    const r = await addContact({
      ownerAccountId: OWNER,
      contactPhone: "+628123456789",
    });
    expect("contactPhone" in r && r.contactPhone).toBe("+628123456789");
  });
});

describe("hardening · self-add rejection", () => {
  it("rejects when owner == contact_account_id (new object signature)", async () => {
    await expect(
      addContact({
        ownerAccountId: OWNER,
        contactAccountId: OWNER,
      }),
    ).rejects.toThrow(/self_contact_not_allowed/);
  });

  it("rejects when owner == contact_account_id (back-compat positional)", async () => {
    await expect(addContact(OWNER, OWNER)).rejects.toThrow(
      /self_contact_not_allowed/,
    );
  });
});

describe("hardening · per-owner max-10 cap is NOT yet enforced (documented gap)", () => {
  // Doctrine audit: no per-owner cap at the service layer. The DB has
  // no CHECK or trigger either. This test documents the gap honestly ·
  // if a future wave adds enforcement, this test must flip.
  it("addContact does NOT pre-query count(*) before insert · documented gap", async () => {
    insertRespondOnce({ contact_label: "Mum" });
    await addContact({
      ownerAccountId: OWNER,
      contactAccountId: CONTACT,
      label: "Mum",
    });
    const countCall = qCalls.find(
      (c) =>
        c.sql.includes("count(*)")
        && c.sql.includes("FROM nex.trusted_contact"),
    );
    expect(countCall).toBeUndefined();
  });
});

describe("hardening · listContacts clamps the SELECT LIMIT (honest ceiling)", () => {
  it("clamps huge limit to 200 (hard ceiling)", async () => {
    qResponse = (sql) =>
      sql.includes("FROM nex.trusted_contact")
      && sql.includes("ORDER BY added_at DESC")
        ? { rows: [], rowCount: 0 }
        : null;
    await listContacts(OWNER, 9_999_999);
    const call = qCalls.find((c) => c.sql.includes("ORDER BY added_at DESC"));
    expect(call?.params[1]).toBe(200);
  });

  it("floors negative limit to 1", async () => {
    qResponse = (sql) =>
      sql.includes("FROM nex.trusted_contact")
      && sql.includes("ORDER BY added_at DESC")
        ? { rows: [], rowCount: 0 }
        : null;
    await listContacts(OWNER, -5);
    const call = qCalls.find((c) => c.sql.includes("ORDER BY added_at DESC"));
    expect(call?.params[1]).toBe(1);
  });
});
