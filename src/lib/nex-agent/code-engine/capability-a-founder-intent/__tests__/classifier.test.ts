// NEX1 · CAPABILITY A · Classifier · positive + negative + adversarial tests.
// Deterministic · same-input → same-output.

import { describe, it, expect } from "vitest";
import { classifyFounderIntent } from "../classifier";
import { VOCABULARY_VERSION } from "../vocabulary";
import type { Nex1IntentClassified, Nex1IntentRefused } from "../types";

function classified(result: ReturnType<typeof classifyFounderIntent>): Nex1IntentClassified {
  if (result.kind !== "classified") {
    throw new Error(`expected classified, got ${result.kind} · ${JSON.stringify(result)}`);
  }
  return result;
}

function refused(result: ReturnType<typeof classifyFounderIntent>): Nex1IntentRefused {
  if (result.kind !== "refused") {
    throw new Error(`expected refused, got ${result.kind} · ${JSON.stringify(result)}`);
  }
  return result;
}

describe("capability-a · refusal cases", () => {
  it("empty string is refused_empty_goal", () => {
    const r = refused(classifyFounderIntent(""));
    expect(r.refusal).toBe("refused_empty_goal");
  });

  it("whitespace-only string is refused_empty_goal", () => {
    const r = refused(classifyFounderIntent("   \n\t  "));
    expect(r.refusal).toBe("refused_empty_goal");
  });

  it("too-short goal is refused_goal_too_short", () => {
    const r = refused(classifyFounderIntent("fix it"));
    expect(r.refusal).toBe("refused_goal_too_short");
  });

  it("too-long goal is refused_goal_too_long", () => {
    const long = "build the ".repeat(2000); // >>8000 chars
    const r = refused(classifyFounderIntent(long));
    expect(r.refusal).toBe("refused_goal_too_long");
  });

  it("goal with no recognised verb is refused_no_verb_recognised", () => {
    const r = refused(classifyFounderIntent("a description without any recognised action term"));
    expect(r.refusal).toBe("refused_no_verb_recognised");
  });

  it("non-string input is refused_empty_goal", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = refused(classifyFounderIntent(undefined as unknown as string));
    expect(r.refusal).toBe("refused_empty_goal");
  });

  it("refusals carry vocabulary_version and taught_by", () => {
    const r = refused(classifyFounderIntent(""));
    expect(r.vocabulary_version).toBe(VOCABULARY_VERSION);
    expect(r.taught_by).toBe("master_ai_engineer");
    expect(Array.isArray(r.reasoning_trace)).toBe(true);
  });
});

