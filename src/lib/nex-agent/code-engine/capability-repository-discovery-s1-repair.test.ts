// NEX1 · S1 Repair · focused tests for reachability + declaration-aware
// ranking · calls the modified production function directly.
// Founder-authorised repair scope: only the two areas approved.

import { describe, it, expect } from "vitest";
import { discoverRepositoryCandidates } from "./capability-repository-discovery";

const REPO_ROOT = process.cwd();

interface Case {
  id: string;
  target_token: string;
  target_symbol: string;
  expected_file: string;
  form: string;
}

// ── Q1-Q4 · the original known-answer cases ──────────────────────────
const ORIGINAL_CASES: readonly Case[] = [
  { id: "Q1", target_token: "assessfear", target_symbol: "assessFear",
    expected_file: "src/lib/nex-agent/code-engine/capability-fear.ts", form: "exported function" },
  { id: "Q2", target_token: "runnativeinvestigation", target_symbol: "runNativeInvestigation",
    expected_file: "src/lib/nex-agent/code-engine/native-investigation-mode.ts", form: "exported async function" },
  { id: "Q3", target_token: "investigationconclusionentry", target_symbol: "InvestigationConclusionEntry",
    expected_file: "src/lib/nex-agent/code-engine/investigation-conclusion-store.ts", form: "exported interface" },
  { id: "Q4", target_token: "patternidof", target_symbol: "patternIdOf",
    expected_file: "src/lib/nex-agent/code-engine/capability-experience-abstraction.ts", form: "exported function" },
];

// ── Declaration-form coverage (real symbols · one per form) ─────────
const FORM_CASES: readonly Case[] = [
  { id: "F1-fn",    target_token: "runnativeinvestigation", target_symbol: "runNativeInvestigation",
    expected_file: "src/lib/nex-agent/code-engine/native-investigation-mode.ts", form: "exported async function" },
  { id: "F2-if",    target_token: "investigationconclusionentry", target_symbol: "InvestigationConclusionEntry",
    expected_file: "src/lib/nex-agent/code-engine/investigation-conclusion-store.ts", form: "exported interface" },
  { id: "F3-type",  target_token: "changeverb", target_symbol: "ChangeVerb",
    expected_file: "src/lib/nex-agent/code-engine/capability-change-hypothesis-engine.ts", form: "exported type" },
  { id: "F4-const", target_token: "english_quantifiers", target_symbol: "ENGLISH_QUANTIFIERS",
    expected_file: "src/lib/nex-agent/code-engine/capability-a-founder-intent/context-evidence-gate.ts", form: "exported const" },
  { id: "F5-class", target_token: "nex1reasoningregistry", target_symbol: "Nex1ReasoningRegistry",
    expected_file: "src/lib/nex-agent/code-engine/registry.ts", form: "exported class" },
  { id: "F6-priv",  target_token: "evaluatefunctioncall", target_symbol: "evaluateFunctionCall",
    expected_file: "src/lib/nex-agent/code-engine/capability-data-flow-tracer.ts", form: "private function" },
  { id: "F7-meth",  target_token: "interprettask", target_symbol: "interpretTask",
    expected_file: "src/lib/nex-agent/code-engine/nex1-decision-trail.ts", form: "class method" },
];

// ── Ambiguity cases (multi-declaration · policy check) ──────────────
interface AmbiguityCase {
  id: string;
  token: string;
  symbol: string;
  all_declaration_files: readonly string[];
}
const AMBIGUITY_CASES: readonly AmbiguityCase[] = [
  {
    id: "A1", token: "toforwardslash", symbol: "toForwardSlash",
    all_declaration_files: [
      "src/lib/nex-agent/code-engine/capability-m-file-memory/seed-from-content.ts",
      "src/lib/nex-agent/code-engine/capability-specification-driven-loop.ts",
      "src/lib/nex-agent/code-engine/capability-verification-case-generator.ts",
    ],
  },
  {
    id: "A2", token: "recordevidence", symbol: "recordEvidence",
    all_declaration_files: [
      "src/lib/nex-agent/adversarial-corpus.ts",                     // exported function
      "src/lib/nex-agent/code-engine/nex1-decision-trail.ts",        // class method
    ],
  },
];

// ── Negative cases · content that is NOT a declaration ──────────────
interface NegativeCase {
  id: string;
  token: string;
  reason: string;
  should_not_be_top1: string;
}
const NEGATIVE_CASES: readonly NegativeCase[] = [
  {
    id: "N1", token: "assessfear",
    reason: "test file has many occurrences but is NOT the declaration",
    should_not_be_top1: "src/lib/nex-agent/code-engine/capability-fear-concern-afraid.test.ts",
  },
  {
    id: "N2", token: "runnativeinvestigation",
    reason: "chat-turn IMPORTS runNativeInvestigation but is not the declaration",
    should_not_be_top1: "src/lib/nex-agent/code-engine/capability-chat-turn.ts",
  },
];

