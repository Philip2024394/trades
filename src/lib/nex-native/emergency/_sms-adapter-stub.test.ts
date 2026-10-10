// src/lib/nex-native/emergency/_sms-adapter-stub.test.ts

import { describe, expect, it } from "vitest";
import {
  sendEmergencySMS,
  sendEmergencyWhatsApp,
} from "./_sms-adapter-stub";

describe("sendEmergencySMS · HONEST-BLOCKED (v1 PILOT)", () => {
  it("always returns ok=false with sealed reason 'sms_adapter_not_implemented'", async () => {
    const r = await sendEmergencySMS({
      to: "+6281234567",
      textBody: "pretend urgent",
      idempotencyKey: "k1",
      simulated: true,
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("sms_adapter_not_implemented");
    expect(r.channel).toBe("sms");
  });

  it("still returns ok=false when simulated=false (no fabrication path)", async () => {
    const r = await sendEmergencySMS({
      to: "+6281234567",
      textBody: "x",
      idempotencyKey: "k2",
      simulated: false,
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("sms_adapter_not_implemented");
    expect(r.simulated).toBe(false);
  });

  it("preserves the simulated flag in the response", async () => {
    const r = await sendEmergencySMS({
      to: "+6281234567",
      textBody: "x",
      idempotencyKey: "k3",
      simulated: true,
    });
    expect(r.simulated).toBe(true);
  });

  it("never returns ok=true for any input", async () => {
    const inputs = [
      { to: "+1", textBody: "", idempotencyKey: "a", simulated: true },
      { to: "", textBody: "x", idempotencyKey: "b", simulated: false },
      { to: "+6281", textBody: "x", idempotencyKey: "c", simulated: true },
    ] as const;
    for (const i of inputs) {
      const r = await sendEmergencySMS(i);
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      expect(r.ok).toBe(false);
    }
  });
});

describe("sendEmergencyWhatsApp · HONEST-BLOCKED (v1 PILOT)", () => {
  it("always returns ok=false with sealed reason", async () => {
    const r = await sendEmergencyWhatsApp({
      to: "+6281234567",
      textBody: "x",
      idempotencyKey: "k",
      simulated: true,
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("sms_adapter_not_implemented");
  });
});
