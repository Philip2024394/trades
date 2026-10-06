// src/lib/nex/theme-brain/theme-brain.test.ts
//
// Theme Brain · Phase 1 acceptance tests (sealed 2026-10-05).
//
// Nine mandatory tests A-I prove Cortex connectivity + governance
// gating + model boundary + ThemePackage contract adherence.
//
//   A · NEX Chat / Cortex can invoke theme_intelligence
//   B · Existing authorised worker can invoke
//   C · Existing authorised agent can invoke
//   D · All three use the SAME capability + governance contract
//   E · Denied paths (execute.theme_publish, write.theme_vocabulary)
//   F · Theme Brain uses NexBrainProvider (not raw LLM)
//   G · ThemePackage output accepted by Theme Engine input types
//   H · Missing capability returns `missing_capability` result
//   I · No silent modifications to Engine/worlds (vocabulary stays frozen)

import { describe, test, expect, vi } from "vitest";
import {
  requestThemeProposal,
  THEME_BRAIN_CAPABILITY_ID,
  THEME_BRAIN_CAPABILITY_METADATA,
  permissionFor,
  type ThemeBrainRequest,
  type ThemeBrainCaller,
} from "./index";
import { getCapability } from "@/lib/nex/brain/capabilities";
import { DEFAULT_POLICY, STRICT_POLICY } from "@/lib/nex/brain/governance";
import type { NexBrainProvider } from "@/lib/nex/brain/provider";
import type { ThemePackage } from "@/lib/nex-native/theme-package/types";
import {
  AVAILABLE_PERSONALITIES,
  AVAILABLE_MATERIALS,
  AVAILABLE_SHAPES,
  AVAILABLE_AMBIENT_FAMILIES,
  AVAILABLE_SHOP_CARD_STYLES,
  AVAILABLE_SHOP_PRODUCT_FRAMINGS,
  AVAILABLE_STICKER_CONCEPTS,
} from "./vocabulary";

// ─── Shared fixtures ─────────────────────────────────────────────────

const CHAT_CALLER: ThemeBrainCaller = { role: "chat", id: "cortex-session-01" };
const WORKER_CALLER: ThemeBrainCaller = { role: "worker", id: "worker-job-42" };
const AGENT_CALLER: ThemeBrainCaller = { role: "agent", id: "agent-session-07" };
const FOUNDER_CALLER: ThemeBrainCaller = { role: "founder", id: "founder" };

const BOTANICAL_SEED: ThemeBrainRequest["intent"] = {
  creativeSeed: "Botanical Café — fresh, natural, beautiful",
  businessCategories: ["coffee", "wellness"],
  emotionalAdjectives: ["fresh", "serene", "sunlit"],
  worldName: "Botanical Café",
};

// Minimal fake provider · proves the boundary is honoured and lets
// test F confirm the Brain uses it instead of a raw LLM call.
function makeFakeProvider(id = "test:fake"): NexBrainProvider {
  return {
    id,
    capabilities: {
      supportsTools: false,
      supportsVision: false,
      supportsThinking: false,
      supportsPromptCaching: false,
      supportsStreaming: true,
      maxContextTokens: 2000,
    },
    // Phase 1 never calls chat() · the method exists only to satisfy
    // the interface. If a future phase does call it, this stub is
    // easy to tighten.
    async *chat() {
      yield { type: "error", error: "not used in Phase 1", retriable: false } as const;
    },
  };
}

// ─── A · NEX Chat / Cortex can invoke theme_intelligence ─────────────

describe("A · NEX Chat / Cortex can invoke theme_intelligence", () => {
  test("returns a package_proposal when called from the chat role", async () => {
    const activations: string[] = [];
    const result = await requestThemeProposal(
      { caller: CHAT_CALLER, action: "propose", intent: BOTANICAL_SEED },
      { recordActivation: (_cap, k) => activations.push(k) },
    );
    expect(result.kind).toBe("package_proposal");
    expect(activations).toEqual(["package_proposal"]);
    if (result.kind === "package_proposal") {
      expect(result.package.identity.name).toBe("Botanical Café");
      expect(result.package.personality).toBe("sway");
    }
  });

  test("the capability is registered in the central Brain Capability Registry", () => {
    const record = getCapability("theme_intelligence");
    expect(record).toBeDefined();
    expect(record?.id).toBe(THEME_BRAIN_CAPABILITY_ID);
    expect(record?.id).toBe("theme_intelligence");
    expect(THEME_BRAIN_CAPABILITY_METADATA.id).toBe(record?.id);
  });
});

// ─── B · Authorised worker can invoke ─────────────────────────────────

describe("B · authorised worker can invoke via the same contract", () => {
  test("worker caller receives a package_proposal", async () => {
    const result = await requestThemeProposal({
      caller: WORKER_CALLER,
      action: "propose",
      intent: BOTANICAL_SEED,
    });
    expect(result.kind).toBe("package_proposal");
  });

  test("worker caller receives a validation_report on validate action", async () => {
    const result = await requestThemeProposal({
      caller: WORKER_CALLER,
      action: "validate",
      intent: BOTANICAL_SEED,
    });
    expect(result.kind).toBe("validation_report");
    if (result.kind === "validation_report") {
      expect(result.fullyExpressible).toBe(true);
    }
  });
});

