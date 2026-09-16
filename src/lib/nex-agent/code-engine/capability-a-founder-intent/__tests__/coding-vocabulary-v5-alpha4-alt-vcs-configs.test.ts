// NEX1 · CAPABILITY A · v5.0.0-alpha.4 vocabulary tests
// Cluster 6 additions: alt-VCS + version managers + newer build tools + K8s tools +
// 2026-era config files (JS/TS/Python/Rust/Go) + container + platform + AI-agent configs.

import { describe, it, expect } from "vitest";
import { classifyFounderIntent } from "../classifier";
import { TOOL_LEXEMES, VOCABULARY_VERSION, WELL_KNOWN_CONFIG_FILES } from "../vocabulary";
import type { Nex1IntentClassified } from "../types";

function classified(result: ReturnType<typeof classifyFounderIntent>): Nex1IntentClassified {
  if (result.kind !== "classified") throw new Error(`expected classified, got ${result.kind}`);
  return result;
}

const NEW_TOOLS_ALPHA4: readonly string[] = [
  // alt-VCS
  "jujutsu", "jj", "sapling", "sl", "hg", "fossil", "pijul", "darcs", "bazaar",
  "bzr", "perforce", "p4", "plastic-scm", "subversion", "svn", "radicle",
  "git-annex", "gitea", "forgejo", "sourcehut", "codeberg",
  // language version managers
  "fnm", "volta", "nodenv", "pyenv", "rbenv", "rvm", "chruby", "jenv", "sdkman",
  "rustup", "ghcup", "opam", "tenv", "tfenv", "tgenv", "pkgx", "aqua", "proto",
  "fvm",
  // newer build tools
  "moonbit", "bzlmod", "dune", "esy", "mill", "bleep", "mask", "dagger",
  "earthly", "lage", "wireit", "ultra-runner", "syncpack", "buck",
  // K8s
  "helmfile", "skaffold", "tilt", "kyverno", "gatekeeper", "keda", "karpenter",
  "crossplane", "kustomize",
  // container ecosystem
  "podman", "buildah", "skopeo", "nerdctl",
  // rust + go extras
  "bacon", "air", "buf", "cargo-mutants", "cargo-shear",
];

const NEW_CONFIG_FILES_ALPHA4: readonly string[] = [
  // JS/TS 2026
  ".oxlintrc", ".oxlintrc.json", "deno.json", "deno.jsonc", "deno.lock",
  "jsr.json", "bunfig.toml", "bun.lock", ".pnpmrc", ".yarnignore", ".swcrc",
  ".swcignore", "tsconfig.node.json", "tsconfig.paths.json", ".tsbuildinfo",
  "ultra.config.json", "syncpack.config.js", ".changeset/config.json",
  // framework variants
  "svelte.config.ts", "solid.config.ts", "qwik.config.ts", "fresh.config.ts",
  "fresh.gen.ts", "nitro.config.ts", "unbuild.config.ts", "build.config.ts",
  "react-router.config.ts", "astro.config.ts", "astro.config.js",
  "remix.config.mjs", "vite.config.mts", "vitest.workspace.ts",
  // Python
  "uv.lock", "uv.toml", "pdm.lock", "pdm.toml", "hatch.toml", "ruff.toml",
  ".ruff.toml", "pixi.toml", "pixi.lock", "tox.ini", "noxfile.py",
  "conda-lock.yml", "environment.yml",
  // Rust
  "rust-toolchain.toml", "rust-toolchain", ".cargo/config.toml",
  ".cargo/credentials.toml", "clippy.toml", "rustfmt.toml", ".rustfmt.toml",
  "deny.toml", "nextest.toml", "bacon.toml",
  // Go
  "go.work", "go.work.sum", ".golangci.yml", ".golangci.yaml", ".golangci.toml",
  "revive.toml", ".goreleaser.yml", ".goreleaser.yaml", "air.toml", ".air.toml",
  "buf.yaml", "buf.gen.yaml", "buf.lock",
  // container
  "compose.override.yaml", "compose.override.yml", "Containerfile",
  ".containerignore", "Earthfile", "dagger.json", "buildkitd.toml",
  "docker-bake.hcl", "docker-bake.json",
  // K8s
  "kustomization.yaml", "kustomization.yml", "Chart.yaml", "Chart.lock",
  "values.yaml", "values.schema.json", "helmfile.yaml", "skaffold.yaml",
  "Tiltfile", "tilt_config.json",
  // edge platforms
  "wrangler.toml", "wrangler.jsonc", "wrangler.json", "_routes.json",
  "railway.toml", "railway.json", "koyeb.yaml", "cog.yaml", "replit.nix",
  ".replit", ".gitpod.yml", ".gitpod.Dockerfile", ".devcontainer.json",
  ".devcontainer/devcontainer.json", "codesandbox.json",
  // AI-agent configs
  ".aider.conf.yml", "aider.conf.yml", ".aiignore", ".cursorrules",
  ".cursorignore", ".continuerules", ".continue/config.json", ".mcp.json",
  "mcp.json", ".claude/settings.json", ".claude/settings.local.json",
  ".goose/config.yaml", ".opencode/config", "agent.md", "AGENTS.md",
  "copilot-instructions.md", ".github/copilot-instructions.md",
];

describe("capability-a v5.0.0-alpha.4 · version + registry growth", () => {
  it("VOCABULARY_VERSION is v5.0.0-alpha.4 or later alpha", () => {
    expect(VOCABULARY_VERSION.startsWith("v5.0.0-alpha.")).toBe(true);
  });
});

describe("capability-a v5.0.0-alpha.4 · every new tool present in TOOL_LEXEMES", () => {
  for (const lex of NEW_TOOLS_ALPHA4) {
    it(`TOOL_LEXEMES has \`${lex}\` = tool`, () => {
      expect(TOOL_LEXEMES.get(lex)).toBe("tool");
    });
  }
});

describe("capability-a v5.0.0-alpha.4 · every new config file present in WELL_KNOWN_CONFIG_FILES", () => {
  for (const fname of NEW_CONFIG_FILES_ALPHA4) {
    it(`WELL_KNOWN_CONFIG_FILES has \`${fname}\``, () => {
      expect(WELL_KNOWN_CONFIG_FILES.has(fname)).toBe(true);
    });
  }
});

describe("capability-a v5.0.0-alpha.4 · classifier extracts new tools + concepts", () => {
  it("alt-VCS tools extracted", () => {
    const r = classified(
      classifyFounderIntent("investigate whether jj or sapling is easier to teach than fossil"),
    );
    const cats = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(cats).toContain("jj:tool");
    expect(cats).toContain("sapling:tool");
    expect(cats).toContain("fossil:tool");
  });

  it("version managers extracted", () => {
    const r = classified(
      classifyFounderIntent("investigate switching from nvm to fnm plus adding rustup and pyenv"),
    );
    const cats = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(cats).toContain("fnm:tool");
    expect(cats).toContain("rustup:tool");
    expect(cats).toContain("pyenv:tool");
  });

  it("newer build tools extracted", () => {
    const r = classified(
      classifyFounderIntent("investigate dagger and earthly for hermetic container builds versus buck"),
    );
    const cats = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(cats).toContain("dagger:tool");
    expect(cats).toContain("earthly:tool");
    expect(cats).toContain("buck:tool");
  });

  it("K8s tools extracted", () => {
    const r = classified(
      classifyFounderIntent("investigate kyverno and gatekeeper policies plus kustomize overlays"),
    );
    const cats = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(cats).toContain("kyverno:tool");
    expect(cats).toContain("gatekeeper:tool");
    expect(cats).toContain("kustomize:tool");
  });
});
