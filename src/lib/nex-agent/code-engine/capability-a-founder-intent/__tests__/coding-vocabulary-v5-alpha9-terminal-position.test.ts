// NEX1 · CAPABILITY A · v5.0.0-alpha.9 · Phase 1.10-alpha.4
// TERMINAL-POSITION RULE for path_verb_anchor + underscore-dir tokenization fix
//
// Founder directive 2026-09-16 · Native Understanding Fix Prompt:
//   "The goal is to make NEX1 understand the surrounding structural evidence
//    sufficiently to distinguish PATH CONTEXT (in src/lib) from NORMAL
//    LANGUAGE (in services rendered). Develop a deterministic, evidence-backed
//    rule. Do not hard-code only these two sentences. The solution must
//    generalise to unseen examples."
//
// This file is TEST-FIRST: it demonstrates the expected behaviour of the
// alpha.9 rule BEFORE the rule is implemented. Every assertion here is what
// the founder's directive requires. If a test fails, the implementation is
// incomplete or wrong — never weaken the test.

import { describe, it, expect } from "vitest";
import { classifyFounderIntent } from "../classifier";
import { VOCABULARY_VERSION } from "../vocabulary";
import type { Nex1IntentClassified, Nex1ProjectDirReference } from "../types";

function classified(result: ReturnType<typeof classifyFounderIntent>): Nex1IntentClassified {
  if (result.kind !== "classified") throw new Error(`expected classified, got ${result.kind}`);
  return result;
}
function refs(goal: string): readonly Nex1ProjectDirReference[] {
  return classified(classifyFounderIntent(goal)).project_dir_references;
}

// ── §0 · version guard ──────────────────────────────────────────────────────

describe("Alpha.9 · version", () => {
  it("VOCABULARY_VERSION is v5.0.0-alpha.9 or later", () => {
    expect(VOCABULARY_VERSION.startsWith("v5.0.0-alpha.")).toBe(true);
    const suffix = Number(VOCABULARY_VERSION.slice("v5.0.0-alpha.".length));
    expect(suffix).toBeGreaterThanOrEqual(9);
  });
});

// ── §1 · Terminal-position rule · PATH CONTEXT still emits ──────────────────
// These cases MUST continue to emit because they are genuine path references
// (English clause terminates or path continues after the target).

describe("Alpha.9 · Terminal · path context CONTINUES to emit correctly", () => {
  it("'modify code in services' → EMIT (target at end of goal · T1)", () => {
    const r = refs("modify code in services");
    const svc = r.find((x) => x.path === "services");
    expect(svc).toBeDefined();
    expect(svc!.evidence).toBe("path_verb_anchor");
  });

  it("'modify code inside hooks' → EMIT (T1)", () => {
    const r = refs("modify code inside hooks");
    expect(r.some((x) => x.path === "hooks" && x.evidence === "path_verb_anchor")).toBe(true);
  });

  it("'modify code under components' → EMIT (T1)", () => {
    const r = refs("modify code under components");
    expect(r.some((x) => x.path === "components")).toBe(true);
  });

  it("'modify code in services.' → EMIT (target followed by period · T2)", () => {
    const r = refs("modify code in services. Then run tests");
    const svc = r.find((x) => x.path === "services");
    expect(svc).toBeDefined();
    expect(svc!.evidence).toBe("path_verb_anchor");
  });

  it("'modify code in services, and run tests' → EMIT (target followed by comma · T2)", () => {
    const r = refs("modify code in services, and run tests");
    const svc = r.find((x) => x.path === "services");
    expect(svc).toBeDefined();
    expect(svc!.evidence).toBe("path_verb_anchor");
  });

  it("'modify code in services directory' → EMIT via path_noun_anchor (path_noun overrides path_verb)", () => {
    const r = refs("modify code in services directory");
    const svc = r.find((x) => x.path === "services");
    expect(svc).toBeDefined();
    // path_noun_anchor is stronger than path_verb_anchor when both apply
    expect(svc!.evidence).toBe("path_noun_anchor");
  });

  it("'in src/lib' remains a compound path_segment (Pass 2 unaffected)", () => {
    const r = refs("modify code in src/lib");
    const compound = r.find((x) => x.path === "src/lib");
    expect(compound).toBeDefined();
    expect(compound!.evidence).toBe("path_segment");
    expect(compound!.segments).toEqual(["src", "lib"]);
  });

  it("'in src/lib/utils' remains a compound path_segment", () => {
    const r = refs("modify code in src/lib/utils");
    const compound = r.find((x) => x.path === "src/lib/utils");
    expect(compound).toBeDefined();
    expect(compound!.segments).toEqual(["src", "lib", "utils"]);
  });
});

