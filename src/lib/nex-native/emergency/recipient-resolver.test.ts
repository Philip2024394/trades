// src/lib/nex-native/emergency/recipient-resolver.test.ts

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

// Feature flag module is read inside the resolver. We flip env vars
// per test to assert layer-3 behaviour.
import {
  DEFAULT_RADIUS_KM,
  finaliseLayer,
  haversineKm,
  resolveRecipientsForIncident,
  uniq,
  writeRecipientRows,
} from "./recipient-resolver";

const REQ = "11111111-1111-4111-8111-111111111111";
const C1 = "22222222-2222-4222-8222-222222222222";
const C2 = "33333333-3333-4333-8333-333333333333";
const R1 = "44444444-4444-4444-8444-444444444444";
const R2 = "55555555-5555-4555-8555-555555555555";

beforeEach(() => {
  qCalls = [];
  qResponse = null;
  withClientNullMode = false;
  delete process.env.NEX_EMERGENCY_WIDER_COMMUNITY_ENABLED;
});

afterEach(() => vi.restoreAllMocks());

describe("pure helpers", () => {
  it("uniq preserves order and dedupes", () => {
    expect(uniq(["a", "b", "a", "c", "b"])).toEqual(["a", "b", "c"]);
  });

  it("finaliseLayer removes requester, dedupes, clamps", () => {
    expect(finaliseLayer(REQ, [REQ, "a", "b", "a", "c"], 2)).toEqual(["a", "b"]);
  });

  it("haversineKm matches a known pair (Jakarta → Bandung ~114km)", () => {
    const d = haversineKm(-6.2088, 106.8456, -6.9175, 107.6191);
    expect(d).toBeGreaterThan(100);
    expect(d).toBeLessThan(130);
  });

  it("haversineKm returns 0 for identical points", () => {
    expect(haversineKm(0, 0, 0, 0)).toBe(0);
  });
});

describe("DEFAULT_RADIUS_KM", () => {
  // Note: the constant is evaluated once at module load from
  // process.env.NEX_EMERGENCY_DEFAULT_RADIUS_KM. We assert the sealed
  // 10 km default (no env override at test time). If an operator sets
  // the env var at prod boot, the clamp [1, 25] is enforced via a
  // Number.isFinite + range check at load.
  it("defaults to 10 km (founder directive 2026-10-10 · widened from 5)", () => {
    expect(DEFAULT_RADIUS_KM).toBe(10);
  });

  it("is within the resolver's valid radius range [1, 25]", () => {
    expect(DEFAULT_RADIUS_KM).toBeGreaterThanOrEqual(1);
    expect(DEFAULT_RADIUS_KM).toBeLessThanOrEqual(25);
  });
});

describe("resolveRecipientsForIncident · guards", () => {
  it("rejects empty requester", async () => {
    await expect(
      resolveRecipientsForIncident({
        incidentId: "x",
        locationLat: 0,
        locationLng: 0,
        requesterAccountId: "",
        maxTrustedContacts: 10,
        maxNearbyOptIns: 10,
        radiusKm: 5,
      }),
    ).rejects.toThrow(/invalid_requester/);
  });

  it("rejects radius out of [1,25]", async () => {
    await expect(
      resolveRecipientsForIncident({
        incidentId: "x",
        locationLat: 0,
        locationLng: 0,
        requesterAccountId: REQ,
        maxTrustedContacts: 10,
        maxNearbyOptIns: 10,
        radiusKm: 999,
      }),
    ).rejects.toThrow(/invalid_radius/);
  });

  it("rejects negative max_trusted", async () => {
    await expect(
      resolveRecipientsForIncident({
        incidentId: "x",
        locationLat: 0,
        locationLng: 0,
        requesterAccountId: REQ,
        maxTrustedContacts: -1,
        maxNearbyOptIns: 10,
        radiusKm: 5,
      }),
    ).rejects.toThrow(/invalid_max_trusted/);
  });
});

describe("resolveRecipientsForIncident · layer 1", () => {
  it("returns trusted contacts filtered of requester + clamped", async () => {
    qResponse = (sql) => {
      if (sql.includes("FROM nex.trusted_contact")) {
        return {
          rows: [
            { contact_account_id: C1 },
            { contact_account_id: REQ }, // should be filtered out
            { contact_account_id: C2 },
          ],
          rowCount: 3,
        };
      }
      return null;
    };
    const r = await resolveRecipientsForIncident({
      incidentId: "i",
      locationLat: null,
      locationLng: null,
      requesterAccountId: REQ,
      maxTrustedContacts: 1,
      maxNearbyOptIns: 10,
      radiusKm: 5,
    });
    expect(r.layer1).toEqual([C1]);
  });
});