describe("capability-a · verb-family classification", () => {
  it("classifies plain BUILD goal", () => {
    const r = classified(classifyFounderIntent("build a small notes application"));
    expect(r.verb_family).toBe("BUILD");
    expect(r.deliverable_kind).toBe("application");
    expect(r.verb_family_confidence).toBe(1.0);
  });

  it("classifies BUILD variants: create/make/add/generate/scaffold", () => {
    for (const v of ["create", "make", "add", "generate", "scaffold", "implement", "author"]) {
      const r = classified(classifyFounderIntent(`${v} a helper function please`));
      expect(r.verb_family).toBe("BUILD");
    }
  });

  it("classifies FIX goal", () => {
    const r = classified(classifyFounderIntent("fix the failing plugin dispatch tests"));
    expect(r.verb_family).toBe("FIX");
    expect(r.deliverable_kind).toBe("test_suite");
  });

  it("classifies FIX variants: repair/resolve/correct/patch/debug", () => {
    for (const v of ["repair", "resolve", "correct", "patch", "debug", "recover"]) {
      const r = classified(classifyFounderIntent(`${v} the broken utility function`));
      expect(r.verb_family).toBe("FIX");
    }
  });

  it("classifies REFACTOR goal", () => {
    const r = classified(classifyFounderIntent("refactor the authentication module"));
    expect(r.verb_family).toBe("REFACTOR");
    expect(r.deliverable_kind).toBe("module");
  });

  it("classifies TEST goal", () => {
    const r = classified(classifyFounderIntent("test the entire authentication flow thoroughly"));
    expect(r.verb_family).toBe("TEST");
  });

  it("classifies INVESTIGATE goal", () => {
    const r = classified(classifyFounderIntent("investigate the performance regression in checkout"));
    expect(r.verb_family).toBe("INVESTIGATE");
  });

  it("classifies VERIFY goal", () => {
    const r = classified(classifyFounderIntent("verify the final result of the migration"));
    expect(r.verb_family).toBe("VERIFY");
  });

  it("classifies MODIFY goal", () => {
    const r = classified(classifyFounderIntent("change the login flow to require MFA"));
    expect(r.verb_family).toBe("MODIFY");
  });

  it("classifies REMOVE goal", () => {
    const r = classified(classifyFounderIntent("delete the legacy admin endpoints entirely"));
    expect(r.verb_family).toBe("REMOVE");
    expect(r.deliverable_kind).toBe("endpoint");
  });

  it("case-insensitive: BUILD and build behave the same", () => {
    const a = classified(classifyFounderIntent("BUILD a NOTES application"));
    const b = classified(classifyFounderIntent("build a notes application"));
    expect(a.verb_family).toBe(b.verb_family);
    expect(a.deliverable_kind).toBe(b.deliverable_kind);
    expect(a.domain_tokens.map((d) => d.token)).toEqual(b.domain_tokens.map((d) => d.token));
  });

  it("winner is the most-frequent verb family", () => {
    const r = classified(classifyFounderIntent("build a notes app and create a page and add a component"));
    expect(r.verb_family).toBe("BUILD");
    expect(r.verb_family_confidence).toBe(1.0);
    expect(r.verb_hits.length).toBe(3);
  });

  it("multiple families with a clear top produce confidence < 1", () => {
    const r = classified(classifyFounderIntent("build the module and fix the failing tests inside it"));
    expect(r.verb_hits.length).toBeGreaterThanOrEqual(2);
    expect(r.verb_family_confidence).toBeLessThan(1);
    expect(r.verb_family_confidence).toBeGreaterThan(0);
  });

  it("ties break to earliest first-appearance and flag ambiguity", () => {
    const r = classified(classifyFounderIntent("fix the module and then build the api endpoint"));
    expect(r.verb_family).toBe("FIX"); // FIX appears first
    expect(r.ambiguities.some((a) => a.kind === "multiple_verb_families_close")).toBe(true);
  });
});

describe("capability-a · deliverable classification", () => {
  it("prefers longer phrases over shorter ones", () => {
    const r = classified(classifyFounderIntent("build a web application right now please"));
    expect(r.deliverable_kind).toBe("application");
  });

  it("matches nextjs page over generic 'page'", () => {
    const r = classified(classifyFounderIntent("scaffold a nextjs page for the profile route"));
    expect(r.deliverable_kind).toBe("route");
  });

  it("matches type_definition for 'interface'", () => {
    const r = classified(classifyFounderIntent("author a typescript interface for the payload"));
    expect(r.deliverable_kind).toBe("type_definition");
  });

  it("emits deliverable_kind='unclear' when nothing matches", () => {
    const r = classified(classifyFounderIntent("investigate what is happening in production"));
    expect(r.deliverable_kind).toBe("unclear");
    expect(r.deliverable_confidence).toBe(0);
    expect(r.ambiguities.some((a) => a.kind === "low_deliverable_confidence")).toBe(true);
  });

  it("boundary check prevents substring false-positive", () => {
    // "reappearance" contains "app" but should NOT match application.
    const r = classified(classifyFounderIntent("investigate the recent reappearance of the bug"));
    expect(r.deliverable_kind).toBe("unclear");
  });
});