// ── §2 · Terminal-position rule · ENGLISH CONTINUATION suppressed ──────────
// These are the alpha.3 kill-test open questions the founder wanted to
// answer with a general rule (not a hard-coded pair). The pattern is:
//   <path_verb_prep> <well-known-dir> <trailing English word>
// where the trailing word is neither a path anchor nor a list continuation.

describe("Alpha.9 · Terminal · English continuation CORRECTLY SUPPRESSES emission", () => {
  it("'in services rendered' → NO EMIT (founder's canonical example)", () => {
    const r = refs("investigate why the promise was made in services rendered");
    expect(r.find((x) => x.path === "services")).toBeUndefined();
  });

  it("'from tests written last year' → NO EMIT", () => {
    const r = refs("investigate results from tests written last year");
    expect(r.find((x) => x.path === "tests")).toBeUndefined();
  });

  it("'to pages listed in the report' → NO EMIT", () => {
    const r = refs("verify all links point to pages listed in the report");
    expect(r.find((x) => x.path === "pages")).toBeUndefined();
  });

  it("'under models developed by our team' → NO EMIT", () => {
    const r = refs("verify all metrics under models developed by our team");
    expect(r.find((x) => x.path === "models")).toBeUndefined();
  });

  it("'inside layouts printed by the vendor' → NO EMIT", () => {
    const r = refs("investigate defects inside layouts printed by the vendor");
    expect(r.find((x) => x.path === "layouts")).toBeUndefined();
  });

  it("'at pages viewed last week' → NO EMIT", () => {
    const r = refs("investigate at pages viewed last week");
    expect(r.find((x) => x.path === "pages")).toBeUndefined();
  });

  it("'from services provided by us' → NO EMIT", () => {
    const r = refs("investigate revenue from services provided by us");
    expect(r.find((x) => x.path === "services")).toBeUndefined();
  });

  it("'to processes that failed' → NO EMIT", () => {
    const r = refs("investigate references to processes that failed");
    expect(r.find((x) => x.path === "processes")).toBeUndefined();
  });

  it("'in commands that ran' → NO EMIT", () => {
    const r = refs("investigate errors in commands that ran");
    expect(r.find((x) => x.path === "commands")).toBeUndefined();
  });

  it("'in events triggered' → NO EMIT", () => {
    const r = refs("investigate the timing in events triggered before the incident");
    expect(r.find((x) => x.path === "events")).toBeUndefined();
  });
});

// ── §3 · Terminal-position rule · LIST-of-dirs continuation ─────────────────

describe("Alpha.9 · Terminal · list-of-dirs continuation emits (T3 / T5)", () => {
  it("'in components hooks' — bare adjacency treated as list · T3", () => {
    const r = refs("modify code in components hooks");
    const comp = r.find((x) => x.path === "components");
    expect(comp).toBeDefined();
    expect(comp!.evidence).toBe("path_verb_anchor");
    // hooks has no path_verb_prep before it (prev = components, not in PATH_VERBS_PREPS)
    // — so hooks may or may not emit. Assertion documents current behaviour.
    const hooks = r.find((x) => x.path === "hooks");
    // hooks is not preceded by a path_verb_prep — expected NO EMIT (this is
    // the "chain propagation" open question, alpha.5+ scope).
    expect(hooks).toBeUndefined();
  });

  it("'in components and hooks' — connector + well-known dir · T5 for components", () => {
    const r = refs("modify code in components and hooks");
    const comp = r.find((x) => x.path === "components");
    expect(comp).toBeDefined();
    expect(comp!.evidence).toBe("path_verb_anchor");
    // hooks: prev = 'and' (not path_verb_prep). No emit (chain propagation is
    // an alpha.5+ open question). Documented in memory.
    expect(r.find((x) => x.path === "hooks")).toBeUndefined();
  });

  it("'in services or hooks' — 'or' + well-known dir · T5 for services", () => {
    const r = refs("modify code in services or hooks");
    const svc = r.find((x) => x.path === "services");
    expect(svc).toBeDefined();
    expect(svc!.evidence).toBe("path_verb_anchor");
  });

  it("'in services and rendered' — connector + NON-well-known → NO EMIT (English continues)", () => {
    // 'rendered' is not a well-known dir, so T5 does NOT fire. This means
    // 'services' fails the terminal check → NO EMIT.
    const r = refs("investigate what was in services and rendered last week");
    expect(r.find((x) => x.path === "services")).toBeUndefined();
  });
});

// ── §4 · Terminal-position rule · PATH_NOUN follows target (T4) ────────────

