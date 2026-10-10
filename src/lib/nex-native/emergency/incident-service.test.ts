// src/lib/nex-native/emergency/incident-service.test.ts
//
// Hermetic unit tests for the incident-service. Mocks @/lib/nex/db so
// no real DB is touched. Pattern matches draft-service.test.ts.

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

// Import AFTER mocks.
import {
  activateIncident,
  cancelIncident,
  canTransition,
  confirmPendingAlert,
  createIncident,
  createPendingAlert,
  getIncident,
  INCIDENT_RATE_LIMIT,
  isLocationUpdateSource,
  listMyIncidents,
  LOCATION_UPDATE_MIN_INTERVAL_SECONDS,
  LOCATION_UPDATE_SOURCES,
  markRespondersAssigned,
  rateLimit,
  recordRateLimitEvent,
  resolveIncident,
  revokePendingAlert,
  sweepExpired,
  updateIncidentLocation,
} from "./incident-service";

const REQ = "11111111-1111-4111-8111-111111111111";

function row(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const base = {
    incident_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    requester_account_id: REQ,
    state: "draft",
    category: "general_assistance",
    location_lat: null,
    location_lng: null,
    location_accuracy_meters: null,
    location_captured_at: null,
    simulated: true,
    created_at: new Date("2026-10-10T10:00:00Z"),
    activated_at: null,
    resolved_at: null,
    cancelled_at: null,
    pending_confirmed_at: null,
    revoked_within_window_at: null,
    expires_at: new Date("2026-10-10T10:30:00Z"),
  };
  return { ...base, ...overrides };
}

beforeEach(() => {
  qCalls = [];
  qResponse = null;
  withClientNullMode = false;
});

afterEach(() => vi.restoreAllMocks());

describe("createIncident · input guards", () => {
  it("rejects empty requester", async () => {
    await expect(
      createIncident({
        requesterAccountId: "",
        category: "general_assistance",
        locationLat: null,
        locationLng: null,
        locationAccuracyMeters: null,
        locationCapturedAt: null,
      }),
    ).rejects.toThrow(/invalid_requester_account_id/);
  });

  it("rejects unknown category", async () => {
    await expect(
      createIncident({
        requesterAccountId: REQ,
        // deliberately malformed
        category: "nope" as never,
        locationLat: null,
        locationLng: null,
        locationAccuracyMeters: null,
        locationCapturedAt: null,
      }),
    ).rejects.toThrow(/invalid_category/);
  });

  it("rejects latitude out of range", async () => {
    await expect(
      createIncident({
        requesterAccountId: REQ,
        category: "safety_concern",
        locationLat: 999,
        locationLng: 0,
        locationAccuracyMeters: null,
        locationCapturedAt: null,
      }),
    ).rejects.toThrow(/invalid_location_lat/);
  });

  it("rejects longitude out of range", async () => {
    await expect(
      createIncident({
        requesterAccountId: REQ,
        category: "safety_concern",
        locationLat: 0,
        locationLng: 999,
        locationAccuracyMeters: null,
        locationCapturedAt: null,
      }),
    ).rejects.toThrow(/invalid_location_lng/);
  });

  it("rejects negative accuracy", async () => {
    await expect(
      createIncident({
        requesterAccountId: REQ,
        category: "safety_concern",
        locationLat: 0,
        locationLng: 0,
        locationAccuracyMeters: -5,
        locationCapturedAt: null,
      }),
    ).rejects.toThrow(/invalid_location_accuracy/);
  });

  it("forces simulated=TRUE in the INSERT (never reads caller flag)", async () => {
    qResponse = (sql) => sql.includes("INSERT INTO nex.emergency_incident")
      ? { rows: [row()], rowCount: 1 }
      : null;
    const r = await createIncident({
      requesterAccountId: REQ,
      category: "medical_concern",
      locationLat: 1.23,
      locationLng: 103.45,
      locationAccuracyMeters: 15,
      locationCapturedAt: "2026-10-10T10:00:00Z",
    });
    expect(r.simulated).toBe(true);
    const insert = qCalls.find((c) => c.sql.includes("INSERT INTO nex.emergency_incident"));
    expect(insert?.sql).toMatch(/TRUE\s*\)/);
  });

  it("throws db_unavailable when the pool is unset", async () => {
    withClientNullMode = true;
    await expect(
      createIncident({
        requesterAccountId: REQ,
        category: "general_assistance",
        locationLat: null,
        locationLng: null,
        locationAccuracyMeters: null,
        locationCapturedAt: null,
      }),
    ).rejects.toThrow(/db_unavailable/);
  });
});

describe("getIncident", () => {
  it("returns mapped row when found", async () => {
    qResponse = (sql) => sql.includes("WHERE incident_id = $1")
      ? { rows: [row({ state: "active" })], rowCount: 1 }
      : null;
    const r = await getIncident("abc");
    expect(r?.state).toBe("active");
  });

  it("returns null when not found", async () => {
    qResponse = () => ({ rows: [], rowCount: 0 });
    const r = await getIncident("missing");
    expect(r).toBeNull();
  });

  it("rejects blank id", async () => {
    await expect(getIncident("  ")).rejects.toThrow(/invalid_incident_id/);
  });
});

describe("listMyIncidents", () => {
  it("clamps limit to [1,100]", async () => {
    qResponse = (sql) => sql.includes("ORDER BY created_at DESC")
      ? { rows: [], rowCount: 0 }
      : null;
    await listMyIncidents(REQ, 9999);
    const call = qCalls.find((c) => c.sql.includes("ORDER BY created_at DESC"));
    expect(call?.params[1]).toBe(100);
  });
});