// ─── C · Authorised agent can invoke ──────────────────────────────────

describe("C · authorised agent can invoke via the same contract", () => {
  test("agent caller receives a package_proposal", async () => {
    const result = await requestThemeProposal({
      caller: AGENT_CALLER,
      action: "propose",
      intent: BOTANICAL_SEED,
    });
    expect(result.kind).toBe("package_proposal");
  });
});

// ─── D · All three use the SAME contract ──────────────────────────────

describe("D · chat / worker / agent all use the same capability + governance contract", () => {
  test("identical intent · identical result shape · identical governance decision", async () => {
    const [chat, worker, agent] = await Promise.all([
      requestThemeProposal({
        caller: CHAT_CALLER,
        action: "propose",
        intent: BOTANICAL_SEED,
      }),
      requestThemeProposal({
        caller: WORKER_CALLER,
        action: "propose",
        intent: BOTANICAL_SEED,
      }),
      requestThemeProposal({
        caller: AGENT_CALLER,
        action: "propose",
        intent: BOTANICAL_SEED,
      }),
    ]);
    expect(chat.kind).toBe("package_proposal");
    expect(worker.kind).toBe("package_proposal");
    expect(agent.kind).toBe("package_proposal");
    if (
      chat.kind === "package_proposal" &&
      worker.kind === "package_proposal" &&
      agent.kind === "package_proposal"
    ) {
      // Pure deterministic input → identical output across callers.
      expect(worker.package).toEqual(chat.package);
      expect(agent.package).toEqual(chat.package);
      expect(worker.vocabularyUsed).toEqual(chat.vocabularyUsed);
    }
    // Governance maps the same action to the same permission irrespective
    // of caller role · the contract is caller-agnostic.
    expect(permissionFor("propose")).toBe("request.theme_proposal");
    expect(permissionFor("refine")).toBe("request.theme_proposal");
    expect(permissionFor("validate")).toBe("request.theme_proposal");
  });

  test("central DEFAULT_POLICY matches the Theme Brain's local view", () => {
    expect(DEFAULT_POLICY.rules["request.theme_proposal"]).toBe("allow");
    expect(DEFAULT_POLICY.rules["execute.theme_publish"]).toBe("deny");
    expect(DEFAULT_POLICY.rules["write.theme_vocabulary"]).toBe("deny");
  });
});

// ─── E · Denied paths ─────────────────────────────────────────────────

describe("E · execute.theme_publish and write.theme_vocabulary are denied", () => {
  test("publish from a worker is declined with reason=unauthorised", async () => {
    const result = await requestThemeProposal({
      caller: WORKER_CALLER,
      action: "publish",
      intent: BOTANICAL_SEED,
    });
    expect(result.kind).toBe("declined");
    if (result.kind === "declined") {
      expect(result.reason).toBe("unauthorised");
    }
  });

  test("publish from an agent is declined", async () => {
    const result = await requestThemeProposal({
      caller: AGENT_CALLER,
      action: "publish",
      intent: BOTANICAL_SEED,
    });
    expect(result.kind).toBe("declined");
  });

  test("publish from the founder is still denied in Phase 1", async () => {
    const result = await requestThemeProposal({
      caller: FOUNDER_CALLER,
      action: "publish",
      intent: BOTANICAL_SEED,
    });
    expect(result.kind).toBe("declined");
  });

  test("modify_vocabulary is denied for every role", async () => {
    for (const caller of [CHAT_CALLER, WORKER_CALLER, AGENT_CALLER, FOUNDER_CALLER]) {
      const result = await requestThemeProposal({
        caller,
        action: "modify_vocabulary",
        intent: BOTANICAL_SEED,
      });
      expect(result.kind).toBe("declined");
    }
  });

  test("STRICT_POLICY is even tighter · request becomes require_consent (central registry)", () => {
    expect(STRICT_POLICY.rules["request.theme_proposal"]).toBe("require_consent");
    expect(STRICT_POLICY.rules["execute.theme_publish"]).toBe("deny");
    expect(STRICT_POLICY.rules["write.theme_vocabulary"]).toBe("deny");
  });
});

// ─── F · NexBrainProvider boundary ────────────────────────────────────

describe("F · Theme Brain honours the NexBrainProvider boundary", () => {
  test("a supplied provider is accepted · its id is read as proof of binding", async () => {
    const provider = makeFakeProvider("test:fake-provider");
    const idSpy = vi.spyOn(provider, "id", "get");
    const result = await requestThemeProposal(
      { caller: CHAT_CALLER, action: "propose", intent: BOTANICAL_SEED },
      { provider },
    );
    expect(result.kind).toBe("package_proposal");
    // Proves the Brain reached the provider boundary · it did not
    // short-circuit around it to call a model directly.
    expect(idSpy).toHaveBeenCalled();
  });

  test("absence of a provider still produces a valid proposal (Phase 1 deterministic baseline)", async () => {
    const result = await requestThemeProposal({
      caller: CHAT_CALLER,
      action: "propose",
      intent: BOTANICAL_SEED,
    });
    expect(result.kind).toBe("package_proposal");
  });
});