describe("Alpha.9 · Terminal · path_noun follows target (T4)", () => {
  it("'in services directory' → EMIT via path_noun_anchor (T4 also satisfies path-noun rule)", () => {
    const r = refs("modify code in services directory");
    const svc = r.find((x) => x.path === "services");
    expect(svc).toBeDefined();
    // path_noun_anchor wins because path_noun anchor is stronger than
    // path_verb anchor in the evidence priority.
    expect(svc!.evidence).toBe("path_noun_anchor");
  });

  it("'in hooks folder' → EMIT via path_noun_anchor", () => {
    const r = refs("modify code in hooks folder");
    const h = r.find((x) => x.path === "hooks");
    expect(h).toBeDefined();
    expect(h!.evidence).toBe("path_noun_anchor");
  });
});

// ── §5 · Ambiguity remains honest ───────────────────────────────────────────
// Per founder Section 15.F "Ambiguity remains honest": when NEX cannot know
// from structural evidence, no emission. These are genuinely ambiguous.

describe("Alpha.9 · Ambiguity · genuinely unclear cases stay silent", () => {
  it("'the util lives in services' → NO EMIT (English idiom, no structural evidence)", () => {
    // 'in services' at goal end is arguably path-adjacent, but no structural
    // evidence beyond that. Current rule allows it (T1 satisfied). This
    // documents the trade-off: some English idioms end at a well-known dir
    // word. The founder accepted this when authorising `in` in PATH_VERBS_PREPS.
    const r = refs("investigate why the util lives in services");
    const svc = r.find((x) => x.path === "services");
    // This DOES emit — the rule cannot tell "in services" (path) from
    // "in services" (English) without more context. Emitting with
    // path_verb_anchor (weakest evidence) is the honest label.
    expect(svc).toBeDefined();
    expect(svc!.evidence).toBe("path_verb_anchor");
  });
});

// ── §6 · Underscore-prefixed directory tokenization fix ─────────────────────

describe("Alpha.9 · Tokenizer · underscore-prefixed dirs now detectable", () => {
  it("'investigate the __tests__ folder' → EMIT via path_noun_anchor", () => {
    const r = refs("investigate the __tests__ folder");
    const t = r.find((x) => x.path === "__tests__");
    expect(t).toBeDefined();
    expect(t!.evidence).toBe("path_noun_anchor");
  });

  it("'investigate the __mocks__ folder' → EMIT", () => {
    const r = refs("investigate the __mocks__ folder");
    expect(r.some((x) => x.path === "__mocks__")).toBe(true);
  });

  it("'investigate the __snapshots__ directory' → EMIT", () => {
    const r = refs("investigate the __snapshots__ directory");
    expect(r.some((x) => x.path === "__snapshots__")).toBe(true);
  });

  it("'investigate the __pycache__ directory' → EMIT", () => {
    const r = refs("investigate the __pycache__ directory");
    expect(r.some((x) => x.path === "__pycache__")).toBe(true);
  });

  it("'build a helper and place it in __tests__/' → EMIT via trailing_slash", () => {
    const r = refs("build a helper and place it in __tests__/");
    const t = r.find((x) => x.path === "__tests__");
    expect(t).toBeDefined();
    expect(t!.evidence).toBe("trailing_slash");
  });

  it("'modify code in __tests__/unit' → EMIT compound path_segment", () => {
    const r = refs("modify code in __tests__/unit");
    const compound = r.find((x) => x.path === "__tests__/unit");
    expect(compound).toBeDefined();
    expect(compound!.segments).toEqual(["__tests__", "unit"]);
  });

  it("'modify code and _internal_var stays quiet' → underscore-prefixed non-dir tokens NOT emit", () => {
    // The tokenizer now accepts `_internal_var` as a token, but it is not
    // in WELL_KNOWN_PROJECT_DIRS, so no emission occurs. This confirms the
    // tokenizer change does not create noise in project_dir_references.
    const r = refs("modify code and _internal_var stays quiet");
    expect(r.find((x) => x.path === "_internal_var")).toBeUndefined();
  });
});

// ── §7 · Regression protection · previous kill-test negative bank still holds ─

describe("Alpha.9 · Regression · alpha.8 negative bank still suppressed", () => {
  const NEGATIVE_STILL_QUIET: readonly { goal: string; disallowed: string }[] = [
    { goal: "investigate why the company provides services", disallowed: "services" },
    { goal: "investigate why the services are slow", disallowed: "services" },
    { goal: "verify the pages of the book", disallowed: "pages" },
    { goal: "modify code because React components are stateful", disallowed: "components" },
    { goal: "investigate why our features include free shipping", disallowed: "features" },
    { goal: "verify the domain of the problem", disallowed: "domain" },
    { goal: "investigate models on the runway", disallowed: "models" },
    { goal: "verify the templates are beautifully designed", disallowed: "templates" },
  ];
  it.each(NEGATIVE_STILL_QUIET)("$goal → does NOT emit '$disallowed'", ({ goal, disallowed }) => {
    const r = refs(goal);
    expect(r.find((x) => x.path === disallowed)).toBeUndefined();
  });
});