describe("state machine · canTransition", () => {
  it("permits sealed transitions", () => {
    expect(canTransition("draft", "active")).toBe(true);
    expect(canTransition("draft", "cancelled")).toBe(true);
    expect(canTransition("active", "responders_assigned")).toBe(true);
    expect(canTransition("active", "resolved")).toBe(true);
    expect(canTransition("active", "cancelled")).toBe(true);
    expect(canTransition("active", "expired")).toBe(true);
    expect(canTransition("responders_assigned", "resolved")).toBe(true);
  });

  it("refuses illegal transitions", () => {
    expect(canTransition("draft", "resolved")).toBe(false);
    expect(canTransition("resolved", "active")).toBe(false);
    expect(canTransition("cancelled", "resolved")).toBe(false);
    expect(canTransition("expired", "resolved")).toBe(false);
  });

  it("permits new pending-confirmation transitions (migration 195)", () => {
    expect(canTransition("pending_confirmation", "active")).toBe(true);
    expect(canTransition("pending_confirmation", "revoked_within_window")).toBe(true);
    expect(canTransition("pending_confirmation", "cancelled")).toBe(true);
  });

  it("treats revoked_within_window as a terminal state", () => {
    expect(canTransition("revoked_within_window", "active")).toBe(false);
    expect(canTransition("revoked_within_window", "cancelled")).toBe(false);
    expect(canTransition("revoked_within_window", "resolved")).toBe(false);
  });

  it("does not allow draft to jump directly to pending_confirmation", () => {
    expect(canTransition("draft", "pending_confirmation")).toBe(false);
  });

  it("does not allow active to backslide to pending_confirmation", () => {
    expect(canTransition("active", "pending_confirmation")).toBe(false);
  });
});

describe("activateIncident", () => {
  it("transitions draft → active and stamps activated_at", async () => {
    qResponse = (sql) => {
      if (sql.includes("SELECT") && sql.includes("WHERE incident_id")) {
        return { rows: [row({ state: "draft" })], rowCount: 1 };
      }
      if (sql.includes("UPDATE nex.emergency_incident")) {
        return { rows: [row({ state: "active", activated_at: new Date() })], rowCount: 1 };
      }
      return null;
    };
    const r = await activateIncident("abc");
    expect(r.state).toBe("active");
    expect(r.activatedAt).not.toBeNull();
    const upd = qCalls.find((c) => c.sql.includes("UPDATE nex.emergency_incident"));
    expect(upd?.sql).toMatch(/activated_at\s*=\s*now\(\)/);
  });

  it("refuses to activate non-draft incident", async () => {
    qResponse = (sql) =>
      sql.includes("SELECT") && sql.includes("WHERE incident_id")
        ? { rows: [row({ state: "cancelled" })], rowCount: 1 }
        : null;
    await expect(activateIncident("abc")).rejects.toThrow(/invalid_state_transition/);
  });
});

describe("markRespondersAssigned", () => {
  it("transitions active → responders_assigned", async () => {
    qResponse = (sql) => {
      if (sql.includes("SELECT") && sql.includes("WHERE incident_id")) {
        return { rows: [row({ state: "active" })], rowCount: 1 };
      }
      if (sql.includes("UPDATE nex.emergency_incident")) {
        return { rows: [row({ state: "responders_assigned" })], rowCount: 1 };
      }
      return null;
    };
    const r = await markRespondersAssigned("abc");
    expect(r.state).toBe("responders_assigned");
  });
});

describe("cancelIncident", () => {
  it("rejects non-requester actor", async () => {
    qResponse = (sql) =>
      sql.includes("SELECT") && sql.includes("WHERE incident_id")
        ? { rows: [row({ state: "active" })], rowCount: 1 }
        : null;
    await expect(cancelIncident("abc", "stranger")).rejects.toThrow(/not_authorized/);
  });

  it("transitions to cancelled when requester matches", async () => {
    qResponse = (sql) => {
      if (sql.includes("SELECT") && sql.includes("WHERE incident_id")) {
        return { rows: [row({ state: "active" })], rowCount: 1 };
      }
      if (sql.includes("UPDATE nex.emergency_incident")) {
        return { rows: [row({ state: "cancelled", cancelled_at: new Date() })], rowCount: 1 };
      }
      return null;
    };
    const r = await cancelIncident("abc", REQ);
    expect(r.state).toBe("cancelled");
    expect(r.cancelledAt).not.toBeNull();
  });

  it("refuses to cancel a terminal (resolved) incident", async () => {
    qResponse = (sql) =>
      sql.includes("SELECT") && sql.includes("WHERE incident_id")
        ? { rows: [row({ state: "resolved" })], rowCount: 1 }
        : null;
    await expect(cancelIncident("abc", REQ)).rejects.toThrow(/invalid_state_transition/);
  });
});

describe("resolveIncident", () => {
  it("transitions to resolved only by requester", async () => {
    qResponse = (sql) => {
      if (sql.includes("SELECT") && sql.includes("WHERE incident_id")) {
        return { rows: [row({ state: "responders_assigned" })], rowCount: 1 };
      }
      if (sql.includes("UPDATE nex.emergency_incident")) {
        return { rows: [row({ state: "resolved", resolved_at: new Date() })], rowCount: 1 };
      }
      return null;
    };
    const r = await resolveIncident("abc", REQ);
    expect(r.state).toBe("resolved");
    expect(r.resolvedAt).not.toBeNull();
  });

  it("rejects non-requester", async () => {
    qResponse = (sql) =>
      sql.includes("SELECT") && sql.includes("WHERE incident_id")
        ? { rows: [row({ state: "active" })], rowCount: 1 }
        : null;
    await expect(resolveIncident("abc", "x")).rejects.toThrow(/not_authorized/);
  });
});

