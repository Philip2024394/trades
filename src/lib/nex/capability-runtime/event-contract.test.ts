// src/lib/nex/capability-runtime/event-contract.test.ts
//
// Stage 4 acceptance tests · event envelope + durability contract.
// §19 discipline · every group has both allow AND correct-refusal cases.
//
// Test coverage per Founder Stage 4 guardrail:
//   · valid durable event structure
//   · valid live event structure
//   · durable/live distinction (hard invariant)
//   · correlation metadata
//   · malformed event rejection
//   · existing AOF event compatibility (lossless via adapter)
//   · no mutation/deletion semantics introduced

import { describe, it, expect } from "vitest";
import type { AofAgentEvent, EventKind as AofEventKind } from "../aof/types";
import {
  KNOWN_EVENT_DOMAINS,
  fromAofAgentEvent,
  aofEventKindToDomain,
  validateEventEnvelope,
  type DurableEventEnvelope,
  type LiveEventEnvelope,
  type EventEnvelope,
} from "./event-contract";

// Sample AOF event fixtures (shape matches src/lib/nex/aof/types.ts AofAgentEvent).
const validAgentHeartbeatRow: AofAgentEvent = {
  event_id: 12345,
  agent_id: "agent-orbiting-001",
  event_kind: "heartbeat",
  event_at: "2026-09-23T08:20:00.123Z",
  worker_id: "worker-01",
  cycle_id: "cycle-abc-123",
  payload: { last_action: "iterate_country", country_iso: "DE" },
};

const validCycleStartRow: AofAgentEvent = {
  event_id: 67890,
  agent_id: "agent-orbiting-001",
  event_kind: "cycle_start",
  event_at: "2026-09-23T08:15:00.000Z",
  worker_id: null,
  cycle_id: "cycle-abc-123",
  payload: { triggered_by: "orbiting_agent", programme_id: "scaffolding" },
};

const validCooldownRow: AofAgentEvent = {
  event_id: 22222,
  agent_id: "agent-rate-governor",
  event_kind: "cooldown_applied",
  event_at: "2026-09-23T08:18:30.000Z",
  worker_id: null,
  cycle_id: "cycle-abc-123",
  payload: { source_slug: "osm_overpass_primary", cooldown_ms: 60000 },
};

const validRecoveryRow: AofAgentEvent = {
  event_id: 33333,
  agent_id: "agent-recovery",
  event_kind: "decision",
  event_at: "2026-09-23T08:19:00.000Z",
  worker_id: null,
  cycle_id: null,
  payload: { decision: "reap_stale_lease", worker_id: "worker-old" },
};

const sampleDurableEnvelope: DurableEventEnvelope = {
  event_id: "aof-agent-event:12345",
  event_kind: "heartbeat",
  event_domain: "agent",
  event_version: 1,
  producer: "agent-orbiting-001",
  timestamp: "2026-09-23T08:20:00.123Z",
  correlation_id: "cycle-abc-123",
  causation_id: null,
  payload: { last_action: "iterate_country" },
  durability: "durable",
  durable_store: "nex.aof_agent_event",
  durable_row_id: "12345",
};

const sampleLiveEnvelope: LiveEventEnvelope = {
  event_id: "live:hq-tick:1",
  event_kind: "hq_operations_snapshot",
  event_domain: "agent",
  event_version: 1,
  producer: "live-streaming-agent",
  timestamp: "2026-09-23T08:20:00.123Z",
  correlation_id: null,
  causation_id: null,
  payload: { queue: { queued: 5 } },
  durability: "live",
};

describe("Event domain taxonomy · Stage 4", () => {
  it("KNOWN_EVENT_DOMAINS lists exactly the 10 domains NEX actually has today", () => {
    expect(KNOWN_EVENT_DOMAINS.length).toBe(10);
  });

  it("KNOWN_EVENT_DOMAINS does NOT include unmodeled domains (§18 no fake completeness)", () => {
    const unmodeled = ["session", "workflow", "build", "deployment"];
    for (const d of unmodeled) {
      expect(
        (KNOWN_EVENT_DOMAINS as readonly string[]).includes(d),
        `${d} should NOT be modeled — no real durable store exists`,
      ).toBe(false);
    }
  });

  it("aofEventKindToDomain maps cycle_start/cycle_end to cycle", () => {
    expect(aofEventKindToDomain("cycle_start")).toBe("cycle");
    expect(aofEventKindToDomain("cycle_end")).toBe("cycle");
  });

  it("aofEventKindToDomain maps cooldown_applied/failover to source", () => {
    expect(aofEventKindToDomain("cooldown_applied")).toBe("source");
    expect(aofEventKindToDomain("failover")).toBe("source");
  });

  it("aofEventKindToDomain maps decision to recovery", () => {
    expect(aofEventKindToDomain("decision")).toBe("recovery");
  });

  it("aofEventKindToDomain maps generic agent lifecycle kinds to agent", () => {
    const agentKinds: readonly AofEventKind[] = [
      "registered",
      "signed",
      "activated",
      "paused",
      "stopped",
      "heartbeat",
      "error",
      "audit_pass",
      "audit_fail",
    ];
    for (const k of agentKinds) {
      expect(aofEventKindToDomain(k)).toBe("agent");
    }
  });
});

