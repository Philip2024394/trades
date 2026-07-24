// Event bus — subscribe, publish, priority ordering, dead-letter.
// Runs against the in-process bus. No Supabase (persistEvent silently
// fails without env, and dispatch still runs).

import { describe, it, expect, beforeEach } from "vitest";
import { registerSubscriber, envelope, eventBus } from "./event-bus";
import type { EventHandler } from "./runtime";

function trackingHandler(name: string, calls: string[]): EventHandler<{ n: number }> {
  return {
    name,
    async handle(event) { calls.push(`${name}:${event.payload.n}`); }
  };
}

describe("Trade OS event bus", () => {
  let calls: string[];

  beforeEach(() => {
    calls = [];
  });

  it("dispatches to a registered subscriber", async () => {
    registerSubscriber({
      event:    "Test.HelloWorld.v1",
      priority: 3,
      handler:  trackingHandler("hello", calls)
    });
    await eventBus.publish(envelope({
      type: "Test.HelloWorld.v1" as unknown as "Brand.Updated.v1",
      payload: { n: 1 },
      producer: "test"
    }));
    expect(calls).toContain("hello:1");
  });

  it("respects priority ordering (lower priority first)", async () => {
    registerSubscriber({
      event:    "Test.Priority.v1",
      priority: 9,
      handler:  trackingHandler("late", calls)
    });
    registerSubscriber({
      event:    "Test.Priority.v1",
      priority: 1,
      handler:  trackingHandler("early", calls)
    });
    await eventBus.publish(envelope({
      type: "Test.Priority.v1" as unknown as "Brand.Updated.v1",
      payload: { n: 1 },
      producer: "test"
    }));
    expect(calls[0]).toBe("early:1");
    expect(calls[1]).toBe("late:1");
  });

  it("builds envelope with defaults", () => {
    const env = envelope({
      type:    "Brand.Updated.v1",
      payload: { hello: "world" },
      producer: "test"
    });
    expect(env.id).toMatch(/[a-f0-9-]+/);
    expect(env.correlationId).toMatch(/[a-f0-9-]+/);
    expect(env.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(env.version).toBe(1);
    expect(env.producer).toBe("test");
  });
});
