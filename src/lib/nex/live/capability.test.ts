// src/lib/nex/live/capability.test.ts
// NEX LIVE · Phase A · capability contract

import { describe, it, expect } from "vitest";
import {
  projectCapabilityState,
  deriveWatchFacet,
  deriveChatFacet,
  deriveRegistryFacet,
  canPresentCapability,
  toExistingCapabilityKind,
} from "./capability";
import type { ContactabilityAssessment } from "../brain/interest/contactability";

const NOW = "2026-09-06T00:00:00.000Z";

describe("capability · projectCapabilityState", () => {
  it("VERIFIED + not stale → VERIFIED", () => {
    expect(projectCapabilityState("VERIFIED", false)).toBe("VERIFIED");
  });
  it("VERIFIED + stale → STALE (Live-specific degradation)", () => {
    expect(projectCapabilityState("VERIFIED", true)).toBe("STALE");
  });
  it("UNKNOWN + stale → UNKNOWN (no promotion via staleness)", () => {
    expect(projectCapabilityState("UNKNOWN", true)).toBe("UNKNOWN");
  });
  it("UNAVAILABLE + stale → UNAVAILABLE", () => {
    expect(projectCapabilityState("UNAVAILABLE", true)).toBe("UNAVAILABLE");
  });
});

describe("capability · deriveWatchFacet", () => {
  it("discoverable + fresh + not ended → VERIFIED", () => {
    const f = deriveWatchFacet({ isDiscoverable: true, isFresh: true, isEnded: false, nowIso: NOW });
    expect(f.state).toBe("VERIFIED");
    expect(f.reason).toBe("live_now_fresh");
  });
  it("discoverable + NOT fresh → STALE (never claims VERIFIED)", () => {
    const f = deriveWatchFacet({ isDiscoverable: true, isFresh: false, isEnded: false, nowIso: NOW });
    expect(f.state).toBe("STALE");
    expect(f.reason).toBe("no_recent_heartbeat");
  });
  it("ended → UNAVAILABLE", () => {
    const f = deriveWatchFacet({ isDiscoverable: true, isFresh: true, isEnded: true, nowIso: NOW });
    expect(f.state).toBe("UNAVAILABLE");
    expect(f.reason).toBe("live_ended");
  });
  it("not discoverable → UNKNOWN (never surfaces to end user as WATCH)", () => {
    const f = deriveWatchFacet({ isDiscoverable: false, isFresh: false, isEnded: false, nowIso: NOW });
    expect(f.state).toBe("UNKNOWN");
    expect(f.reason).toBe("not_discoverable");
  });
});

function assess(state: ContactabilityAssessment["state"], send: boolean): ContactabilityAssessment {
  return {
    state,
    channels: [],
    interest_send_enabled: send,
    open_url: null,
    reason: "test",
  } as unknown as ContactabilityAssessment;
}

describe("capability · deriveChatFacet · §26 no invented chat channels", () => {
  it("VERIFIED_CONTACT + interest_send_enabled → VERIFIED", () => {
    const f = deriveChatFacet({ assessment: assess("VERIFIED_CONTACT", true), nowIso: NOW });
    expect(f.state).toBe("VERIFIED");
  });
  it("VERIFIED_CONTACT + interest_send_enabled=false → UNKNOWN (never VERIFIED)", () => {
    const f = deriveChatFacet({ assessment: assess("VERIFIED_CONTACT", false), nowIso: NOW });
    expect(f.state).not.toBe("VERIFIED");
  });
  it("NO_VERIFIED_CONTACT → UNAVAILABLE (never fabricates a chat channel)", () => {
    const f = deriveChatFacet({ assessment: assess("NO_VERIFIED_CONTACT", false), nowIso: NOW });
    expect(f.state).toBe("UNAVAILABLE");
    expect(f.reason).toBe("no_verified_contact_channel");
  });
  it("STALE_CONTACT → STALE (never rendered as verified)", () => {
    const f = deriveChatFacet({ assessment: assess("STALE_CONTACT", false), nowIso: NOW });
    expect(f.state).toBe("STALE");
  });
  it("UNKNOWN_CONTACT → UNKNOWN", () => {
    const f = deriveChatFacet({ assessment: assess("UNKNOWN_CONTACT", false), nowIso: NOW });
    expect(f.state).toBe("UNKNOWN");
  });
  it("null assessment → UNKNOWN (never fabricates)", () => {
    const f = deriveChatFacet({ assessment: null, nowIso: NOW });
    expect(f.state).toBe("UNKNOWN");
    expect(f.reason).toBe("no_contactability_assessment");
  });
});

describe("capability · deriveRegistryFacet honours existing CAPABILITY_REGISTRY", () => {
  it("VERIFIED base → VERIFIED", () => {
    const f = deriveRegistryFacet({ kind: "BOOK_ARTIST", registryState: "VERIFIED", isStale: false, nowIso: NOW });
    expect(f.state).toBe("VERIFIED");
  });
  it("undefined base → UNKNOWN (never invents)", () => {
    const f = deriveRegistryFacet({ kind: "BOOK_ARTIST", registryState: undefined, isStale: false, nowIso: NOW });
    expect(f.state).toBe("UNKNOWN");
  });
  it("VERIFIED + stale → STALE", () => {
    const f = deriveRegistryFacet({ kind: "ORDER_DISH", registryState: "VERIFIED", isStale: true, nowIso: NOW });
    expect(f.state).toBe("STALE");
  });
});

describe("capability · canPresentCapability enforces VERIFIED-only surfacing", () => {
  it("VERIFIED facet may be presented", () => {
    expect(canPresentCapability({ kind: "CHAT", state: "VERIFIED", reason: "x", assessed_at_iso: NOW })).toBe(true);
  });
  it("STALE facet may NOT be presented", () => {
    expect(canPresentCapability({ kind: "CHAT", state: "STALE", reason: "x", assessed_at_iso: NOW })).toBe(false);
  });
  it("UNKNOWN facet may NOT be presented", () => {
    expect(canPresentCapability({ kind: "CHAT", state: "UNKNOWN", reason: "x", assessed_at_iso: NOW })).toBe(false);
  });
  it("UNAVAILABLE facet may NOT be presented", () => {
    expect(canPresentCapability({ kind: "CHAT", state: "UNAVAILABLE", reason: "x", assessed_at_iso: NOW })).toBe(false);
  });
});

describe("capability · toExistingCapabilityKind bridge to existing registry", () => {
  it("BOOK_ARTIST → BOOKING", () => expect(toExistingCapabilityKind("BOOK_ARTIST")).toBe("BOOKING"));
  it("RESERVE_TABLE → BOOKING", () => expect(toExistingCapabilityKind("RESERVE_TABLE")).toBe("BOOKING"));
  it("ORDER_DISH → PURCHASE", () => expect(toExistingCapabilityKind("ORDER_DISH")).toBe("PURCHASE"));
  it("BUY_PRODUCT → PURCHASE", () => expect(toExistingCapabilityKind("BUY_PRODUCT")).toBe("PURCHASE"));
  it("CHAT → CONTACT", () => expect(toExistingCapabilityKind("CHAT")).toBe("CONTACT"));
  it("SHOW_MENU → GENERIC", () => expect(toExistingCapabilityKind("SHOW_MENU")).toBe("GENERIC"));
  it("WATCH → null (no existing registry entry — evidence-driven)", () => expect(toExistingCapabilityKind("WATCH")).toBe(null));
});