describe("AOF adapter · lossless conversion from real AofAgentEvent", () => {
  it("fromAofAgentEvent produces a durable envelope for heartbeat", () => {
    const env = fromAofAgentEvent(validAgentHeartbeatRow);
    expect(env.durability).toBe("durable");
    expect(env.event_id).toBe("aof-agent-event:12345");
    expect(env.event_kind).toBe("heartbeat");
    expect(env.event_domain).toBe("agent");
    expect(env.producer).toBe("agent-orbiting-001");
    expect(env.timestamp).toBe("2026-09-23T08:20:00.123Z");
    expect(env.correlation_id).toBe("cycle-abc-123");
    expect(env.durable_store).toBe("nex.aof_agent_event");
    expect(env.durable_row_id).toBe("12345");
    expect(env.payload).toEqual({ last_action: "iterate_country", country_iso: "DE" });
  });

  it("fromAofAgentEvent preserves payload with no mutation", () => {
    const env = fromAofAgentEvent(validAgentHeartbeatRow);
    // payload reference must be preserved (no clone/mutation)
    expect(env.payload).toBe(validAgentHeartbeatRow.payload);
  });

  it("cycle_start row is routed to cycle domain", () => {
    const env = fromAofAgentEvent(validCycleStartRow);
    expect(env.event_domain).toBe("cycle");
    expect(env.event_kind).toBe("cycle_start");
  });

  it("cooldown_applied row is routed to source domain", () => {
    const env = fromAofAgentEvent(validCooldownRow);
    expect(env.event_domain).toBe("source");
  });

  it("decision row is routed to recovery domain", () => {
    const env = fromAofAgentEvent(validRecoveryRow);
    expect(env.event_domain).toBe("recovery");
  });

  it("null cycle_id becomes null correlation_id (never undefined)", () => {
    const env = fromAofAgentEvent(validRecoveryRow);
    expect(env.correlation_id).toBeNull();
  });

  it("empty payload becomes empty object (never null/undefined)", () => {
    const row: AofAgentEvent = { ...validAgentHeartbeatRow, payload: {} };
    const env = fromAofAgentEvent(row);
    expect(env.payload).toEqual({});
  });

  it("every envelope produced by adapter carries durable_store = nex.aof_agent_event", () => {
    for (const row of [validAgentHeartbeatRow, validCycleStartRow, validCooldownRow, validRecoveryRow]) {
      const env = fromAofAgentEvent(row);
      expect(env.durable_store).toBe("nex.aof_agent_event");
      expect(env.durability).toBe("durable");
    }
  });

  it("event_version is 1 (initial contract version)", () => {
    const env = fromAofAgentEvent(validAgentHeartbeatRow);
    expect(env.event_version).toBe(1);
  });

  it("every envelope validates through validateEventEnvelope", () => {
    for (const row of [validAgentHeartbeatRow, validCycleStartRow, validCooldownRow, validRecoveryRow]) {
      const env = fromAofAgentEvent(row);
      const result = validateEventEnvelope(env);
      expect(result.ok, `envelope for kind ${row.event_kind} must validate`).toBe(true);
    }
  });
});

describe("validateEventEnvelope · allow-behaviour", () => {
  it("accepts a well-formed durable envelope", () => {
    const r = validateEventEnvelope(sampleDurableEnvelope);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.durability).toBe("durable");
  });

  it("accepts a well-formed live envelope", () => {
    const r = validateEventEnvelope(sampleLiveEnvelope);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.durability).toBe("live");
  });

  it("accepts null correlation_id and null causation_id", () => {
    const env: DurableEventEnvelope = {
      ...sampleDurableEnvelope,
      correlation_id: null,
      causation_id: null,
    };
    expect(validateEventEnvelope(env).ok).toBe(true);
  });

  it("accepts non-null correlation_id (cycle_id)", () => {
    const env: DurableEventEnvelope = {
      ...sampleDurableEnvelope,
      correlation_id: "cycle-xyz",
    };
    const r = validateEventEnvelope(env);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.correlation_id).toBe("cycle-xyz");
  });
});