describe("capability-a · domain token extraction", () => {
  it("extracts unique domain tokens", () => {
    const r = classified(classifyFounderIntent("build a notes application with tagging and sharing"));
    const tokens = r.domain_tokens.map((d) => d.token);
    expect(tokens).toContain("notes");
    expect(tokens).toContain("tagging");
    expect(tokens).toContain("sharing");
  });

  it("orders domain tokens by occurrence count (desc)", () => {
    const r = classified(
      classifyFounderIntent("build a notes feature · notes must sync · notes must export"),
    );
    expect(r.domain_tokens[0]!.token).toBe("notes");
    expect(r.domain_tokens[0]!.occurrences).toBeGreaterThanOrEqual(3);
  });

  it("excludes stop-words and verb lexemes and deliverable words", () => {
    const r = classified(classifyFounderIntent("build a small notes application quickly"));
    const tokens = r.domain_tokens.map((d) => d.token);
    expect(tokens).not.toContain("build");
    expect(tokens).not.toContain("small"); // stop-word
    expect(tokens).not.toContain("application"); // deliverable-phrase word
    expect(tokens).not.toContain("a"); // stop-word
  });

  it("excludes tokens shorter than three characters", () => {
    const r = classified(classifyFounderIntent("build ab cd efg hij application interface"));
    const tokens = r.domain_tokens.map((d) => d.token);
    expect(tokens).not.toContain("ab");
    expect(tokens).not.toContain("cd");
    // "efg" and "hij" survive length filter (3+ chars) — that's expected.
  });

  it("excludes purely-numeric tokens", () => {
    const r = classified(classifyFounderIntent("build a 2024 notes feature with 123 tags"));
    const tokens = r.domain_tokens.map((d) => d.token);
    expect(tokens).not.toContain("2024");
    expect(tokens).not.toContain("123");
  });

  it("caps at NEX1_INTENT_MAX_DOMAIN_TOKENS", () => {
    const r = classified(
      classifyFounderIntent(
        "build feature alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu component",
      ),
    );
    expect(r.domain_tokens.length).toBeLessThanOrEqual(8);
  });

  it("flags no_domain_extracted when nothing survives filtering", () => {
    const r = classified(classifyFounderIntent("build a small app for us"));
    expect(r.ambiguities.some((a) => a.kind === "no_domain_extracted")).toBe(true);
  });
});

describe("capability-a · file reference extraction", () => {
  it("extracts a simple .ts path", () => {
    const r = classified(classifyFounderIntent("fix the bug in src/lib/foo.ts urgently"));
    expect(r.file_references.length).toBe(1);
    expect(r.file_references[0]!.path).toBe("src/lib/foo.ts");
    expect(r.file_references[0]!.line).toBeNull();
  });

  it("extracts path with line number", () => {
    const r = classified(classifyFounderIntent("fix the bug at src/lib/foo.ts:42 please"));
    expect(r.file_references[0]!.path).toBe("src/lib/foo.ts");
    expect(r.file_references[0]!.line).toBe(42);
  });

  it("extracts multiple file references", () => {
    const r = classified(
      classifyFounderIntent("fix src/lib/a.ts and src/lib/b.tsx and modify src/app/c.jsx"),
    );
    const paths = r.file_references.map((f) => f.path);
    expect(paths).toContain("src/lib/a.ts");
    expect(paths).toContain("src/lib/b.tsx");
    expect(paths).toContain("src/app/c.jsx");
  });
});

describe("capability-a · requirement phrase extraction", () => {
  it("finds a 'must be able to' phrase", () => {
    const r = classified(
      classifyFounderIntent("build an app · users must be able to create notes always"),
    );
    expect(r.requirement_phrases.some((p) => p.kind === "must_have")).toBe(true);
  });

  it("finds a 'must not' phrase", () => {
    const r = classified(
      classifyFounderIntent("build an app · the system must not store passwords"),
    );
    expect(r.requirement_phrases.some((p) => p.kind === "must_not_have")).toBe(true);
  });

  it("finds a 'verify that' phrase", () => {
    const r = classified(
      classifyFounderIntent("build an app and verify that the tests pass at the end"),
    );
    expect(r.requirement_phrases.some((p) => p.kind === "verification_intent")).toBe(true);
  });

  it("flags requirement_phrases_missing when none appear", () => {
    const r = classified(classifyFounderIntent("build a small notes application quickly"));
    expect(r.ambiguities.some((a) => a.kind === "requirement_phrases_missing")).toBe(true);
  });
});

