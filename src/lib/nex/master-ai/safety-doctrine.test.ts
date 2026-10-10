// src/lib/nex/master-ai/safety-doctrine.test.ts
//
// Founder-authorised 2026-09-16 · NEX Safety Doctrine · unit + invariant tests
//
// The doctrine's runtime enforcement points:
//   1. Response vocabulary validation (evidence required for I_KNOW / I_INFER /
//      I_DID_IT; permission_scope required for I_NEED_PERMISSION; etc.)
//   2. Protected-layer path identification (which files count as protected)
//   3. Hostile-AI zone invariant (no AI model files or ML/LLM framework
//      imports inside src/lib/nex-agent/**)
//
// Any regression in these tests is a doctrine violation and should block
// release. This file is itself a PROTECTED LAYER — see safety-doctrine.ts.

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  BANNED_AI_FRAMEWORK_PACKAGES,
  BANNED_AI_MODEL_EXTENSIONS,
  NEX1_PROTECTED_LAYER_PATHS,
  isPathInProtectedLayer,
  pathProtectedLayers,
  validateSafetyResponse,
  type Nex1SafetyResponse,
} from "./safety-doctrine";

// ── §1 · Response vocabulary validation ──────────────────────────────────────

describe("Safety Doctrine · I_KNOW / I_INFER require evidence", () => {
  it("I_KNOW without evidence_refs is REJECTED", () => {
    const r: Nex1SafetyResponse = {
      kind: "I_KNOW",
      statement: "The classifier version is alpha.9.",
      taught_by: "master_ai_engineer",
    };
    expect(validateSafetyResponse(r)).toMatch(/I_KNOW requires.*evidence_refs/);
  });

  it("I_KNOW with evidence_refs is accepted", () => {
    const r: Nex1SafetyResponse = {
      kind: "I_KNOW",
      statement: "The classifier version is alpha.9.",
      evidence_refs: ["src/lib/nex-agent/code-engine/capability-a-founder-intent/vocabulary.ts"],
      taught_by: "master_ai_engineer",
    };
    expect(validateSafetyResponse(r)).toBeNull();
  });

  it("I_INFER without evidence_refs is REJECTED", () => {
    const r: Nex1SafetyResponse = {
      kind: "I_INFER",
      statement: "Detector will likely handle chain propagation in alpha.5.",
      taught_by: "master_ai_engineer",
    };
    expect(validateSafetyResponse(r)).toMatch(/I_INFER requires.*evidence_refs/);
  });
});

describe("Safety Doctrine · I_PROPOSE requires proposal_action", () => {
  it("I_PROPOSE without proposal_action is REJECTED", () => {
    const r: Nex1SafetyResponse = {
      kind: "I_PROPOSE",
      statement: "Consider a chain propagation rule.",
      taught_by: "master_ai_engineer",
    };
    expect(validateSafetyResponse(r)).toMatch(/I_PROPOSE requires.*proposal_action/);
  });

  it("I_PROPOSE with proposal_action is accepted", () => {
    const r: Nex1SafetyResponse = {
      kind: "I_PROPOSE",
      statement: "Add chain propagation.",
      proposal_action: "Extend Pass 3 to propagate path context through connectors",
      taught_by: "master_ai_engineer",
    };
    expect(validateSafetyResponse(r)).toBeNull();
  });
});

describe("Safety Doctrine · I_NEED_PERMISSION requires permission_scope", () => {
  it("I_NEED_PERMISSION without scope is REJECTED", () => {
    const r: Nex1SafetyResponse = {
      kind: "I_NEED_PERMISSION",
      statement: "I need to modify these files.",
      taught_by: "master_ai_engineer",
    };
    expect(validateSafetyResponse(r)).toMatch(/permission_scope/);
  });

  it("I_NEED_PERMISSION with named scope is accepted", () => {
    const r: Nex1SafetyResponse = {
      kind: "I_NEED_PERMISSION",
      statement: "I need to modify safety-doctrine.ts.",
      permission_scope: "modify:SAFETY_DOCTRINE",
      taught_by: "master_ai_engineer",
    };
    expect(validateSafetyResponse(r)).toBeNull();
  });
});

describe("Safety Doctrine · I_CANNOT requires boundary_reason", () => {
  it("I_CANNOT without boundary_reason is REJECTED", () => {
    const r: Nex1SafetyResponse = {
      kind: "I_CANNOT",
      statement: "I refuse.",
      taught_by: "master_ai_engineer",
    };
    expect(validateSafetyResponse(r)).toMatch(/boundary_reason/);
  });

  it("I_CANNOT with boundary_reason is accepted", () => {
    const r: Nex1SafetyResponse = {
      kind: "I_CANNOT",
      statement: "I cannot call an LLM.",
      boundary_reason: "NEX1 No-LLM Hard Rule prohibits generative delegation",
      taught_by: "master_ai_engineer",
    };
    expect(validateSafetyResponse(r)).toBeNull();
  });
});