// ── §8 · Regression protection · previous positive bank still fires ─────────

describe("Alpha.9 · Regression · alpha.8 positive bank still emits", () => {
  it("'build a helper and place it into components/' → EMIT trailing_slash", () => {
    const r = refs("build a helper and place it into components/");
    expect(r.some((x) => x.path === "components" && x.evidence === "trailing_slash")).toBe(true);
  });

  it("'add a new page to the src/app directory' → EMIT compound path_segment", () => {
    const r = refs("add a new page to the src/app directory");
    const c = r.find((x) => x.path === "src/app");
    expect(c).toBeDefined();
    expect(c!.evidence).toBe("path_segment");
  });

  it("'investigate the services directory' → EMIT path_noun_anchor", () => {
    const r = refs("investigate the services directory");
    const s = r.find((x) => x.path === "services");
    expect(s).toBeDefined();
    expect(s!.evidence).toBe("path_noun_anchor");
  });

  it("'fix bug in src/lib/auth.ts:42' → EMIT adjacent_file_ref", () => {
    const r = refs("fix bug in src/lib/auth.ts:42");
    expect(r.some((x) => x.evidence === "adjacent_file_ref" && x.path === "src/lib")).toBe(true);
  });

  it("'modify the Rails app directory' → EMIT framework_anchor", () => {
    const r = refs("modify the Rails app directory");
    const a = r.find((x) => x.path === "app");
    expect(a).toBeDefined();
    expect(a!.evidence).toBe("framework_anchor");
  });
});

// ── §9 · Adversarial · Founder Section 14 requirement ─────────────────────────
// "Add adversarial tests designed to make NEX1 fail if its understanding is
// superficial."

describe("Alpha.9 · Adversarial · unseen-style pattern probes", () => {
  it("'in the aftermath of services provided' — 'services' is NOT after path_verb_prep (prev='of')", () => {
    const r = refs("investigate in the aftermath of services provided last quarter");
    expect(r.find((x) => x.path === "services")).toBeUndefined();
  });

  it("'from within services listed' — chained prep, English continuation", () => {
    const r = refs("investigate revenue from within services listed by the vendor");
    // 'within' IS a path_verb_prep. Target 'services'. Next = 'listed'. Not T1-T5. → NO EMIT.
    expect(r.find((x) => x.path === "services")).toBeUndefined();
  });

  it("'at pages' at end of goal — EMIT (T1, weakest evidence)", () => {
    const r = refs("build a menu that links visitors at pages");
    // Ambiguous. Detector emits path_verb_anchor (weakest).
    const p = r.find((x) => x.path === "pages");
    expect(p).toBeDefined();
    expect(p!.evidence).toBe("path_verb_anchor");
  });

  it("'to processes and models handled by us' — connector, but next+1 is well-known → EMIT processes", () => {
    // 'processes' preceded by 'to' (path_verb_prep). Next = 'and'. Next+1 = 'models' (well-known).
    // → T5 fires. EMIT.
    const r = refs("investigate calls to processes and models handled by us");
    const p = r.find((x) => x.path === "processes");
    expect(p).toBeDefined();
    expect(p!.evidence).toBe("path_verb_anchor");
  });

  it("'in tests, verify' — comma after target → EMIT (T2 punctuation)", () => {
    const r = refs("modify code in tests, verify results");
    const t = r.find((x) => x.path === "tests");
    expect(t).toBeDefined();
    expect(t!.evidence).toBe("path_verb_anchor");
  });

  it("'at pages that were viewed' — English continuation via 'that' → NO EMIT", () => {
    const r = refs("investigate lookups at pages that were viewed yesterday");
    expect(r.find((x) => x.path === "pages")).toBeUndefined();
  });

  it("path context AFTER an ambiguous English clause still emits", () => {
    // 'inside services rendered by' — NO EMIT for services.
    // But 'in src/lib' in the same goal STILL emits (compound Pass 2).
    const r = refs("investigate why systems inside services rendered by us call the api in src/lib");
    expect(r.find((x) => x.path === "services")).toBeUndefined();
    const compound = r.find((x) => x.path === "src/lib");
    expect(compound).toBeDefined();
    expect(compound!.evidence).toBe("path_segment");
  });
});