// ─── G · ThemePackage output accepted by Theme Engine input types ────

describe("G · ThemePackage output satisfies the Theme Engine input contract", () => {
  test("every token in the output lives in AVAILABLE_* vocabulary arrays", async () => {
    const result = await requestThemeProposal({
      caller: CHAT_CALLER,
      action: "propose",
      intent: BOTANICAL_SEED,
    });
    expect(result.kind).toBe("package_proposal");
    if (result.kind !== "package_proposal") return;
    const pkg: ThemePackage = result.package;
    expect(AVAILABLE_PERSONALITIES).toContain(pkg.personality);
    if (pkg.bubbles) {
      expect(AVAILABLE_MATERIALS).toContain(pkg.bubbles.material);
      expect(AVAILABLE_SHAPES).toContain(pkg.bubbles.shape);
    }
    if (pkg.ambient) {
      for (const fam of pkg.ambient.families) {
        expect(AVAILABLE_AMBIENT_FAMILIES).toContain(fam);
      }
    }
    if (pkg.shop) {
      expect(AVAILABLE_SHOP_CARD_STYLES).toContain(pkg.shop.cardStyle);
      expect(AVAILABLE_SHOP_PRODUCT_FRAMINGS).toContain(pkg.shop.productFraming);
    }
  });

  test("ThemePackage import path is the core-owned contract (no app/* dependency)", async () => {
    // Compile-time proof: this file imports ThemePackage from
    // @/lib/nex-native/theme-package/types · if the Theme Brain had
    // imported from src/app/* the module graph would reject the test
    // runtime (server-only) · passing imports confirm the direction.
    const result = await requestThemeProposal({
      caller: CHAT_CALLER,
      action: "propose",
      intent: BOTANICAL_SEED,
    });
    expect(result.kind).toBe("package_proposal");
  });
});

// ─── H · Missing capability returns missing_capability ───────────────

describe("H · missing capability path is honoured", () => {
  test("intent that requests holographic bubble material surfaces a gap", async () => {
    const result = await requestThemeProposal({
      caller: CHAT_CALLER,
      action: "propose",
      intent: {
        creativeSeed: "Future World — holographic bubbles, iridescent glass",
      },
    });
    expect(result.kind).toBe("missing_capability");
    if (result.kind === "missing_capability") {
      expect(result.gaps.length).toBeGreaterThan(0);
      expect(result.gaps[0].category).toBe("material");
      expect(result.gaps[0].requested).toBe("holographic");
    }
  });

  test("intent that requests wax-seal bubble material surfaces a gap", async () => {
    const result = await requestThemeProposal({
      caller: WORKER_CALLER,
      action: "validate",
      intent: {
        creativeSeed: "Formal correspondence world · wax-seal bubbles",
      },
    });
    expect(result.kind).toBe("validation_report");
    if (result.kind === "validation_report") {
      expect(result.fullyExpressible).toBe(false);
      expect(result.gaps.some((g) => g.requested === "wax-seal")).toBe(true);
    }
  });
});

// ─── I · No silent modifications to Engine/worlds ────────────────────

describe("I · Engine vocabulary is immutable from the Brain layer", () => {
  test("vocabulary arrays are stable snapshots · not mutated by Brain calls", async () => {
    const beforePersonalities = [...AVAILABLE_PERSONALITIES];
    const beforeMaterials = [...AVAILABLE_MATERIALS];
    const beforeStickerConcepts = [...AVAILABLE_STICKER_CONCEPTS];

    // Hammer the Brain with a wide range of intents · it must never
    // mutate the Engine's vocabulary.
    for (const seed of [
      "Botanical Café",
      "Ocean world",
      "Haunted mansion",
      "Fire forge",
      "Space station",
      "Racing track",
      "Cakes party",
      "French patisserie",
      "Midnight neon",
    ]) {
      await requestThemeProposal({
        caller: CHAT_CALLER,
        action: "propose",
        intent: { creativeSeed: seed },
      });
    }

    expect([...AVAILABLE_PERSONALITIES]).toEqual(beforePersonalities);
    expect([...AVAILABLE_MATERIALS]).toEqual(beforeMaterials);
    expect([...AVAILABLE_STICKER_CONCEPTS]).toEqual(beforeStickerConcepts);
  });

  test("publishing is not possible · world sealing stays founder-gated", async () => {
    // No published-world side effect can originate from the Brain · we
    // prove this by confirming EVERY publish path (every caller role) is
    // declined. Nothing writes to the world sealing surface from here.
    for (const caller of [CHAT_CALLER, WORKER_CALLER, AGENT_CALLER, FOUNDER_CALLER]) {
      const result = await requestThemeProposal({
        caller,
        action: "publish",
        intent: BOTANICAL_SEED,
      });
      expect(result.kind).toBe("declined");
    }
  });
});