describe("resolveRecipientsForIncident · layer 2", () => {
  it("returns empty layer2 when requester shared no location", async () => {
    qResponse = (sql) =>
      sql.includes("FROM nex.trusted_contact")
        ? { rows: [{ contact_account_id: C1 }], rowCount: 1 }
        : null;
    const r = await resolveRecipientsForIncident({
      incidentId: "i",
      locationLat: null,
      locationLng: null,
      requesterAccountId: REQ,
      maxTrustedContacts: 10,
      maxNearbyOptIns: 10,
      radiusKm: 5,
    });
    expect(r.layer2).toEqual([]);
    expect(qCalls.some((c) => c.sql.includes("FROM nex.emergency_responder_optin"))).toBe(false);
  });

  it("includes only responders with declared radius >= requested radius", async () => {
    qResponse = (sql) => {
      if (sql.includes("FROM nex.trusted_contact")) return { rows: [], rowCount: 0 };
      if (sql.includes("FROM nex.emergency_responder_optin")) {
        return {
          rows: [
            { account_id: R1, radius_km: 3 }, // out
            { account_id: R2, radius_km: 10 }, // in
          ],
          rowCount: 2,
        };
      }
      return null;
    };
    const r = await resolveRecipientsForIncident({
      incidentId: "i",
      locationLat: -6.2,
      locationLng: 106.8,
      requesterAccountId: REQ,
      maxTrustedContacts: 10,
      maxNearbyOptIns: 10,
      radiusKm: 5,
    });
    expect(r.layer2).toEqual([R2]);
  });

  it("dedupes layer2 against layer1 (trusted contacts win)", async () => {
    qResponse = (sql) => {
      if (sql.includes("FROM nex.trusted_contact")) {
        return { rows: [{ contact_account_id: R2 }], rowCount: 1 };
      }
      if (sql.includes("FROM nex.emergency_responder_optin")) {
        return {
          rows: [
            { account_id: R1, radius_km: 10 },
            { account_id: R2, radius_km: 10 }, // overlaps layer1
          ],
          rowCount: 2,
        };
      }
      return null;
    };
    const r = await resolveRecipientsForIncident({
      incidentId: "i",
      locationLat: 0,
      locationLng: 0,
      requesterAccountId: REQ,
      maxTrustedContacts: 10,
      maxNearbyOptIns: 10,
      radiusKm: 5,
    });
    expect(r.layer1).toEqual([R2]);
    expect(r.layer2).toEqual([R1]);
  });
});

describe("resolveRecipientsForIncident · layer 3 flag", () => {
  it("layer3Available=false by default (v1 pilot)", async () => {
    qResponse = () => ({ rows: [], rowCount: 0 });
    const r = await resolveRecipientsForIncident({
      incidentId: "i",
      locationLat: 0,
      locationLng: 0,
      requesterAccountId: REQ,
      maxTrustedContacts: 10,
      maxNearbyOptIns: 10,
      radiusKm: 5,
    });
    expect(r.layer3Available).toBe(false);
  });

  it("layer3Available=true when env var is 'true'", async () => {
    process.env.NEX_EMERGENCY_WIDER_COMMUNITY_ENABLED = "true";
    qResponse = () => ({ rows: [], rowCount: 0 });
    const r = await resolveRecipientsForIncident({
      incidentId: "i",
      locationLat: 0,
      locationLng: 0,
      requesterAccountId: REQ,
      maxTrustedContacts: 10,
      maxNearbyOptIns: 10,
      radiusKm: 5,
    });
    expect(r.layer3Available).toBe(true);
  });
});

describe("writeRecipientRows", () => {
  it("inserts layer1 as trusted_contact and layer2 as nearby_opted_in", async () => {
    qResponse = (sql) =>
      sql.includes("INSERT INTO nex.incident_recipient")
        ? { rows: [], rowCount: 2 }
        : null;
    const n = await writeRecipientRows("i", [C1], [R1]);
    expect(n).toBe(2);
    const call = qCalls.find((c) => c.sql.includes("INSERT INTO nex.incident_recipient"));
    expect(call?.sql).toMatch(/ON\s+CONFLICT\s*\(\s*incident_id\s*,\s*recipient_account_id\s*\)\s+DO\s+NOTHING/);
    const params = call?.params ?? [];
    // params = [incidentId, c1, 'trusted_contact', r1, 'nearby_opted_in']
    expect(params[0]).toBe("i");
    expect(params[1]).toBe(C1);
    expect(params[2]).toBe("trusted_contact");
    expect(params[3]).toBe(R1);
    expect(params[4]).toBe("nearby_opted_in");
  });

  it("deduplicates when the same id appears in both layers", async () => {
    qResponse = (sql) =>
      sql.includes("INSERT INTO nex.incident_recipient")
        ? { rows: [], rowCount: 1 }
        : null;
    await writeRecipientRows("i", [C1], [C1, R1]);
    const call = qCalls.find((c) => c.sql.includes("INSERT INTO nex.incident_recipient"));
    const params = call?.params ?? [];
    // Only 2 ids total written: C1 as trusted, R1 as nearby.
    expect(params[1]).toBe(C1);
    expect(params[2]).toBe("trusted_contact");
    expect(params[3]).toBe(R1);
    expect(params[4]).toBe("nearby_opted_in");
    expect(params.length).toBe(5);
  });

  it("returns 0 and does not query when both layers are empty", async () => {
    const n = await writeRecipientRows("i", [], []);
    expect(n).toBe(0);
    expect(qCalls.length).toBe(0);
  });

  it("rejects blank incident id", async () => {
    await expect(writeRecipientRows("  ", [C1], [])).rejects.toThrow(
      /invalid_incident_id/,
    );
  });
});