describe("Safety Doctrine · I_DID_IT requires execution_receipt + evidence", () => {
  it("I_DID_IT without execution_receipt is REJECTED (fabrication guard)", () => {
    const r: Nex1SafetyResponse = {
      kind: "I_DID_IT",
      statement: "I finished the refactor.",
      evidence_refs: ["src/lib/x.ts"],
      taught_by: "master_ai_engineer",
    };
    expect(validateSafetyResponse(r)).toMatch(/execution_receipt/);
  });

  it("I_DID_IT without evidence_refs is REJECTED (post-action verification guard)", () => {
    const r: Nex1SafetyResponse = {
      kind: "I_DID_IT",
      statement: "I finished the refactor.",
      execution_receipt: "receipts/refactor-2026-09-16.json",
      taught_by: "master_ai_engineer",
    };
    expect(validateSafetyResponse(r)).toMatch(/evidence_refs/);
  });

  it("I_DID_IT with both receipt AND evidence is accepted", () => {
    const r: Nex1SafetyResponse = {
      kind: "I_DID_IT",
      statement: "Terminal-position rule shipped.",
      execution_receipt: "receipts/alpha.9-shipped.json",
      evidence_refs: ["src/lib/nex-agent/code-engine/capability-a-founder-intent/classifier.ts"],
      taught_by: "master_ai_engineer",
    };
    expect(validateSafetyResponse(r)).toBeNull();
  });
});

describe("Safety Doctrine · I_DONT_KNOW is the honest UNKNOWN state", () => {
  it("I_DONT_KNOW with only statement is accepted (no evidence required)", () => {
    const r: Nex1SafetyResponse = {
      kind: "I_DONT_KNOW",
      statement: "Insufficient evidence to determine impact scope.",
      taught_by: "master_ai_engineer",
    };
    expect(validateSafetyResponse(r)).toBeNull();
  });
});

describe("Safety Doctrine · statement is always required", () => {
  it("empty statement is REJECTED across all kinds", () => {
    const r: Nex1SafetyResponse = {
      kind: "I_DONT_KNOW",
      statement: "",
      taught_by: "master_ai_engineer",
    };
    expect(validateSafetyResponse(r)).toMatch(/statement is required/);
  });
});

// ── §2 · Protected-layer identification ─────────────────────────────────────

describe("Safety Doctrine · protected-layer path identification", () => {
  it("safety-doctrine.ts itself is a protected layer (SAFETY_DOCTRINE)", () => {
    expect(isPathInProtectedLayer("src/lib/nex/master-ai/safety-doctrine.ts")).toBe(true);
    expect(pathProtectedLayers("src/lib/nex/master-ai/safety-doctrine.ts")).toContain("SAFETY_DOCTRINE");
  });

  it("intelligence-status.ts is a protected layer", () => {
    expect(isPathInProtectedLayer("src/lib/nex/master-ai/intelligence-status.ts")).toBe(true);
  });

  it("NEX1 code engine is INTELLIGENCE_CORE", () => {
    expect(pathProtectedLayers("src/lib/nex-agent/code-engine/capability-a-founder-intent/classifier.ts")).toContain("INTELLIGENCE_CORE");
  });

  it("Master AI + agent-runtime are INTELLIGENCE_CORE", () => {
    expect(pathProtectedLayers("src/lib/nex/master-ai/agent-registry.ts")).toContain("INTELLIGENCE_CORE");
    expect(pathProtectedLayers("src/lib/nex/agent-runtime/registry.ts")).toContain("INTELLIGENCE_CORE");
  });

  it("Agent-runtime is also AUTHORITY_MODEL", () => {
    expect(pathProtectedLayers("src/lib/nex/agent-runtime/control-plane.ts")).toContain("AUTHORITY_MODEL");
  });

  it("Ordinary UI code is NOT a protected layer (founder rule · don't overbroad)", () => {
    expect(isPathInProtectedLayer("src/app/page.tsx")).toBe(false);
    expect(isPathInProtectedLayer("src/components/Button.tsx")).toBe(false);
    expect(isPathInProtectedLayer("src/lib/utils/formatDate.ts")).toBe(false);
  });

  it("Windows-style backslash paths are handled", () => {
    expect(isPathInProtectedLayer("src\\lib\\nex-agent\\code-engine\\foo.ts")).toBe(true);
  });

  it("Every protected-layer path is registered exactly once (no accidental duplication)", () => {
    const allPaths: string[] = [];
    for (const paths of Object.values(NEX1_PROTECTED_LAYER_PATHS)) {
      for (const p of paths) allPaths.push(p);
    }
    // Some layer paths intentionally overlap (nex-agent is INTELLIGENCE_CORE, agent-runtime is
    // INTELLIGENCE_CORE + AUTHORITY_MODEL). That's by design — a file may belong to more than
    // one layer. What we forbid is a single string being registered twice within ONE layer.
    for (const paths of Object.values(NEX1_PROTECTED_LAYER_PATHS)) {
      const unique = new Set(paths);
      expect(unique.size).toBe(paths.length);
    }
  });
});