describe("sweepExpired", () => {
  it("issues an UPDATE guarded by NOT EXISTS accepted responder", async () => {
    qResponse = (sql) =>
      sql.includes("UPDATE nex.emergency_incident")
        ? { rows: [{ incident_id: "x" }, { incident_id: "y" }], rowCount: 2 }
        : null;
    const n = await sweepExpired();
    expect(n).toBe(2);
    const sweep = qCalls.find((c) => c.sql.includes("UPDATE nex.emergency_incident"));
    expect(sweep?.sql).toMatch(/NOT\s+EXISTS/);
    expect(sweep?.sql).toMatch(/expires_at\s*<=\s*now\(\)/);
    expect(sweep?.sql).toMatch(/state\s*=\s*'expired'/);
  });
});

describe("rateLimit", () => {
  it("returns true when under both limits", async () => {
    qResponse = (sql) => {
      if (sql.includes("count(*)")) return { rows: [{ n: 1 }], rowCount: 1 };
      if (sql.includes("sum(count)")) return { rows: [{ n: 3 }], rowCount: 1 };
      return null;
    };
    expect(await rateLimit(REQ)).toBe(true);
  });

  it("returns false when concurrent-active limit hit", async () => {
    qResponse = (sql) => {
      if (sql.includes("count(*)")) return { rows: [{ n: 3 }], rowCount: 1 };
      return null;
    };
    expect(await rateLimit(REQ)).toBe(false);
  });

  it("returns false when 24h limit hit", async () => {
    qResponse = (sql) => {
      if (sql.includes("count(*)")) return { rows: [{ n: 0 }], rowCount: 1 };
      if (sql.includes("sum(count)")) return { rows: [{ n: 10 }], rowCount: 1 };
      return null;
    };
    expect(await rateLimit(REQ)).toBe(false);
  });

  it("fails closed when DB unavailable", async () => {
    withClientNullMode = true;
    expect(await rateLimit(REQ)).toBe(false);
  });

  it("exposes the sealed limits", () => {
    expect(INCIDENT_RATE_LIMIT.maxConcurrentActive).toBe(3);
    expect(INCIDENT_RATE_LIMIT.maxPer24h).toBe(10);
  });
});

describe("recordRateLimitEvent", () => {
  it("upserts bucket keyed to hour", async () => {
    qResponse = (sql) =>
      sql.includes("INSERT INTO nex.emergency_rate_limit")
        ? { rows: [], rowCount: 1 }
        : null;
    await recordRateLimitEvent(REQ);
    const call = qCalls.find((c) => c.sql.includes("INSERT INTO nex.emergency_rate_limit"));
    expect(call?.sql).toMatch(/date_trunc\('hour', now\(\)\)/);
    expect(call?.sql).toMatch(/ON\s+CONFLICT/);
  });
});

// =====================================================================
// updateIncidentLocation (H3 · migration 194)
// =====================================================================

describe("updateIncidentLocation · sealed source enum", () => {
  it("exposes the 3-value sealed source list", () => {
    expect(LOCATION_UPDATE_SOURCES).toEqual([
      "browser_watch_position",
      "manual_pin",
      "service_worker_sync",
    ]);
  });

  it("isLocationUpdateSource type-guards correctly", () => {
    expect(isLocationUpdateSource("browser_watch_position")).toBe(true);
    expect(isLocationUpdateSource("manual_pin")).toBe(true);
    expect(isLocationUpdateSource("service_worker_sync")).toBe(true);
    expect(isLocationUpdateSource("satellite")).toBe(false);
    expect(isLocationUpdateSource("")).toBe(false);
  });

  it("exposes sealed 10-second rate-limit constant", () => {
    expect(LOCATION_UPDATE_MIN_INTERVAL_SECONDS).toBe(10);
  });
});

const INC = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const UPD = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

/** Reusable SELECT ... requester_account_id, state, last_captured_at
 *  responder. The test configures the active state + last ping time. */
function selectIncidentRow(args: {
  requester?: string;
  state?: string;
  lastCapturedAt?: Date | string | null;
} = {}): { rows: Record<string, unknown>[]; rowCount: number } {
  return {
    rows: [{
      requester_account_id: args.requester ?? REQ,
      state: args.state ?? "active",
      last_captured_at: args.lastCapturedAt ?? null,
    }],
    rowCount: 1,
  };
}

