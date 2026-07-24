// Backup integrity — SHA-256 helpers.

import { describe, it, expect } from "vitest";
import { sha256Buffer, sha256String, computeIntegrity, verifyIntegrity } from "./integrity";

describe("Backup integrity", () => {
  it("sha256Buffer is deterministic", () => {
    const a = sha256Buffer(Buffer.from("hello"));
    const b = sha256Buffer(Buffer.from("hello"));
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it("sha256Buffer changes when content changes", () => {
    expect(sha256Buffer(Buffer.from("hello"))).not.toBe(sha256Buffer(Buffer.from("hello!")));
  });

  it("sha256String matches Buffer of same UTF-8", () => {
    expect(sha256String("hello")).toBe(sha256Buffer(Buffer.from("hello", "utf-8")));
  });

  it("computeIntegrity produces sha256 + size for every file", () => {
    const files = { "a.json": "{}", "b.json": "[1,2,3]" };
    const out = computeIntegrity(files);
    expect(Object.keys(out).sort()).toEqual(["a.json", "b.json"]);
    expect(out["a.json"].sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(out["a.json"].size_bytes).toBe(2);
    expect(out["b.json"].size_bytes).toBe(7);
  });

  it("verifyIntegrity returns [] when everything matches", () => {
    const files = { "a.json": Buffer.from("{}"), "b.json": Buffer.from("[1,2,3]") };
    const integ = computeIntegrity({ "a.json": "{}", "b.json": "[1,2,3]" });
    expect(verifyIntegrity(files, integ)).toEqual([]);
  });

  it("verifyIntegrity flags corrupted file", () => {
    const integ = computeIntegrity({ "a.json": "{}" });
    const problems = verifyIntegrity({ "a.json": Buffer.from("{tampered}") }, integ);
    expect(problems.length).toBe(1);
    expect(problems[0].file).toBe("a.json");
    expect(problems[0].actual).not.toBe(integ["a.json"].sha256);
  });

  it("verifyIntegrity flags missing file", () => {
    const integ = computeIntegrity({ "a.json": "{}" });
    const problems = verifyIntegrity({}, integ);
    expect(problems.length).toBe(1);
    expect(problems[0].actual).toBe("MISSING");
  });
});