// ── §3 · Hostile-AI Zone invariant ───────────────────────────────────────────

describe("Safety Doctrine · Hostile-AI Zone · no AI model files or ML/LLM framework imports in NEX1", () => {
  it("banned-extension list is non-empty and covers common formats", () => {
    expect(BANNED_AI_MODEL_EXTENSIONS.length).toBeGreaterThan(10);
    expect(BANNED_AI_MODEL_EXTENSIONS).toContain(".safetensors");
    expect(BANNED_AI_MODEL_EXTENSIONS).toContain(".gguf");
    expect(BANNED_AI_MODEL_EXTENSIONS).toContain(".onnx");
    expect(BANNED_AI_MODEL_EXTENSIONS).toContain(".pt");
  });

  it("banned-framework list covers LLM SDKs + ML runtimes + LLM frameworks", () => {
    expect(BANNED_AI_FRAMEWORK_PACKAGES).toContain("@anthropic-ai/sdk");
    expect(BANNED_AI_FRAMEWORK_PACKAGES).toContain("openai");
    expect(BANNED_AI_FRAMEWORK_PACKAGES).toContain("langchain");
    expect(BANNED_AI_FRAMEWORK_PACKAGES).toContain("onnxruntime");
    expect(BANNED_AI_FRAMEWORK_PACKAGES).toContain("@tensorflow/tfjs");
    expect(BANNED_AI_FRAMEWORK_PACKAGES).toContain("transformers");
  });

  it("STATIC INVARIANT · src/lib/nex-agent/** contains no banned AI model files", () => {
    const nexAgentDir = path.join(process.cwd(), "src", "lib", "nex-agent");
    if (!fs.existsSync(nexAgentDir)) {
      throw new Error(`nex-agent dir missing at ${nexAgentDir}`);
    }
    const violations: string[] = [];
    function walk(dir: string): void {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === "node_modules" || entry.name === ".next") continue;
          walk(full);
          continue;
        }
        const lower = entry.name.toLowerCase();
        for (const ext of BANNED_AI_MODEL_EXTENSIONS) {
          if (lower.endsWith(ext)) {
            violations.push(`${full}: banned model file extension '${ext}'`);
            break;
          }
        }
      }
    }
    walk(nexAgentDir);
    if (violations.length > 0) {
      throw new Error(
        `HOSTILE-AI ZONE VIOLATION · AI model file(s) inside src/lib/nex-agent/:\n${violations.join("\n")}`,
      );
    }
    expect(violations).toEqual([]);
  });

  it("STATIC INVARIANT · src/lib/nex-agent/** imports no banned AI/ML/LLM frameworks", () => {
    const nexAgentDir = path.join(process.cwd(), "src", "lib", "nex-agent");
    const violations: string[] = [];
    function walk(dir: string): void {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === "node_modules" || entry.name === ".next") continue;
          walk(full);
          continue;
        }
        if (!/\.(ts|tsx|js|mjs)$/.test(entry.name)) continue;
        const content = fs.readFileSync(full, "utf8");
        for (const pkg of BANNED_AI_FRAMEWORK_PACKAGES) {
          const patterns = [
            `from '${pkg}'`,
            `from "${pkg}"`,
            `require('${pkg}')`,
            `require("${pkg}")`,
            `import('${pkg}')`,
            `import("${pkg}")`,
          ];
          if (patterns.some((p) => content.includes(p))) {
            violations.push(`${full}: banned import '${pkg}'`);
          }
        }
      }
    }
    walk(nexAgentDir);
    if (violations.length > 0) {
      throw new Error(
        `HOSTILE-AI ZONE VIOLATION · banned AI/ML/LLM framework import in src/lib/nex-agent/:\n${violations.join("\n")}`,
      );
    }
    expect(violations).toEqual([]);
  });
});