describe("S1 Repair · reachability", () => {
  it("PRIORITY · targets under src/lib/nex-agent are reached when priority_prefixes set + walker sees a code-engine question", () => {
    for (const c of ORIGINAL_CASES) {
      const r = discoverRepositoryCandidates({
        concepts: [c.target_token],
        repo_root: REPO_ROOT,
        priority_prefixes: ["src/lib/nex-agent"],
        definition_intent: true,
        max_files_scanned: 500,
        max_candidates: 50,
      });
      const posix = r.candidates.map((x) => x.repo_relative_path.replace(/\\/g, "/"));
      const reached = posix.includes(c.expected_file);
      console.log(`[REACH-${c.id}] ${c.target_symbol} reached=${reached ? "✓" : "✗"} · candidates=${r.candidates.length}`);
      expect(reached, `${c.id} target must be in candidate set`).toBe(true);
    }
  });

  it("BACKWARD-COMPAT · omitting priority_prefixes preserves previous behaviour", () => {
    // Same call as the pre-repair pipeline · target should still NOT be
    // in the candidate set at default cap because BFS falls into src/apps first.
    const r = discoverRepositoryCandidates({
      concepts: ["assessfear"],
      repo_root: REPO_ROOT,
      max_files_scanned: 500,
      max_candidates: 20,
    });
    const posix = r.candidates.map((x) => x.repo_relative_path.replace(/\\/g, "/"));
    // We do NOT assert failure — we assert the DIAGNOSTIC state matches
    // the pre-repair reachability finding. This confirms that changing
    // priority_prefixes is the SOLE behavioural difference.
    console.log(`[BACK-COMPAT] target-reached-at-default=${posix.includes("src/lib/nex-agent/code-engine/capability-fear.ts")}`);
    // At default cap and without priority_prefixes, walker still cannot
    // reach src/lib/nex-agent/**/*.ts.
    expect(posix.includes("src/lib/nex-agent/code-engine/capability-fear.ts")).toBe(false);
  });
});

describe("S1 Repair · declaration-aware ranking · Q1-Q4", () => {
  for (const c of ORIGINAL_CASES) {
    it(`${c.id} · ${c.target_symbol} (${c.form}) is top-1`, () => {
      const r = discoverRepositoryCandidates({
        concepts: [c.target_token],
        repo_root: REPO_ROOT,
        priority_prefixes: ["src/lib/nex-agent"],
        definition_intent: true,
        max_files_scanned: 500,
        max_candidates: 20,
      });
      const posix = r.candidates.map((x) => x.repo_relative_path.replace(/\\/g, "/"));
      const targetRank = posix.indexOf(c.expected_file);
      const top1 = r.candidates[0]?.repo_relative_path.replace(/\\/g, "/") ?? null;
      const targetCand = r.candidates.find((x) => x.repo_relative_path.replace(/\\/g, "/") === c.expected_file);
      const declSignalDetected = !!targetCand && targetCand.is_declaration_site;
      console.log(
        `[RANK-${c.id}] top1=${top1} · target_rank=${targetRank} · declaration_signal=${declSignalDetected}`,
      );
      expect(top1).toBe(c.expected_file);
      expect(declSignalDetected).toBe(true);
    });
  }
});

describe("S1 Repair · declaration-form coverage", () => {
  for (const c of FORM_CASES) {
    it(`${c.id} · ${c.target_symbol} (${c.form}) is top-1`, () => {
      const r = discoverRepositoryCandidates({
        concepts: [c.target_token],
        repo_root: REPO_ROOT,
        priority_prefixes: ["src/lib/nex-agent"],
        definition_intent: true,
        max_files_scanned: 500,
        max_candidates: 20,
      });
      const top1 = r.candidates[0]?.repo_relative_path.replace(/\\/g, "/") ?? null;
      console.log(`[FORM-${c.id}] ${c.form} · target=${c.target_symbol} · top1=${top1}`);
      expect(top1).toBe(c.expected_file);
    });
  }
});