// =====================================================================
// EH hardening audit 2026-10-10 · additions
// See docs/doctrine/nex-emergency-hardening-audit-2026-10-10.md
// =====================================================================
//
// Zero-recipient honest-empty scenarios + idempotency of writes. The
// hardening audit confirmed the resolver never falls back to layer 3
// when the first two layers are empty (wider_community is a signalling
// flag, not a silent default).

describe("hardening · zero trusted contacts (audit item 6)", () => {
  it("returns layer1=[] when the owner has no trusted contacts", async () => {
    qResponse = (sql) => {
      if (sql.includes("FROM nex.trusted_contact")) {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes("FROM nex.emergency_responder_optin")) {
        return { rows: [], rowCount: 0 };
      }
      return null;
    };
    const r = await resolveRecipientsForIncident({
      incidentId: "i",
      locationLat: 1,
      locationLng: 1,
      requesterAccountId: REQ,
      maxTrustedContacts: 20,
      maxNearbyOptIns: 25,
      radiusKm: 10,
    });
    expect(r.layer1).toEqual([]);
  });
});

describe("hardening · zero opted-in responders in radius", () => {
  it("returns layer2=[] when no responder radius covers the request", async () => {
    qResponse = (sql) => {
      if (sql.includes("FROM nex.trusted_contact")) {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes("FROM nex.emergency_responder_optin")) {
        // All responders have 1km radius; requester asks 10km.
        return {
          rows: [
            { account_id: R1, radius_km: 1 },
            { account_id: R2, radius_km: 1 },
          ],
          rowCount: 2,
        };
      }
      return null;
    };
    const r = await resolveRecipientsForIncident({
      incidentId: "i",
      locationLat: 1,
      locationLng: 1,
      requesterAccountId: REQ,
      maxTrustedContacts: 20,
      maxNearbyOptIns: 25,
      radiusKm: 10,
    });
    expect(r.layer2).toEqual([]);
  });
});

describe("hardening · both layers empty · honest empty (never falls back to layer3)", () => {
  it("layer3Available stays false in v1 even when layers 1+2 are empty", async () => {
    delete process.env.NEX_EMERGENCY_WIDER_COMMUNITY_ENABLED;
    qResponse = () => ({ rows: [], rowCount: 0 });
    const r = await resolveRecipientsForIncident({
      incidentId: "i",
      locationLat: 1,
      locationLng: 1,
      requesterAccountId: REQ,
      maxTrustedContacts: 20,
      maxNearbyOptIns: 25,
      radiusKm: 10,
    });
    expect(r.layer1).toEqual([]);
    expect(r.layer2).toEqual([]);
    expect(r.layer3Available).toBe(false);
  });
});

describe("hardening · writeRecipientRows idempotent write (same incident + recipient = no dup)", () => {
  it("INSERT uses ON CONFLICT (incident_id, recipient_account_id) DO NOTHING", async () => {
    qResponse = (sql) =>
      sql.includes("INSERT INTO nex.incident_recipient")
        ? { rows: [], rowCount: 0 }
        : null;
    // First call writes the row.
    await writeRecipientRows("i", [C1], []);
    // Second call with the SAME (incident, recipient) must not add a dup.
    await writeRecipientRows("i", [C1], []);
    const inserts = qCalls.filter((c) =>
      c.sql.includes("INSERT INTO nex.incident_recipient"),
    );
    expect(inserts.length).toBe(2);
    for (const i of inserts) {
      expect(i.sql).toMatch(
        /ON\s+CONFLICT\s*\(\s*incident_id\s*,\s*recipient_account_id\s*\)\s+DO\s+NOTHING/,
      );
    }
  });
});

describe("hardening · layer2 omitted when requester shared no location (audit item 5)", () => {
  it("locationLat/Lng both null · resolver skips the responder table entirely", async () => {
    let touchedResponderTable = false;
    qResponse = (sql) => {
      if (sql.includes("FROM nex.emergency_responder_optin")) {
        touchedResponderTable = true;
      }
      if (sql.includes("FROM nex.trusted_contact")) {
        return { rows: [{ contact_account_id: C1 }], rowCount: 1 };
      }
      return null;
    };
    const r = await resolveRecipientsForIncident({
      incidentId: "i",
      locationLat: null,
      locationLng: null,
      requesterAccountId: REQ,
      maxTrustedContacts: 20,
      maxNearbyOptIns: 25,
      radiusKm: 10,
    });
    expect(r.layer1).toEqual([C1]);
    expect(r.layer2).toEqual([]);
    expect(touchedResponderTable).toBe(false);
  });
});
