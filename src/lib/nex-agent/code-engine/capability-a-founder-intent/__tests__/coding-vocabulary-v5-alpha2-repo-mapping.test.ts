// NEX1 · CAPABILITY A · v5.0.0-alpha.2 vocabulary tests
// Cluster 5 additions: parsers / AST tools / symbol indexers / search / repo stats /
// diff-merge / doc generators / language servers / code-intel protocols /
// AST-analysis concepts / architecture patterns.

import { describe, it, expect } from "vitest";
import { classifyFounderIntent } from "../classifier";
import {
  CODE_CONCEPT_LEXEMES,
  TOOL_LEXEMES,
  VOCABULARY_VERSION,
} from "../vocabulary";
import type { Nex1IntentClassified } from "../types";

function classified(result: ReturnType<typeof classifyFounderIntent>): Nex1IntentClassified {
  if (result.kind !== "classified") throw new Error(`expected classified, got ${result.kind}`);
  return result;
}

const NEW_TOOLS_ALPHA2: readonly string[] = [
  // parser / AST
  "tree-sitter", "antlr", "pegjs", "peg", "yacc", "bison", "lark", "chumsky",
  "nom-rs", "pest-rs", "lalrpop", "combine-rs", "winnow-rs", "esprima", "acorn",
  "espree", "meriyah", "sucrase", "oxc", "clang-libtooling", "jsii",
  // symbol indexers
  "ctags", "universal-ctags", "exuberant-ctags", "gtags", "cscope",
  "sourcegraph", "glean", "kythe", "semmle", "zoekt",
  // search family
  "ripgrep", "rg", "silver-searcher", "ack", "grep", "egrep", "fgrep", "sift",
  "pt", "fzf", "fd", "fdfind", "plocate", "mlocate",
  // repo stats
  "tokei", "cloc", "scc", "gocloc", "gitstats", "git-of-theseus",
  "git-quick-stats", "code-maat", "ohcount",
  // diff + merge
  "unix-diff", "git-diff", "git-delta", "diff-so-fancy", "difftastic", "difft",
  "meld", "kdiff3", "p4merge", "beyond-compare", "araxis-merge", "diffmerge",
  "winmerge", "vimdiff", "nvimdiff", "opendiff",
  // doc generators
  "godoc", "rustdoc", "cargo-doc", "typedoc", "jsdoc", "esdoc", "phpdoc",
  "yardoc", "sphinx", "mkdocs", "docusaurus", "vitepress", "vuepress", "docsify",
  "gitbook", "retype", "honkit", "docz", "styleguidist", "ladle", "histoire",
  "tsdoc", "javadoc", "doxygen", "hdoc", "pkgdown", "roxygen2", "plantuml",
  "mermaid", "structurizr", "c4-model", "arc42",
  // repo mapping vis
  "dependency-cruiser", "arkit", "code2flow", "pyreverse", "ndepend",
  "structure101", "scitools-understand", "sourcetrail",
  // language servers
  "rust-analyzer", "gopls", "pylance", "jedi-language-server",
  "typescript-language-server", "tsserver", "deno-lsp", "sourcekit-lsp",
  "kotlin-language-server", "clangd", "ccls", "metals-scala", "elixir-ls",
  "haskell-language-server", "ocaml-lsp", "terraform-ls", "yaml-language-server",
  "tailwindcss-language-server",
];

const NEW_CONCEPTS_ALPHA2: readonly string[] = [
  // protocols
  "lsp", "dap", "bsp", "mcp", "lsif", "scip",
  // AST-analysis + IR
  "cfg", "dfg", "ssa", "ir", "mir", "hir", "thir", "bitcode",
  "use-def-chain", "def-use-chain", "dominator-tree", "post-dominator-tree",
  "call-graph", "class-hierarchy", "import-graph", "module-graph",
  "symbol-table", "name-resolution", "scope-analysis", "taint-analysis",
  "points-to-analysis", "escape-analysis", "alias-analysis",
  "dead-code-elimination", "constant-folding", "constant-propagation",
  "common-subexpression-elimination", "abstract-syntax-tree",
  "concrete-syntax-tree", "intermediate-representation",
  // architecture patterns
  "hexagonal-architecture", "ports-and-adapters", "clean-architecture",
  "onion-architecture", "layered-architecture", "feature-sliced-design",
  "atomic-design", "screaming-architecture", "event-driven-architecture",
  "event-sourcing", "outbox-pattern", "transactional-inbox",
];