describe("S1 Repair · ambiguity policy · preserves multi-declaration honesty", () => {
  it("A1 · toForwardSlash · all 3 legitimate declarations are marked as declaration sites (no false uniqueness)", () => {
    const r = discoverRepositoryCandidates({
      concepts: ["toforwardslash"],
      repo_root: REPO_ROOT,
      priority_prefixes: ["src/lib/nex-agent"],
      definition_intent: true,
      max_files_scanned: 500,
      max_candidates: 50,
    });
    const declSites = r.candidates
      .filter((c) => c.is_declaration_site)
      .map((c) => c.repo_relative_path.replace(/\\/g, "/"));
    console.log(`[AMB-A1] declaration_sites (${declSites.length}):`);
    for (const p of declSites) console.log(`         · ${p}`);
    for (const expected of AMBIGUITY_CASES[0].all_declaration_files) {
      expect(declSites, `${expected} must be flagged is_declaration_site`).toContain(expected);
    }
    expect(declSites.length).toBeGreaterThanOrEqual(3);
  });

  it("A2 · recordEvidence · both the exported function AND the class method are flagged as declarations", () => {
    const r = discoverRepositoryCandidates({
      concepts: ["recordevidence"],
      repo_root: REPO_ROOT,
      priority_prefixes: ["src/lib/nex-agent"],
      definition_intent: true,
      max_files_scanned: 500,
      max_candidates: 50,
    });
    const declSites = r.candidates
      .filter((c) => c.is_declaration_site)
      .map((c) => c.repo_relative_path.replace(/\\/g, "/"));
    const funcSite = r.candidates.find(
      (c) => c.repo_relative_path.replace(/\\/g, "/") === "src/lib/nex-agent/adversarial-corpus.ts",
    );
    const methodSite = r.candidates.find(
      (c) => c.repo_relative_path.replace(/\\/g, "/") === "src/lib/nex-agent/code-engine/nex1-decision-trail.ts",
    );
    console.log(`[AMB-A2] declaration_sites: ${declSites.join(" ; ")}`);
    console.log(`[AMB-A2] function-site declaration_matches=${funcSite?.declaration_matches ?? "n/a"}`);
    console.log(`[AMB-A2] method-site method_declaration_matches=${methodSite?.method_declaration_matches ?? "n/a"}`);
    expect(funcSite?.declaration_matches).toBe(1);
    expect(funcSite?.method_declaration_matches).toBe(0);
    expect(methodSite?.declaration_matches).toBe(0);
    expect(methodSite?.method_declaration_matches).toBe(1);
    // Both flagged as declaration sites · ranking may pick one but metadata
    // exposes the ambiguity honestly for downstream observers.
    expect(funcSite?.is_declaration_site).toBe(true);
    expect(methodSite?.is_declaration_site).toBe(true);
  });
});

describe("S1 Repair · negative cases · usage/importer/test files do not become top-1", () => {
  for (const nc of NEGATIVE_CASES) {
    it(`${nc.id} · ${nc.token} · ${nc.reason}`, () => {
      const r = discoverRepositoryCandidates({
        concepts: [nc.token],
        repo_root: REPO_ROOT,
        priority_prefixes: ["src/lib/nex-agent"],
        definition_intent: true,
        max_files_scanned: 500,
        max_candidates: 20,
      });
      const top1 = r.candidates[0]?.repo_relative_path.replace(/\\/g, "/") ?? null;
      console.log(`[NEG-${nc.id}] top1=${top1} · should_not_be=${nc.should_not_be_top1}`);
      expect(top1).not.toBe(nc.should_not_be_top1);
    });
  }
});

describe("S1 Repair · determinism", () => {
  it("byte-identical results across two consecutive invocations", () => {
    const inputs = ORIGINAL_CASES.map((c) => ({
      concepts: [c.target_token],
      repo_root: REPO_ROOT,
      priority_prefixes: ["src/lib/nex-agent"] as const,
      definition_intent: true,
      max_files_scanned: 500,
      max_candidates: 20,
    }));
    const first = inputs.map((i) => discoverRepositoryCandidates(i));
    const second = inputs.map((i) => discoverRepositoryCandidates(i));
    for (let i = 0; i < inputs.length; i++) {
      const a = JSON.stringify(first[i].candidates.map((c) => ({ p: c.repo_relative_path, s: c.match_score })));
      const b = JSON.stringify(second[i].candidates.map((c) => ({ p: c.repo_relative_path, s: c.match_score })));
      expect(a).toBe(b);
    }
    console.log(`[DETERMINISM] 4/4 byte-identical across two passes`);
  });
});

describe("S1 Repair · non-definition-intent preserves previous scoring", () => {
  it("when definition_intent is false · declaration boost does not apply", () => {
    const r = discoverRepositoryCandidates({
      concepts: ["assessfear"],
      repo_root: REPO_ROOT,
      priority_prefixes: ["src/lib/nex-agent"],
      definition_intent: false,        // <-- key: no declaration boost
      max_files_scanned: 500,
      max_candidates: 20,
    });
    const targetCand = r.candidates.find(
      (c) => c.repo_relative_path.replace(/\\/g, "/") === "src/lib/nex-agent/code-engine/capability-fear.ts",
    );
    // Target is still IDENTIFIED as declaration site (metadata computed
    // unconditionally · additive) but SCORE does not include the boost.
    expect(targetCand?.is_declaration_site).toBe(true);
    // Score under definition_intent=false must equal the previous formula
    // `2 * filename_matches + content_matches`.
    if (targetCand) {
      const expectedScore = 2 * targetCand.filename_matches + targetCand.content_matches;
      expect(targetCand.match_score).toBe(expectedScore);
    }
    console.log(`[NON-DEF-INTENT] declaration boost NOT applied · score preserved`);
  });
});
