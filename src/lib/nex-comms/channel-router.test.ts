// src/lib/nex-comms/channel-router.test.ts

import { describe, it, expect } from "vitest";
import { routeChannel } from "./channel-router";
import type { CommsContact } from "./types";

function mkContact(): CommsContact {
  return {
    contactId: "c", canonicalPhoneE164: "+62812", email: "a@b.co", inAppUserRef: "user-1",
    displayName: null, jurisdiction: null, contactSource: null, contactSourceReference: null,
    firstSeenAt: new Date(), updatedAt: new Date(), provenance: {},
  };
}

describe("Channel router · free-first tier selection", () => {
  it("transactional with nex_in_app + whatsapp available → picks nex_in_app (tier 0)", () => {
    const r = routeChannel({
      contact: mkContact(), category: "transactional",
      availabilities: [
        { channel: "whatsapp",   costHintIdr: 200, available: true },
        { channel: "nex_in_app", costHintIdr: 0,   available: true },
      ],
    });
    expect(r.status).toBe("ROUTED");
    if (r.status === "ROUTED") {
      expect(r.chosenChannel).toBe("nex_in_app");
      expect(r.chosenTier).toBe(0);
    }
  });

  it("transactional with only whatsapp available → picks whatsapp", () => {
    const r = routeChannel({
      contact: mkContact(), category: "transactional",
      availabilities: [
        { channel: "whatsapp", costHintIdr: 200, available: true },
        { channel: "nex_in_app", costHintIdr: 0, available: false },
      ],
    });
    expect(r.status).toBe("ROUTED");
    if (r.status === "ROUTED") expect(r.chosenChannel).toBe("whatsapp");
  });

  it("no available channels → NO_CHANNEL_AVAILABLE", () => {
    const r = routeChannel({
      contact: mkContact(), category: "transactional",
      availabilities: [{ channel: "whatsapp", costHintIdr: 200, available: false }],
    });
    expect(r.status).toBe("NO_CHANNEL_AVAILABLE");
  });
});

describe("Channel router · category eligibility", () => {
  it("recruitment cannot use nex_in_app (discovered candidate has no app) → falls back to whatsapp", () => {
    const r = routeChannel({
      contact: mkContact(), category: "recruitment",
      availabilities: [
        { channel: "nex_in_app", costHintIdr: 0, available: true },
        { channel: "whatsapp",   costHintIdr: 200, available: true },
      ],
    });
    expect(r.status).toBe("ROUTED");
    if (r.status === "ROUTED") expect(r.chosenChannel).toBe("whatsapp");
  });

  it("marketing cannot use whatsapp (blocked at router)", () => {
    const r = routeChannel({
      contact: mkContact(), category: "marketing",
      availabilities: [
        { channel: "whatsapp", costHintIdr: 200, available: true },
      ],
    });
    expect(r.status).toBe("NO_CHANNEL_AVAILABLE");
  });
});

describe("Channel router · caller preference · cheaper-swap default on", () => {
  it("preferred whatsapp with cheaper email available → routes to email (swap on by default)", () => {
    const r = routeChannel({
      contact: mkContact(), category: "support",
      preferredChannels: ["whatsapp"],
      availabilities: [
        { channel: "email",   costHintIdr: 10,  available: true },
        { channel: "whatsapp", costHintIdr: 200, available: true },
      ],
    });
    if (r.status === "ROUTED") expect(r.chosenChannel).toBe("email");
  });

  it("preferred whatsapp with cheaper email · swap disabled → honours whatsapp", () => {
    const r = routeChannel({
      contact: mkContact(), category: "support",
      preferredChannels: ["whatsapp"],
      cheaperChannelSwapAllowed: false,
      availabilities: [
        { channel: "email",   costHintIdr: 10,  available: true },
        { channel: "whatsapp", costHintIdr: 200, available: true },
      ],
    });
    if (r.status === "ROUTED") expect(r.chosenChannel).toBe("whatsapp");
  });
});
