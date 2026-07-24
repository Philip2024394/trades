import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { brainRegistry, loadBrain } from "./_loader";
import { withBrain } from "./_catalog_hook";
import { fixtureBrainPack } from "./__tests__/_fixture_only";
import type { Agent, AgentInvocationContext, AgentResult } from "@/lib/nex/orch/types";
import { evidenceFor } from "@/lib/nex/orch/types";

const ORIGINAL = process.env.NEX_BRAIN_RUNTIME_ENABLED;

function baseAgent(): Agent {
  return {
    id: "electrical",
    name: "Electrical Agent",
    role: "test",
    speciality: "trade_craft",
    category: "trades",
    permissions: ["read_knowledge"],
    version: "test",
    tools: [],
    country_support: ["UK"],
    expertise_keywords: ["test1"],
    invoke: async (_: AgentInvocationContext): Promise<AgentResult> => ({
      agent_id:    "electrical",
      headline:    "fallback path",
      speak:       "fallback path",
      confidence:  "low",
      is_official: false,
      evidence:    evidenceFor("fallback", [])
    })
  };
}

beforeEach(() => {
  brainRegistry.clear();
  delete process.env.NEX_BRAIN_RUNTIME_ENABLED;
});
afterEach(() => {
  if (ORIGINAL == null) delete process.env.NEX_BRAIN_RUNTIME_ENABLED;
  else process.env.NEX_BRAIN_RUNTIME_ENABLED = ORIGINAL;
});

describe("withBrain catalog hook", () => {
  it("falls back to base invoke when flag is OFF", async () => {
    brainRegistry.register(loadBrain(fixtureBrainPack({ slug: "fixture_ok" })));
    const wrapped = withBrain({ base: baseAgent(), brain_slug: "fixture_ok" });

    const result = await wrapped.invoke({
      merchant_slug: "m1",
      focus_ask: "test1",
      prior: []
    });
    expect(result.headline).toBe("fallback path");
  });

  it("falls back when Brain is not registered even if flag ON", async () => {
    process.env.NEX_BRAIN_RUNTIME_ENABLED = "1";
    const wrapped = withBrain({ base: baseAgent(), brain_slug: "missing_brain" });

    const result = await wrapped.invoke({
      merchant_slug: "m1",
      focus_ask: "test1",
      prior: []
    });
    expect(result.headline).toBe("fallback path");
  });

  it("routes through the Brain when flag ON + Brain registered", async () => {
    process.env.NEX_BRAIN_RUNTIME_ENABLED = "1";
    brainRegistry.register(loadBrain(fixtureBrainPack({ slug: "fixture_ok" })));
    const wrapped = withBrain({ base: baseAgent(), brain_slug: "fixture_ok" });

    const result = await wrapped.invoke({
      merchant_slug: "m1",
      focus_ask: "test1",
      prior: []
    });
    expect(result.metadata?.brain_slug).toBe("fixture_ok");
  });
});
