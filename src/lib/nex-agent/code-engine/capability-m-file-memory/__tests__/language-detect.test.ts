// NEX1 · Capability M-1 · language detection tests. Pure function.

import { describe, expect, it } from "vitest";
import { detectLanguage } from "../language-detect";

describe("detectLanguage", () => {
  it("classifies typescript variants", () => {
    expect(detectLanguage("src/lib/foo.ts")).toBe("typescript");
    expect(detectLanguage("src/lib/foo.tsx")).toBe("typescript");
    expect(detectLanguage("src/lib/foo.mts")).toBe("typescript");
    expect(detectLanguage("src/lib/foo.cts")).toBe("typescript");
  });

  it("classifies javascript variants", () => {
    expect(detectLanguage("src/lib/foo.js")).toBe("javascript");
    expect(detectLanguage("src/lib/foo.jsx")).toBe("javascript");
    expect(detectLanguage("src/lib/foo.mjs")).toBe("javascript");
    expect(detectLanguage("src/lib/foo.cjs")).toBe("javascript");
  });

  it("classifies json / yaml / toml", () => {
    expect(detectLanguage("package.json")).toBe("json");
    expect(detectLanguage("biome.jsonc")).toBe("json");
    expect(detectLanguage("compose.yml")).toBe("yaml");
    expect(detectLanguage("compose.yaml")).toBe("yaml");
    expect(detectLanguage("pyproject.toml")).toBe("toml");
  });

  it("classifies well-known basenames", () => {
    expect(detectLanguage("Dockerfile")).toBe("dockerfile");
    expect(detectLanguage("Makefile")).toBe("make");
    expect(detectLanguage("Gemfile")).toBe("ruby");
    expect(detectLanguage("Justfile")).toBe("just");
    expect(detectLanguage("LICENSE")).toBe("text");
  });

  it("case-insensitive", () => {
    expect(detectLanguage("MYFILE.TS")).toBe("typescript");
    expect(detectLanguage("DOCKERFILE")).toBe("dockerfile");
  });

  it("returns 'unknown' for unrecognised extensions", () => {
    expect(detectLanguage("data.xyz")).toBe("unknown");
    expect(detectLanguage("noextension")).toBe("unknown");
    expect(detectLanguage("trailing.")).toBe("unknown");
  });

  it("handles specialty languages", () => {
    expect(detectLanguage("main.rs")).toBe("rust");
    expect(detectLanguage("main.go")).toBe("go");
    expect(detectLanguage("main.py")).toBe("python");
    expect(detectLanguage("contract.sol")).toBe("solidity");
    expect(detectLanguage("compute.wgsl")).toBe("wgsl");
    expect(detectLanguage("flake.nix")).toBe("nix");
    expect(detectLanguage("main.tf")).toBe("hcl");
  });

  it("handles nested paths", () => {
    expect(detectLanguage("src/deep/nested/path/module.ts")).toBe("typescript");
    expect(detectLanguage("src\\deep\\nested\\module.ts")).toBe("typescript");
  });
});