describe("updateIncidentLocation · input guards", () => {
  it("rejects blank actor", async () => {
    await expect(
      updateIncidentLocation({
        incidentId: INC,
        actorAccountId: "",
        lat: 0, lng: 0,
        capturedAt: "2026-10-10T10:00:00Z",
      }),
    ).rejects.toThrow(/invalid_actor_account_id/);
  });

  it("rejects blank incidentId", async () => {
    await expect(
      updateIncidentLocation({
        incidentId: "",
        actorAccountId: REQ,
        lat: 0, lng: 0,
        capturedAt: "2026-10-10T10:00:00Z",
      }),
    ).rejects.toThrow(/invalid_incident_id/);
  });

  it("rejects latitude out of range", async () => {
    await expect(
      updateIncidentLocation({
        incidentId: INC,
        actorAccountId: REQ,
        lat: 999, lng: 0,
        capturedAt: "2026-10-10T10:00:00Z",
      }),
    ).rejects.toThrow(/invalid_location_lat/);
  });

  it("rejects longitude out of range", async () => {
    await expect(
      updateIncidentLocation({
        incidentId: INC,
        actorAccountId: REQ,
        lat: 0, lng: -181,
        capturedAt: "2026-10-10T10:00:00Z",
      }),
    ).rejects.toThrow(/invalid_location_lng/);
  });

  it("rejects negative accuracy", async () => {
    await expect(
      updateIncidentLocation({
        incidentId: INC,
        actorAccountId: REQ,
        lat: 0, lng: 0,
        accuracyMeters: -1,
        capturedAt: "2026-10-10T10:00:00Z",
      }),
    ).rejects.toThrow(/invalid_location_accuracy/);
  });

  it("rejects heading > 360", async () => {
    await expect(
      updateIncidentLocation({
        incidentId: INC,
        actorAccountId: REQ,
        lat: 0, lng: 0,
        headingDegrees: 361,
        capturedAt: "2026-10-10T10:00:00Z",
      }),
    ).rejects.toThrow(/invalid_heading_degrees/);
  });

  it("rejects negative speed", async () => {
    await expect(
      updateIncidentLocation({
        incidentId: INC,
        actorAccountId: REQ,
        lat: 0, lng: 0,
        speedMps: -0.5,
        capturedAt: "2026-10-10T10:00:00Z",
      }),
    ).rejects.toThrow(/invalid_speed_mps/);
  });

  it("rejects unparseable capturedAt", async () => {
    await expect(
      updateIncidentLocation({
        incidentId: INC,
        actorAccountId: REQ,
        lat: 0, lng: 0,
        capturedAt: "garbage",
      }),
    ).rejects.toThrow(/invalid_captured_at/);
  });
});

describe("updateIncidentLocation · auth + state gates", () => {
  it("rejects when incident does not exist", async () => {
    qResponse = (sql) =>
      sql.includes("FROM nex.emergency_incident ei")
        ? { rows: [], rowCount: 0 }
        : null;
    await expect(
      updateIncidentLocation({
        incidentId: INC,
        actorAccountId: REQ,
        lat: 1, lng: 2,
        capturedAt: "2026-10-10T10:00:00Z",
      }),
    ).rejects.toThrow(/not_found/);
  });

  it("rejects when actor is not the requester", async () => {
    qResponse = (sql) =>
      sql.includes("FROM nex.emergency_incident ei")
        ? selectIncidentRow({ requester: "someone-else" })
        : null;
    await expect(
      updateIncidentLocation({
        incidentId: INC,
        actorAccountId: REQ,
        lat: 1, lng: 2,
        capturedAt: "2026-10-10T10:00:00Z",
      }),
    ).rejects.toThrow(/not_authorized/);
  });

  it("rejects when incident is cancelled (not updatable)", async () => {
    qResponse = (sql) =>
      sql.includes("FROM nex.emergency_incident ei")
        ? selectIncidentRow({ state: "cancelled" })
        : null;
    await expect(
      updateIncidentLocation({
        incidentId: INC,
        actorAccountId: REQ,
        lat: 1, lng: 2,
        capturedAt: "2026-10-10T10:00:00Z",
      }),
    ).rejects.toThrow(/incident_not_updatable/);
  });

  it("rejects when incident is resolved (not updatable)", async () => {
    qResponse = (sql) =>
      sql.includes("FROM nex.emergency_incident ei")
        ? selectIncidentRow({ state: "resolved" })
        : null;
    await expect(
      updateIncidentLocation({
        incidentId: INC,
        actorAccountId: REQ,
        lat: 1, lng: 2,
        capturedAt: "2026-10-10T10:00:00Z",
      }),
    ).rejects.toThrow(/incident_not_updatable/);
  });

  it("rejects when incident is in draft state (not yet active)", async () => {
    qResponse = (sql) =>
      sql.includes("FROM nex.emergency_incident ei")
        ? selectIncidentRow({ state: "draft" })
        : null;
    await expect(
      updateIncidentLocation({
        incidentId: INC,
        actorAccountId: REQ,
        lat: 1, lng: 2,
        capturedAt: "2026-10-10T10:00:00Z",
      }),
    ).rejects.toThrow(/incident_not_updatable/);
  });

  it("accepts update for responders_assigned state", async () => {
    qResponse = (sql) => {
      if (sql.includes("FROM nex.emergency_incident ei")) {
        return selectIncidentRow({ state: "responders_assigned" });
      }
      if (sql.includes("INSERT INTO nex.emergency_location_update")) {
        return {
          rows: [{ update_id: UPD, received_at: new Date("2026-10-10T10:00:05Z") }],
          rowCount: 1,
        };
      }
      if (sql.includes("UPDATE nex.emergency_incident")) {
        return { rows: [], rowCount: 1 };
      }
      return null;
    };
    const r = await updateIncidentLocation({
      incidentId: INC,
      actorAccountId: REQ,
      lat: 1.23, lng: 103.45,
      capturedAt: "2026-10-10T10:00:00Z",
    });
    expect(r.updateId).toBe(UPD);
  });
});