describe("capability-a v5.0.0-alpha.2 · version + registry growth", () => {
  it("VOCABULARY_VERSION is v5.0.0-alpha.2 or a later alpha in the same series", () => {
    // Later alpha bumps preserve alpha.2 additions (add-only).
    expect(VOCABULARY_VERSION.startsWith("v5.0.0-alpha.")).toBe(true);
  });

  it("TOOL_LEXEMES contains all alpha.2 tool additions", () => {
    for (const lex of NEW_TOOLS_ALPHA2) {
      expect(TOOL_LEXEMES.get(lex)).toBe("tool");
    }
  });

  it("CODE_CONCEPT_LEXEMES contains all alpha.2 concept additions", () => {
    for (const lex of NEW_CONCEPTS_ALPHA2) {
      expect(CODE_CONCEPT_LEXEMES.get(lex)).toBe("concept");
    }
  });
});

describe("capability-a v5.0.0-alpha.2 · every new tool present in TOOL_LEXEMES", () => {
  for (const lex of NEW_TOOLS_ALPHA2) {
    it(`TOOL_LEXEMES has \`${lex}\` = tool`, () => {
      expect(TOOL_LEXEMES.get(lex)).toBe("tool");
    });
  }
});

describe("capability-a v5.0.0-alpha.2 · every new concept present in CODE_CONCEPT_LEXEMES", () => {
  for (const lex of NEW_CONCEPTS_ALPHA2) {
    it(`CODE_CONCEPT_LEXEMES has \`${lex}\` = concept`, () => {
      expect(CODE_CONCEPT_LEXEMES.get(lex)).toBe("concept");
    });
  }
});

describe("capability-a v5.0.0-alpha.2 · classifier extracts new lexemes", () => {
  it("parser/AST tools extracted", () => {
    const r = classified(
      classifyFounderIntent("build a parser with tree-sitter and antlr then port it to lark"),
    );
    const cats = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(cats).toContain("tree-sitter:tool");
    expect(cats).toContain("antlr:tool");
    expect(cats).toContain("lark:tool");
  });

  it("symbol indexers + search tools extracted", () => {
    const r = classified(
      classifyFounderIntent("investigate the repo using ripgrep and sourcegraph and ctags for symbol lookup"),
    );
    const cats = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(cats).toContain("ripgrep:tool");
    expect(cats).toContain("sourcegraph:tool");
    expect(cats).toContain("ctags:tool");
  });

  it("repo stats tools extracted", () => {
    const r = classified(
      classifyFounderIntent("author a report using tokei and cloc and scc for line counts"),
    );
    const cats = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(cats).toContain("tokei:tool");
    expect(cats).toContain("cloc:tool");
    expect(cats).toContain("scc:tool");
  });

  it("diff/merge tools extracted", () => {
    const r = classified(
      classifyFounderIntent("build a review flow using difftastic and git-delta for structured diff viewing plus meld for merges"),
    );
    const cats = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(cats).toContain("difftastic:tool");
    expect(cats).toContain("git-delta:tool");
    expect(cats).toContain("meld:tool");
  });

  it("documentation generators extracted", () => {
    const r = classified(
      classifyFounderIntent("author the docs using sphinx and mkdocs and docusaurus and vitepress"),
    );
    const cats = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(cats).toContain("sphinx:tool");
    expect(cats).toContain("mkdocs:tool");
    expect(cats).toContain("docusaurus:tool");
    expect(cats).toContain("vitepress:tool");
  });

  it("language servers extracted", () => {
    const r = classified(
      classifyFounderIntent("investigate why rust-analyzer and gopls and clangd keep restarting"),
    );
    const cats = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(cats).toContain("rust-analyzer:tool");
    expect(cats).toContain("gopls:tool");
    expect(cats).toContain("clangd:tool");
  });

  it("code-intel protocols extracted", () => {
    const r = classified(
      classifyFounderIntent("build an lsp server that emits scip index for the repo"),
    );
    const cats = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(cats).toContain("lsp:concept");
    expect(cats).toContain("scip:concept");
  });

  it("AST-analysis concepts extracted", () => {
    const r = classified(
      classifyFounderIntent("investigate the call-graph and use-def-chain for taint-analysis via ssa"),
    );
    const cats = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(cats).toContain("call-graph:concept");
    expect(cats).toContain("use-def-chain:concept");
    expect(cats).toContain("taint-analysis:concept");
    expect(cats).toContain("ssa:concept");
  });

  it("architecture patterns extracted", () => {
    const r = classified(
      classifyFounderIntent("refactor to hexagonal-architecture with ports-and-adapters and event-sourcing"),
    );
    const cats = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(cats).toContain("hexagonal-architecture:concept");
    expect(cats).toContain("ports-and-adapters:concept");
    expect(cats).toContain("event-sourcing:concept");
  });
});