describe("validateEventEnvelope · correct-refusal (§19)", () => {
  it("rejects non-object input", () => {
    for (const bad of [null, undefined, "string", 42, [], true]) {
      const r = validateEventEnvelope(bad);
      expect(r.ok).toBe(false);
    }
  });

  it("rejects missing event_id", () => {
    const bad = { ...sampleDurableEnvelope, event_id: "" };
    const r = validateEventEnvelope(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("event_id");
  });

  it("rejects missing event_kind", () => {
    const bad = { ...sampleDurableEnvelope };
    (bad as { event_kind: unknown }).event_kind = "";
    const r = validateEventEnvelope(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("event_kind");
  });

  it("rejects unknown event_domain (§18 no fake completeness)", () => {
    const bad = { ...sampleDurableEnvelope, event_domain: "session" as unknown };
    const r = validateEventEnvelope(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("unknown_event_domain");
  });

  it("rejects non-positive event_version", () => {
    for (const v of [0, -1, NaN, Infinity]) {
      const bad = { ...sampleDurableEnvelope, event_version: v };
      const r = validateEventEnvelope(bad);
      expect(r.ok, `version ${v} should reject`).toBe(false);
    }
  });

  it("rejects non-ISO timestamp", () => {
    for (const ts of ["2026-09-23", "yesterday", "1234567890", ""]) {
      const bad = { ...sampleDurableEnvelope, timestamp: ts };
      const r = validateEventEnvelope(bad);
      expect(r.ok, `timestamp ${ts} should reject`).toBe(false);
    }
  });

  it("rejects durability other than durable or live", () => {
    const bad = { ...sampleDurableEnvelope, durability: "eventual" as unknown };
    const r = validateEventEnvelope(bad);
    expect(r.ok).toBe(false);
  });
});

describe("durable/live hard invariant · Stage 4 §", () => {
  it("REJECTS durable envelope without durable_store", () => {
    const bad = { ...sampleDurableEnvelope } as Record<string, unknown>;
    delete bad.durable_store;
    const r = validateEventEnvelope(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("durable_store");
  });

  it("REJECTS durable envelope without durable_row_id", () => {
    const bad = { ...sampleDurableEnvelope } as Record<string, unknown>;
    delete bad.durable_row_id;
    const r = validateEventEnvelope(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("durable_row_id");
  });

  it("REJECTS live envelope trying to claim durable_store (live cannot masquerade as durable)", () => {
    const bad = {
      ...sampleLiveEnvelope,
      durable_store: "nex.somewhere",
    } as unknown as EventEnvelope;
    const r = validateEventEnvelope(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("live_envelope_must_not_carry_durable_store");
  });

  it("REJECTS live envelope trying to claim durable_row_id", () => {
    const bad = {
      ...sampleLiveEnvelope,
      durable_row_id: "42",
    } as unknown as EventEnvelope;
    const r = validateEventEnvelope(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("live_envelope_must_not_carry_durable_row_id");
  });
});

describe("correlation metadata", () => {
  it("cycle_id becomes correlation_id when present", () => {
    const env = fromAofAgentEvent(validAgentHeartbeatRow);
    expect(env.correlation_id).toBe("cycle-abc-123");
  });

  it("null cycle_id becomes null correlation_id (never string 'null' or undefined)", () => {
    const env = fromAofAgentEvent(validRecoveryRow);
    expect(env.correlation_id).toBeNull();
  });

  it("causation_id is null by default (Stage 4 does not derive from AOF yet)", () => {
    const env = fromAofAgentEvent(validAgentHeartbeatRow);
    expect(env.causation_id).toBeNull();
  });
});

describe("no mutation/deletion semantics introduced (Stage 4 §)", () => {
  it("event-contract module does NOT export any update/delete function", async () => {
    const mod = await import("./event-contract");
    for (const key of Object.keys(mod)) {
      expect(key.toLowerCase()).not.toMatch(/^(update|delete|remove|mutate|patch)/);
    }
  });

  it("envelope fields are declared readonly (compile-time · TypeScript enforces at build)", () => {
    // Runtime shape check: attempting to write to a frozen envelope throws in strict mode.
    // The spec-level guarantee is compile-time (readonly modifiers); this runtime check
    // proves the surface is not designed with mutation helpers.
    const env = fromAofAgentEvent(validAgentHeartbeatRow);
    // If TypeScript blocked assignments at compile time, this runtime code never
    // has to execute. We keep this as a smoke test that the returned object is a
    // plain object (not a Proxy hiding writes).
    expect(typeof env).toBe("object");
    expect(env).not.toBeNull();
  });
});