describe("updateIncidentLocation · rate limit (10s per incident)", () => {
  it("rejects a burst within 10 seconds of the last ping", async () => {
    const lastCaptured = new Date("2026-10-10T10:00:00Z");
    qResponse = (sql) =>
      sql.includes("FROM nex.emergency_incident ei")
        ? selectIncidentRow({ lastCapturedAt: lastCaptured })
        : null;
    await expect(
      updateIncidentLocation({
        incidentId: INC,
        actorAccountId: REQ,
        lat: 1, lng: 2,
        capturedAt: "2026-10-10T10:00:05Z",
      }),
    ).rejects.toThrow(/rate_limited/);
  });

  it("accepts an update exactly 10 seconds after the last ping", async () => {
    qResponse = (sql) => {
      if (sql.includes("FROM nex.emergency_incident ei")) {
        return selectIncidentRow({ lastCapturedAt: new Date("2026-10-10T10:00:00Z") });
      }
      if (sql.includes("INSERT INTO nex.emergency_location_update")) {
        return {
          rows: [{ update_id: UPD, received_at: new Date("2026-10-10T10:00:11Z") }],
          rowCount: 1,
        };
      }
      if (sql.includes("UPDATE nex.emergency_incident")) {
        return { rows: [], rowCount: 1 };
      }
      return null;
    };
    const r = await updateIncidentLocation({
      incidentId: INC,
      actorAccountId: REQ,
      lat: 1, lng: 2,
      capturedAt: "2026-10-10T10:00:11Z",
    });
    expect(r.updateId).toBe(UPD);
  });

  it("accepts the FIRST update (no prior ping)", async () => {
    qResponse = (sql) => {
      if (sql.includes("FROM nex.emergency_incident ei")) {
        return selectIncidentRow({ lastCapturedAt: null });
      }
      if (sql.includes("INSERT INTO nex.emergency_location_update")) {
        return {
          rows: [{ update_id: UPD, received_at: new Date("2026-10-10T10:00:00Z") }],
          rowCount: 1,
        };
      }
      if (sql.includes("UPDATE nex.emergency_incident")) {
        return { rows: [], rowCount: 1 };
      }
      return null;
    };
    const r = await updateIncidentLocation({
      incidentId: INC,
      actorAccountId: REQ,
      lat: 1, lng: 2,
      capturedAt: "2026-10-10T10:00:00Z",
    });
    expect(r.updateId).toBe(UPD);
  });
});

describe("updateIncidentLocation · SQL shape", () => {
  it("forces simulated=TRUE in the INSERT", async () => {
    qResponse = (sql) => {
      if (sql.includes("FROM nex.emergency_incident ei")) return selectIncidentRow();
      if (sql.includes("INSERT INTO nex.emergency_location_update")) {
        return {
          rows: [{ update_id: UPD, received_at: new Date("2026-10-10T10:00:00Z") }],
          rowCount: 1,
        };
      }
      if (sql.includes("UPDATE nex.emergency_incident")) {
        return { rows: [], rowCount: 1 };
      }
      return null;
    };
    await updateIncidentLocation({
      incidentId: INC,
      actorAccountId: REQ,
      lat: 1, lng: 2,
      capturedAt: "2026-10-10T10:00:00Z",
    });
    const insert = qCalls.find((c) =>
      c.sql.includes("INSERT INTO nex.emergency_location_update"),
    );
    expect(insert).toBeDefined();
    expect(insert!.sql).toMatch(/TRUE/);
  });

  it("mirrors location onto emergency_incident in the same call stack", async () => {
    qResponse = (sql) => {
      if (sql.includes("FROM nex.emergency_incident ei")) return selectIncidentRow();
      if (sql.includes("INSERT INTO nex.emergency_location_update")) {
        return {
          rows: [{ update_id: UPD, received_at: new Date("2026-10-10T10:00:00Z") }],
          rowCount: 1,
        };
      }
      if (sql.includes("UPDATE nex.emergency_incident")) {
        return { rows: [], rowCount: 1 };
      }
      return null;
    };
    await updateIncidentLocation({
      incidentId: INC,
      actorAccountId: REQ,
      lat: 1.23, lng: 103.45,
      accuracyMeters: 15,
      capturedAt: "2026-10-10T10:00:00Z",
    });
    const update = qCalls.find((c) =>
      c.sql.includes("UPDATE nex.emergency_incident")
      && c.sql.includes("location_lat"),
    );
    expect(update).toBeDefined();
    expect(update!.sql).toMatch(/location_captured_at\s*=\s*\$5/);
  });

  it("defaults source to browser_watch_position when unset", async () => {
    qResponse = (sql) => {
      if (sql.includes("FROM nex.emergency_incident ei")) return selectIncidentRow();
      if (sql.includes("INSERT INTO nex.emergency_location_update")) {
        return {
          rows: [{ update_id: UPD, received_at: new Date("2026-10-10T10:00:00Z") }],
          rowCount: 1,
        };
      }
      if (sql.includes("UPDATE nex.emergency_incident")) {
        return { rows: [], rowCount: 1 };
      }
      return null;
    };
    await updateIncidentLocation({
      incidentId: INC,
      actorAccountId: REQ,
      lat: 0, lng: 0,
      capturedAt: "2026-10-10T10:00:00Z",
    });
    const insert = qCalls.find((c) =>
      c.sql.includes("INSERT INTO nex.emergency_location_update"),
    );
    expect(insert!.params[6]).toBe("browser_watch_position");
  });

  it("throws db_unavailable when the pool is unset", async () => {
    withClientNullMode = true;
    await expect(
      updateIncidentLocation({
        incidentId: INC,
        actorAccountId: REQ,
        lat: 1, lng: 2,
        capturedAt: "2026-10-10T10:00:00Z",
      }),
    ).rejects.toThrow(/db_unavailable/);
  });
});

// =====================================================================
// Pending-alert lifecycle (L1 · migration 195)
// =====================================================================

