// NEX1 · CAPABILITY A · v5.0.0-alpha.7 · Phase 1.10-alpha.2
// Cluster 2 detector wire-up: extractProjectDirs() is now live in classifier.ts.
//
// This alpha wires the detector behind the alpha.6 structural surface. Founder
// decisions applied (2026-09-16):
//   #1 · `in` IS in PATH_VERBS_PREPS
//   #2 · framework_anchor MANDATORY co-occurrence with path_noun
//   #3 · compound path emits ONE reference with segments[] — not many refs
//
// Scope of this test file:
//   - one positive test per Nex1ProjectDirEvidenceKind
//   - compound-path structural test (path + segments together)
//   - founder-stated negative seeds (basic Kill-Test coverage · full corpus
//     lands in alpha.3)
//
// Alpha.3 will add the dedicated directory-context false-positive test suite
// per founder direction: "detection must never equal directory understanding".

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

// ── version guard ────────────────────────────────────────────────────────────

describe("capability-a v5.0.0-alpha.7 · version", () => {
  it("VOCABULARY_VERSION is v5.0.0-alpha.7 or later alpha", () => {
    expect(VOCABULARY_VERSION.startsWith("v5.0.0-alpha.")).toBe(true);
    const suffix = Number(VOCABULARY_VERSION.slice("v5.0.0-alpha.".length));
    expect(suffix).toBeGreaterThanOrEqual(7);
  });
});

// ── positive: one case per evidence kind ────────────────────────────────────

describe("capability-a v5.0.0-alpha.7 · trailing_slash evidence", () => {
  it("emits trailing_slash for 'build a helper and place it into components/'", () => {
    const result = refs("build a helper and place it into components/");
    const match = result.find((r) => r.path === "components");
    expect(match).toBeDefined();
    expect(match!.evidence).toBe("trailing_slash");
    expect(match!.segments).toEqual(["components"]);
  });
});

describe("capability-a v5.0.0-alpha.7 · path_segment evidence (compound)", () => {
  it("emits ONE compound reference for 'add a new page to the src/app directory'", () => {
    const result = refs("add a new page to the src/app directory");
    const compound = result.find((r) => r.path === "src/app");
    expect(compound).toBeDefined();
    // Founder decision #3 · compound path emits ONE ref with segments[]:
    expect(compound!.segments).toEqual(["src", "app"]);
    expect(compound!.evidence).toBe("path_segment");
    // Must NOT emit three separate references (src, app individually).
    // Path 'src' by itself is inside the compound span and should be claimed.
    expect(result.filter((r) => r.path === "src").length).toBe(0);
    expect(result.filter((r) => r.path === "app").length).toBe(0);
  });

  it("emits ONE compound reference for 'modify code under src/lib/util'", () => {
    const result = refs("modify code under src/lib/util");
    const compound = result.find((r) => r.path === "src/lib/util");
    expect(compound).toBeDefined();
    expect(compound!.segments).toEqual(["src", "lib", "util"]);
    expect(compound!.evidence).toBe("path_segment");
    // No independent per-segment references:
    expect(result.length).toBe(1);
  });
});

describe("capability-a v5.0.0-alpha.7 · path_noun_anchor evidence", () => {
  it("emits path_noun_anchor for 'investigate the services directory'", () => {
    const result = refs("investigate the services directory");
    const match = result.find((r) => r.path === "services");
    expect(match).toBeDefined();
    expect(match!.evidence).toBe("path_noun_anchor");
    expect(match!.segments).toEqual(["services"]);
  });

  it("path noun 'folder' also anchors: 'investigate the hooks folder'", () => {
    const result = refs("investigate the hooks folder");
    const match = result.find((r) => r.path === "hooks");
    expect(match).toBeDefined();
    expect(match!.evidence).toBe("path_noun_anchor");
  });
});

describe("capability-a v5.0.0-alpha.7 · path_verb_anchor evidence", () => {
  it("emits path_verb_anchor for 'modify code inside hooks' via `inside`", () => {
    const result = refs("modify code inside hooks");
    const match = result.find((r) => r.path === "hooks");
    expect(match).toBeDefined();
    expect(match!.evidence).toBe("path_verb_anchor");
  });

  it("emits path_verb_anchor for 'modify code in services' via `in` (founder #1)", () => {
    const result = refs("modify code in services");
    const match = result.find((r) => r.path === "services");
    expect(match).toBeDefined();
    expect(match!.evidence).toBe("path_verb_anchor");
  });

  it("emits path_verb_anchor for 'modify code under components'", () => {
    const result = refs("modify code under components");
    const match = result.find((r) => r.path === "components");
    expect(match).toBeDefined();
    expect(match!.evidence).toBe("path_verb_anchor");
  });
});

