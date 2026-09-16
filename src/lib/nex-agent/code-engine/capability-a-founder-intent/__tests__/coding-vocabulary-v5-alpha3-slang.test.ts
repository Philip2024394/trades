// NEX1 · CAPABILITY A · v5.0.0-alpha.3 vocabulary tests
// Cluster 3 additions: annotations / git slang / smells / bug taxonomy / branching
// strategies / commit conventions / review shorthand / lifecycle / principles / refactor names.

import { describe, it, expect } from "vitest";
import { classifyFounderIntent } from "../classifier";
import { CODE_CONCEPT_LEXEMES, VOCABULARY_VERSION } from "../vocabulary";
import type { Nex1IntentClassified } from "../types";

function classified(result: ReturnType<typeof classifyFounderIntent>): Nex1IntentClassified {
  if (result.kind !== "classified") throw new Error(`expected classified, got ${result.kind}`);
  return result;
}

const NEW_CONCEPTS_ALPHA3: readonly string[] = [
  // annotations
  "todo", "fixme", "hack", "xxx", "note", "tbd", "wip", "nosonar",
  "eslint-disable", "eslint-disable-next-line", "ts-ignore", "ts-expect-error",
  "ts-nocheck", "prettier-ignore", "biome-ignore", "deprecated", "unstable",
  "experimental", "alpha", "beta", "internal", "magic-number", "magic-string",
  "hardcoded", "ugly-hack",
  // git slang
  "yolo-push", "force-with-lease", "force-push", "fixup", "autosquash",
  "backport", "forward-port", "no-ff", "ours-strategy", "theirs-strategy",
  "rerere", "stash-apply", "stash-pop", "partial-clone", "worktree-add",
  "revert-commit", "merge-commit", "dirty-tree",
  // smells
  "god-object", "god-class", "spaghetti-code", "lasagna-code", "ravioli-code",
  "callback-hell", "promise-hell", "pyramid-of-doom", "boilerplate",
  "over-engineering", "premature-optimization", "gold-plating", "yak-shaving",
  "bikeshedding", "dead-code", "zombie-code", "cargo-cult",
  "copy-paste-programming", "feature-envy", "primitive-obsession",
  "shotgun-surgery", "refused-bequest", "inappropriate-intimacy", "data-clumps",
  "long-parameter-list", "long-method", "large-class", "temporary-field",
  "comments-as-apology",
  // bug taxonomy
  "bohrbug", "schrodinbug", "hindenbug", "phantom-bug", "race-condition",
  "priority-inversion", "fencepost-error", "integer-overflow", "infinite-loop",
  "wild-pointer",
  // branching
  "git-flow", "github-flow", "gitlab-flow", "trunk-based-development",
  "release-train", "release-flow", "feature-branch-workflow", "forking-workflow",
  "one-flow", "environment-branching", "chained-prs",
  // commit conventions
  "angular-convention", "gitmoji", "emoji-log", "tim-pope-style",
  "fifty-seventy-two", "signed-off-by", "co-authored-by", "dco", "cla",
  // code review
  "sgtm", "wfm", "ptal", "tal", "r-plus", "r-minus", "nitpick",
  "blocking-comment", "non-blocking-comment", "wontfix", "needs-info",
  "needs-repro", "ship-it", "ready-to-merge", "do-not-merge", "dnm",
  "lgtm-squared",
  // lifecycle
  "dogfooding", "canary-user", "alpha-tester", "beta-tester",
  "general-availability", "ga-release", "sunset", "greenfield", "brownfield",
  "mmp", "mlp", "moonshot", "cut-a-release", "tag-a-release", "bugfix-release",
  "patch-release", "dot-release", "major-bump", "minor-bump", "patch-bump",
  // principle acronyms
  "yagni", "dry", "wet", "kiss", "srp", "ocp", "lsp-liskov", "isp", "dip",
  "grasp", "pola", "pole", "separation-of-concerns", "single-source-of-truth",
  "ssot",
  // Fowler refactors
  "extract-method", "extract-function", "extract-class", "extract-variable",
  "inline-method", "inline-variable", "rename-refactor", "move-method",
  "move-class", "replace-magic-number", "replace-conditional-with-polymorphism",
  "replace-loop-with-pipeline", "decompose-conditional",
  "consolidate-conditional-expression", "introduce-parameter-object",
  "remove-flag-argument",
];

describe("capability-a v5.0.0-alpha.3 · version + concept additions", () => {
  it("VOCABULARY_VERSION is v5.0.0-alpha.3 or later alpha", () => {
    expect(VOCABULARY_VERSION.startsWith("v5.0.0-alpha.")).toBe(true);
  });
});

describe("capability-a v5.0.0-alpha.3 · every new concept present in CODE_CONCEPT_LEXEMES", () => {
  for (const lex of NEW_CONCEPTS_ALPHA3) {
    it(`CODE_CONCEPT_LEXEMES has \`${lex}\` = concept`, () => {
      expect(CODE_CONCEPT_LEXEMES.get(lex)).toBe("concept");
    });
  }
});

describe("capability-a v5.0.0-alpha.3 · classifier extracts new concepts", () => {
  it("in-code annotations extracted", () => {
    const r = classified(
      classifyFounderIntent("investigate the todo and fixme markers plus any ts-ignore left in auth"),
    );
    const cats = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(cats).toContain("todo:concept");
    expect(cats).toContain("fixme:concept");
    expect(cats).toContain("ts-ignore:concept");
  });

  it("git slang extracted", () => {
    const r = classified(
      classifyFounderIntent("investigate the fixup commits and force-with-lease policy on main"),
    );
    const cats = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(cats).toContain("fixup:concept");
    expect(cats).toContain("force-with-lease:concept");
  });

  it("code smells extracted", () => {
    const r = classified(
      classifyFounderIntent("refactor the god-object plus the callback-hell in the auth service"),
    );
    const cats = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(cats).toContain("god-object:concept");
    expect(cats).toContain("callback-hell:concept");
  });

  it("bug taxonomy extracted", () => {
    const r = classified(
      classifyFounderIntent("investigate the race-condition and the possible bohrbug in the scheduler"),
    );
    const cats = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(cats).toContain("race-condition:concept");
    expect(cats).toContain("bohrbug:concept");
  });

  it("branching strategies extracted", () => {
    const r = classified(
      classifyFounderIntent("investigate whether git-flow or trunk-based-development suits us"),
    );
    const cats = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(cats).toContain("git-flow:concept");
    expect(cats).toContain("trunk-based-development:concept");
  });

  it("code-review shorthand extracted", () => {
    const r = classified(
      classifyFounderIntent("investigate the sgtm and ptal patterns for our review conventions"),
    );
    const cats = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(cats).toContain("sgtm:concept");
    expect(cats).toContain("ptal:concept");
  });

  it("Fowler refactor names extracted", () => {
    const r = classified(
      classifyFounderIntent("refactor with extract-method plus inline-variable plus rename-refactor across the module"),
    );
    const cats = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(cats).toContain("extract-method:concept");
    expect(cats).toContain("inline-variable:concept");
    expect(cats).toContain("rename-refactor:concept");
  });

  it("principle acronyms extracted", () => {
    const r = classified(
      classifyFounderIntent("refactor to honour dry and kiss without violating srp or dip"),
    );
    const cats = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(cats).toContain("dry:concept");
    expect(cats).toContain("kiss:concept");
    expect(cats).toContain("srp:concept");
    expect(cats).toContain("dip:concept");
  });
});