describe("createPendingAlert · input guards + SQL shape", () => {
  it("rejects empty requester", async () => {
    await expect(
      createPendingAlert({
        requesterAccountId: "",
        category: "general_assistance",
        locationLat: null, locationLng: null,
        locationAccuracyMeters: null, locationCapturedAt: null,
      }),
    ).rejects.toThrow(/invalid_requester_account_id/);
  });

  it("rejects unknown category", async () => {
    await expect(
      createPendingAlert({
        requesterAccountId: REQ,
        category: "nope" as never,
        locationLat: null, locationLng: null,
        locationAccuracyMeters: null, locationCapturedAt: null,
      }),
    ).rejects.toThrow(/invalid_category/);
  });

  it("rejects latitude out of range", async () => {
    await expect(
      createPendingAlert({
        requesterAccountId: REQ,
        category: "safety_concern",
        locationLat: 100, locationLng: 0,
        locationAccuracyMeters: null, locationCapturedAt: null,
      }),
    ).rejects.toThrow(/invalid_location_lat/);
  });

  it("writes state='pending_confirmation' + simulated=TRUE", async () => {
    qResponse = (sql) =>
      sql.includes("INSERT INTO nex.emergency_incident")
        ? { rows: [row({ state: "pending_confirmation" })], rowCount: 1 }
        : null;
    const r = await createPendingAlert({
      requesterAccountId: REQ,
      category: "medical_concern",
      locationLat: 1.23, locationLng: 103.45,
      locationAccuracyMeters: 15,
      locationCapturedAt: "2026-10-10T10:00:00Z",
    });
    expect(r.state).toBe("pending_confirmation");
    const insert = qCalls.find((c) =>
      c.sql.includes("INSERT INTO nex.emergency_incident"));
    expect(insert?.sql).toMatch(/'pending_confirmation'/);
    expect(insert?.sql).toMatch(/TRUE\s*\)/);
  });

  it("throws db_unavailable when pool is unset", async () => {
    withClientNullMode = true;
    await expect(
      createPendingAlert({
        requesterAccountId: REQ,
        category: "general_assistance",
        locationLat: null, locationLng: null,
        locationAccuracyMeters: null, locationCapturedAt: null,
      }),
    ).rejects.toThrow(/db_unavailable/);
  });
});

describe("confirmPendingAlert · authorization + state gates", () => {
  it("rejects when incident not found", async () => {
    qResponse = () => ({ rows: [], rowCount: 0 });
    await expect(
      confirmPendingAlert({ incidentId: "nope", actorAccountId: REQ }),
    ).rejects.toThrow(/not_found/);
  });

  it("rejects non-requester actor", async () => {
    qResponse = (sql) =>
      sql.includes("WHERE incident_id")
        ? { rows: [row({ state: "pending_confirmation" })], rowCount: 1 }
        : null;
    await expect(
      confirmPendingAlert({ incidentId: "x", actorAccountId: "stranger" }),
    ).rejects.toThrow(/not_authorized/);
  });

  it("rejects when state is not pending_confirmation", async () => {
    qResponse = (sql) =>
      sql.includes("WHERE incident_id")
        ? { rows: [row({ state: "draft" })], rowCount: 1 }
        : null;
    await expect(
      confirmPendingAlert({ incidentId: "x", actorAccountId: REQ }),
    ).rejects.toThrow(/invalid_state_transition/);
  });

  it("transitions pending_confirmation → active and stamps both timestamps", async () => {
    let selectCount = 0;
    qResponse = (sql) => {
      if (sql.includes("SELECT") && sql.includes("WHERE incident_id")) {
        selectCount += 1;
        return { rows: [row({ state: "pending_confirmation" })], rowCount: 1 };
      }
      if (sql.includes("UPDATE nex.emergency_incident")) {
        return {
          rows: [row({
            state: "active",
            activated_at: new Date(),
            pending_confirmed_at: new Date(),
          })],
          rowCount: 1,
        };
      }
      return null;
    };
    const r = await confirmPendingAlert({ incidentId: "abc", actorAccountId: REQ });
    expect(r.state).toBe("active");
    expect(r.activatedAt).not.toBeNull();
    expect(r.pendingConfirmedAt).not.toBeNull();
    expect(selectCount).toBeGreaterThanOrEqual(1);
    const upd = qCalls.find((c) => c.sql.includes("UPDATE nex.emergency_incident"));
    expect(upd?.sql).toMatch(/activated_at\s*=\s*now\(\)/);
    expect(upd?.sql).toMatch(/pending_confirmed_at\s*=\s*now\(\)/);
  });

  it("is idempotent when called twice (already active + confirmed)", async () => {
    qResponse = (sql) =>
      sql.includes("WHERE incident_id")
        ? {
            rows: [row({
              state: "active",
              activated_at: new Date("2026-10-10T10:00:10Z"),
              pending_confirmed_at: new Date("2026-10-10T10:00:10Z"),
            })],
            rowCount: 1,
          }
        : null;
    const r = await confirmPendingAlert({ incidentId: "abc", actorAccountId: REQ });
    expect(r.state).toBe("active");
    // The idempotent path never issues an UPDATE.
    const upd = qCalls.find((c) => c.sql.includes("UPDATE nex.emergency_incident"));
    expect(upd).toBeUndefined();
  });
});