describe("capability-a v5.0.0-alpha.7 · adjacent_file_ref evidence", () => {
  it("emits adjacent_file_ref for the directory portion of a file reference", () => {
    const result = refs("fix bug in src/lib/auth.ts:42");
    const match = result.find((r) => r.evidence === "adjacent_file_ref");
    expect(match).toBeDefined();
    expect(match!.path).toBe("src/lib");
    expect(match!.segments).toEqual(["src", "lib"]);
  });
});

describe("capability-a v5.0.0-alpha.7 · framework_anchor evidence", () => {
  it("emits framework_anchor when framework AND path_noun co-occur", () => {
    // 'Rails' is a framework lexeme; 'directory' is a path_noun. Both within ±2 of 'app'.
    const result = refs("modify the Rails app directory");
    const match = result.find((r) => r.path === "app");
    expect(match).toBeDefined();
    expect(match!.evidence).toBe("framework_anchor");
  });

  it("does NOT emit when framework is present but path_noun is absent (founder #2)", () => {
    // "React components are stateful" — framework 'react' nearby, but no path_noun.
    // Framework anchor MANDATORY co-occurrence with path_noun. So no emit.
    const result = refs("modify code because React components are stateful");
    expect(result.filter((r) => r.path === "components").length).toBe(0);
  });
});

// ── negative: Founder Kill Test seeds (alpha.3 will expand) ─────────────────

describe("capability-a v5.0.0-alpha.7 · Founder Kill Test seeds · bare English words emit nothing", () => {
  it("'the company provides services' emits no reference for 'services'", () => {
    const result = refs("investigate why the company provides services");
    expect(result.filter((r) => r.path === "services").length).toBe(0);
  });

  it("'The services are slow' emits no reference for 'services'", () => {
    const result = refs("investigate why the services are slow");
    expect(result.filter((r) => r.path === "services").length).toBe(0);
  });

  it("'the pages of the book' emits no reference for 'pages'", () => {
    const result = refs("investigate the pages of the book");
    expect(result.filter((r) => r.path === "pages").length).toBe(0);
  });

  it("'our features include free shipping' emits no reference for 'features'", () => {
    const result = refs("investigate why our features include free shipping");
    expect(result.filter((r) => r.path === "features").length).toBe(0);
  });

  it("'the domain of the problem' emits no reference for 'domain'", () => {
    const result = refs("investigate the domain of the problem");
    expect(result.filter((r) => r.path === "domain").length).toBe(0);
  });
});

// ── coexistence with verb extraction ────────────────────────────────────────

describe("capability-a v5.0.0-alpha.7 · verb-word / dir-word coexistence", () => {
  it("'test' claimed as TEST verb; 'services' claimed as dir when anchored", () => {
    const result = classified(classifyFounderIntent("test the services directory"));
    // Verb captured `test` as TEST family.
    expect(result.verb_family).toBe("TEST");
    // Dir extraction still catches `services` via path_noun 'directory'.
    const dir = result.project_dir_references.find((r) => r.path === "services");
    expect(dir).toBeDefined();
    expect(dir!.evidence).toBe("path_noun_anchor");
  });

  it("dir tokens surface in project_dir_references AND may also surface in coding_concepts (design-doc: coding-concept extractor UNCHANGED)", () => {
    const result = classified(classifyFounderIntent("investigate the hooks folder"));
    // Project-dir emission via detector:
    expect(result.project_dir_references.some((r) => r.path === "hooks")).toBe(true);
    // Coexistence with coding_concepts is BY DESIGN. Cluster 2 introduces a
    // separate evidence field; it does NOT remove pre-existing v4 concept
    // registrations. Downstream consumers pick the shape they need.
  });
});

// ── determinism ─────────────────────────────────────────────────────────────

describe("capability-a v5.0.0-alpha.7 · determinism", () => {
  it("same goal → same references twice in a row (spans, evidence, order all stable)", () => {
    const a = refs("modify code under src/lib/util and inside hooks");
    const b = refs("modify code under src/lib/util and inside hooks");
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(0);
  });
});

// ── ordering + span integrity ───────────────────────────────────────────────

describe("capability-a v5.0.0-alpha.7 · ordering", () => {
  it("references are sorted by span start ascending", () => {
    const result = refs("modify components/ and then inside hooks and finally the services directory");
    const starts = result.map((r) => r.span.start);
    const sorted = [...starts].sort((a, b) => a - b);
    expect(starts).toEqual(sorted);
  });
});