describe("capability-a · reasoning trace + determinism", () => {
  it("reasoning trace is non-empty on classification", () => {
    const r = classified(classifyFounderIntent("build a small notes application"));
    expect(r.reasoning_trace.length).toBeGreaterThan(0);
  });

  it("same input yields byte-identical output on repeat call", () => {
    const goal = "build a small notes application · users must be able to search notes";
    const a = classifyFounderIntent(goal);
    const b = classifyFounderIntent(goal);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("carries vocabulary_version and taught_by attribution", () => {
    const r = classified(classifyFounderIntent("build a small notes application"));
    expect(r.vocabulary_version).toBe(VOCABULARY_VERSION);
    expect(r.taught_by).toBe("master_ai_engineer");
  });

  it("overall_confidence stays in [0,1]", () => {
    const goals = [
      "build a small notes application · users must be able to create notes",
      "fix the failing plugin dispatch tests in src/lib/foo.ts",
      "refactor the authentication module for clarity",
      "investigate the checkout regression",
    ];
    for (const g of goals) {
      const r = classified(classifyFounderIntent(g));
      expect(r.overall_confidence).toBeGreaterThanOrEqual(0);
      expect(r.overall_confidence).toBeLessThanOrEqual(1);
    }
  });
});

describe("capability-a · integration with real historic founder goals", () => {
  it("classifies the v1 self-direct goal (file-token present) as FIX + test_suite + file_ref", () => {
    const goal =
      "NEX1, fix the failing tests in src/lib/nex-agent-runtime/__tests__/_selfdirect-demo/plugin-dispatch.test.ts. Investigate the problem yourself, make whatever safe changes are necessary, run the tests, recover from failures if needed, and verify the final result.";
    const r = classified(classifyFounderIntent(goal));
    expect(r.verb_family).toBe("FIX");
    expect(r.file_references.length).toBeGreaterThanOrEqual(1);
    expect(r.file_references[0]!.path).toContain("plugin-dispatch.test.ts");
  });

  it("classifies the v2 self-direct goal (no file token) as FIX + no file_refs", () => {
    const goal =
      "Fix the failing plugin dispatch tests. Investigate the problem yourself. Make whatever safe changes are necessary. Run the appropriate tests, recover from failures if needed, and verify the final result.";
    const r = classified(classifyFounderIntent(goal));
    expect(r.verb_family).toBe("FIX");
    expect(r.file_references.length).toBe(0);
    expect(r.deliverable_kind).toBe("test_suite");
    // 'plugin' and 'dispatch' should appear as domain tokens.
    const tokens = r.domain_tokens.map((d) => d.token);
    expect(tokens).toContain("plugin");
    expect(tokens).toContain("dispatch");
  });

  it("classifies the notes-app goal as BUILD + application + notes domain", () => {
    const goal =
      "Build a small local notes application. Users must be able to create, list, search and delete notes. Decide how to implement it, create the necessary files, write tests, run the tests, fix failures and verify the finished application.";
    const r = classified(classifyFounderIntent(goal));
    expect(r.verb_family).toBe("BUILD");
    expect(r.deliverable_kind).toBe("application");
    const tokens = r.domain_tokens.map((d) => d.token);
    expect(tokens).toContain("notes");
    expect(r.requirement_phrases.length).toBeGreaterThan(0);
  });

  it("Test 20 verbatim goal: yields a classified result (not refused)", () => {
    const goal =
      "NEX1, build a small but complete working software feature inside the designated isolated test workspace. The feature must be useful, internally coherent, and testable. You decide what files are required, what code structure is required, what functions or components are required, what data structure is appropriate, what tests are required, how the feature should be implemented, how the implementation should be verified, and how to recover if your first implementation fails.";
    const r = classified(classifyFounderIntent(goal));
    // The primary verb is BUILD; other verbs appear but BUILD is the anchor.
    expect(["BUILD", "TEST", "FIX", "VERIFY"]).toContain(r.verb_family);
    expect(r.requirement_phrases.length).toBeGreaterThan(0);
  });
});