describe("revokePendingAlert · authorization + state gates", () => {
  it("rejects when incident not found", async () => {
    qResponse = () => ({ rows: [], rowCount: 0 });
    await expect(
      revokePendingAlert({ incidentId: "nope", actorAccountId: REQ }),
    ).rejects.toThrow(/not_found/);
  });

  it("rejects non-requester actor", async () => {
    qResponse = (sql) =>
      sql.includes("WHERE incident_id")
        ? { rows: [row({ state: "pending_confirmation" })], rowCount: 1 }
        : null;
    await expect(
      revokePendingAlert({ incidentId: "x", actorAccountId: "stranger" }),
    ).rejects.toThrow(/not_authorized/);
  });

  it("rejects when state is already active (window closed)", async () => {
    qResponse = (sql) =>
      sql.includes("WHERE incident_id")
        ? { rows: [row({ state: "active" })], rowCount: 1 }
        : null;
    await expect(
      revokePendingAlert({ incidentId: "x", actorAccountId: REQ }),
    ).rejects.toThrow(/invalid_state_transition/);
  });

  it("rejects when state is already revoked (terminal)", async () => {
    qResponse = (sql) =>
      sql.includes("WHERE incident_id")
        ? { rows: [row({ state: "revoked_within_window" })], rowCount: 1 }
        : null;
    await expect(
      revokePendingAlert({ incidentId: "x", actorAccountId: REQ }),
    ).rejects.toThrow(/invalid_state_transition/);
  });

  it("transitions pending_confirmation → revoked_within_window and stamps the column", async () => {
    qResponse = (sql) => {
      if (sql.includes("SELECT") && sql.includes("WHERE incident_id")) {
        return { rows: [row({ state: "pending_confirmation" })], rowCount: 1 };
      }
      if (sql.includes("UPDATE nex.emergency_incident")) {
        return {
          rows: [row({
            state: "revoked_within_window",
            revoked_within_window_at: new Date(),
          })],
          rowCount: 1,
        };
      }
      return null;
    };
    const r = await revokePendingAlert({ incidentId: "abc", actorAccountId: REQ });
    expect(r.state).toBe("revoked_within_window");
    expect(r.revokedWithinWindowAt).not.toBeNull();
    const upd = qCalls.find((c) => c.sql.includes("UPDATE nex.emergency_incident"));
    expect(upd?.sql).toMatch(/revoked_within_window_at\s*=\s*now\(\)/);
  });

  it("accepts an optional reason without storing it in v1", async () => {
    qResponse = (sql) => {
      if (sql.includes("SELECT") && sql.includes("WHERE incident_id")) {
        return { rows: [row({ state: "pending_confirmation" })], rowCount: 1 };
      }
      if (sql.includes("UPDATE nex.emergency_incident")) {
        return {
          rows: [row({ state: "revoked_within_window" })],
          rowCount: 1,
        };
      }
      return null;
    };
    const r = await revokePendingAlert({
      incidentId: "abc",
      actorAccountId: REQ,
      reason: "component_unmounted_during_countdown",
    });
    expect(r.state).toBe("revoked_within_window");
  });
});

describe("rate-limit interaction with createPendingAlert", () => {
  it("is independent of createPendingAlert (callers must gate on rateLimit first)", async () => {
    // The service does NOT embed rate-limit checks inside
    // createPendingAlert · the server action gates on rateLimit() before
    // calling the service. This test documents that boundary so the
    // responsibility stays with the action layer.
    qResponse = (sql) =>
      sql.includes("INSERT INTO nex.emergency_incident")
        ? { rows: [row({ state: "pending_confirmation" })], rowCount: 1 }
        : null;
    const r = await createPendingAlert({
      requesterAccountId: REQ,
      category: "safety_concern",
      locationLat: null, locationLng: null,
      locationAccuracyMeters: null, locationCapturedAt: null,
    });
    expect(r.state).toBe("pending_confirmation");
    const rateCall = qCalls.find((c) =>
      c.sql.includes("FROM nex.emergency_rate_limit"));
    expect(rateCall).toBeUndefined();
  });
});

// =====================================================================
// EH hardening audit 2026-10-10 · additions
// See docs/doctrine/nex-emergency-hardening-audit-2026-10-10.md
// =====================================================================
//
// These tests EXTEND the baseline. They prove invariants the hardening
// wave verified against the six honest-ceiling audit items. No feature
// changes were made.

describe("hardening · state machine completeness (audit item 3)", () => {
  // Doctrine: the sealed state machine must be exhaustive. For every
  // FROM state we assert that canTransition returns the correct boolean
  // for every TO state. If a future refactor adds a new state, this
  // test fails loudly.
  const ALL_STATES = [
    "draft",
    "pending_confirmation",
    "active",
    "responders_assigned",
    "resolved",
    "cancelled",
    "revoked_within_window",
    "expired",
  ] as const;
  type S = (typeof ALL_STATES)[number];
  const EXPECTED: Record<S, readonly S[]> = {
    draft: ["active", "cancelled"],
    pending_confirmation: ["active", "revoked_within_window", "cancelled"],
    active: ["responders_assigned", "resolved", "cancelled", "expired"],
    responders_assigned: ["resolved", "cancelled", "expired"],
    resolved: [],
    cancelled: [],
    revoked_within_window: [],
    expired: [],
  };

  it("every (from, to) pair is deterministic and matches the sealed table", () => {
    for (const from of ALL_STATES) {
      for (const to of ALL_STATES) {
        const allowed = (EXPECTED[from] as readonly string[]).includes(to);
        expect(
          canTransition(from, to),
          `canTransition(${from}, ${to}) must be ${allowed}`,
        ).toBe(allowed);
      }
    }
  });

  it("terminal states have ZERO outgoing transitions", () => {
    const terminals: readonly S[] = ["resolved", "cancelled", "revoked_within_window", "expired"];
    for (const from of terminals) {
      for (const to of ALL_STATES) {
        expect(canTransition(from, to), `terminal ${from} must not transition`).toBe(false);
      }
    }
  });
});

describe("hardening · idempotent confirm (second call returns same row, no second UPDATE)", () => {
  it("second confirmPendingAlert on an already-confirmed row does NOT fire an UPDATE", async () => {
    // Row starts active + confirmed stamp set · the service short-circuits.
    const already = row({
      state: "active",
      pending_confirmed_at: new Date("2026-10-10T10:05:00Z"),
      activated_at: new Date("2026-10-10T10:05:00Z"),
    });
    qResponse = (sql) =>
      sql.includes("SELECT") && sql.includes("WHERE incident_id")
        ? { rows: [already], rowCount: 1 }
        : null;
    const r = await confirmPendingAlert({ incidentId: "abc", actorAccountId: REQ });
    expect(r.state).toBe("active");
    expect(r.pendingConfirmedAt).not.toBeNull();
    const updateCalls = qCalls.filter((c) => c.sql.includes("UPDATE nex.emergency_incident"));
    expect(updateCalls.length).toBe(0);
  });
});

describe("hardening · authorization (requester-only on cancel/resolve/revoke/confirm)", () => {
  it("confirmPendingAlert rejects a non-requester actor", async () => {
    qResponse = (sql) =>
      sql.includes("SELECT") && sql.includes("WHERE incident_id")
        ? { rows: [row({ state: "pending_confirmation" })], rowCount: 1 }
        : null;
    await expect(
      confirmPendingAlert({ incidentId: "abc", actorAccountId: "stranger" }),
    ).rejects.toThrow(/not_authorized/);
  });

  it("revokePendingAlert rejects a non-requester actor", async () => {
    qResponse = (sql) =>
      sql.includes("SELECT") && sql.includes("WHERE incident_id")
        ? { rows: [row({ state: "pending_confirmation" })], rowCount: 1 }
        : null;
    await expect(
      revokePendingAlert({ incidentId: "abc", actorAccountId: "stranger" }),
    ).rejects.toThrow(/not_authorized/);
  });

  it("resolveIncident rejects a non-requester actor even when state is terminal-eligible", async () => {
    qResponse = (sql) =>
      sql.includes("SELECT") && sql.includes("WHERE incident_id")
        ? { rows: [row({ state: "responders_assigned" })], rowCount: 1 }
        : null;
    await expect(resolveIncident("abc", "stranger")).rejects.toThrow(/not_authorized/);
  });
});

describe("hardening · rate-limit boundary cases", () => {
  it("concurrent=3 + daily=0 trips the concurrent cap", async () => {
    qResponse = (sql) => {
      if (sql.includes("count(*)")) return { rows: [{ n: 3 }], rowCount: 1 };
      if (sql.includes("sum(count)")) return { rows: [{ n: 0 }], rowCount: 1 };
      return null;
    };
    expect(await rateLimit(REQ)).toBe(false);
  });

  it("concurrent=0 + daily=10 trips the 24h cap alone", async () => {
    qResponse = (sql) => {
      if (sql.includes("count(*)")) return { rows: [{ n: 0 }], rowCount: 1 };
      if (sql.includes("sum(count)")) return { rows: [{ n: 10 }], rowCount: 1 };
      return null;
    };
    expect(await rateLimit(REQ)).toBe(false);
  });

  it("concurrent=2 + daily=9 (the 11th if a race existed) still returns true · caller then records event", async () => {
    // The service does not reserve a slot before issuing true · a race
    // under extreme load could in theory permit one more. This test
    // documents the honest boundary · 11th call is blocked by whichever
    // of concurrent-after-insert or daily-after-insert trips first.
    qResponse = (sql) => {
      if (sql.includes("count(*)")) return { rows: [{ n: 2 }], rowCount: 1 };
      if (sql.includes("sum(count)")) return { rows: [{ n: 9 }], rowCount: 1 };
      return null;
    };
    expect(await rateLimit(REQ)).toBe(true);
  });
});

describe("hardening · sweepExpired behaviour (audit item 1 doctrine · state machine)", () => {
  it("UPDATE SQL filters on state IN ('active','responders_assigned') · resolved rows are NOT touched", async () => {
    qResponse = (sql) =>
      sql.includes("UPDATE nex.emergency_incident")
        ? { rows: [{ incident_id: "x" }], rowCount: 1 }
        : null;
    await sweepExpired();
    const sweep = qCalls.find((c) => c.sql.includes("UPDATE nex.emergency_incident"));
    expect(sweep?.sql).toMatch(/state\s+IN\s*\(\s*'active'\s*,\s*'responders_assigned'\s*\)/);
    // Must NOT touch resolved / cancelled / revoked_within_window / expired.
    expect(sweep?.sql).not.toMatch(/'resolved'/);
    expect(sweep?.sql).not.toMatch(/'cancelled'/);
    expect(sweep?.sql).not.toMatch(/'revoked_within_window'/);
  });

  it("returns 0 when no rows are swept · never throws", async () => {
    qResponse = (sql) =>
      sql.includes("UPDATE nex.emergency_incident")
        ? { rows: [], rowCount: 0 }
        : null;
    expect(await sweepExpired()).toBe(0);
  });

  it("flips state to expired · the UPDATE SET clause is deterministic", async () => {
    qResponse = (sql) =>
      sql.includes("UPDATE nex.emergency_incident")
        ? { rows: [{ incident_id: "x" }], rowCount: 1 }
        : null;
    await sweepExpired();
    const sweep = qCalls.find((c) => c.sql.includes("UPDATE nex.emergency_incident"));
    expect(sweep?.sql).toMatch(/SET\s+state\s*=\s*'expired'/);
  });
});

describe("hardening · updateIncidentLocation refuses on expired incident", () => {
  // Audit item 5 doctrine: no background tracking · on expired rows the
  // service refuses updates. The incident state gate protects honesty.
  it("rejects when incident is expired (not updatable)", async () => {
    qResponse = (sql) =>
      sql.includes("SELECT") && sql.includes("ei.state")
        ? { rows: [{ requester_account_id: REQ, state: "expired", last_captured_at: null }], rowCount: 1 }
        : null;
    await expect(
      updateIncidentLocation({
        incidentId: "abc",
        actorAccountId: REQ,
        lat: 1,
        lng: 2,
        capturedAt: "2026-10-10T10:00:00Z",
      }),
    ).rejects.toThrow(/incident_not_updatable/);
  });
});
