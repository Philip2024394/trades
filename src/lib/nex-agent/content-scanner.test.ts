// src/lib/nex-agent/content-scanner.test.ts

import { describe, it, expect } from "vitest";
import { scanFile, scanText } from "./content-scanner";

describe("scanText · secret detection", () => {
  it("catches AWS access key", () => {
    const r = scanText({ text: "const key = 'AKIAIOSFODNN7EXAMPLE';", filename: "cfg.ts" });
    expect(r.verdict).toBe("RED");
    expect(r.findings.some((f) => f.detail.includes("AWS access key"))).toBe(true);
  });

  it("catches OpenAI key", () => {
    const r = scanText({ text: "OPENAI_KEY=sk-abcdefghijklmnopqrstuvwxyz1234" });
    expect(r.findings.some((f) => f.detail.includes("OpenAI"))).toBe(true);
    expect(r.verdict).toBe("RED");
  });

  it("catches Anthropic key", () => {
    const r = scanText({ text: "ANTHROPIC_KEY=sk-ant-api03-abcdefghijklmnop1234567890abcdefghijklmno" });
    expect(r.findings.some((f) => f.detail.includes("Anthropic"))).toBe(true);
  });

  it("catches GitHub PAT", () => {
    const r = scanText({ text: "TOKEN=ghp_abcdefghijklmnopqrstuvwxyz1234567890abcd" });
    expect(r.findings.some((f) => f.detail.includes("GitHub PAT"))).toBe(true);
  });

  it("catches PEM private key", () => {
    const r = scanText({ text: "-----BEGIN RSA PRIVATE KEY-----\nMIIE...\n-----END RSA PRIVATE KEY-----" });
    expect(r.findings.some((f) => f.detail.includes("PEM"))).toBe(true);
  });

  it("clean code returns GREEN", () => {
    const r = scanText({ text: "export function add(a: number, b: number) { return a + b; }" });
    expect(r.verdict).toBe("GREEN");
    expect(r.findings.length).toBe(0);
  });
});

describe("scanText · bug detection", () => {
  it("flags eval usage", () => {
    const r = scanText({ text: "const x = eval(userInput);" });
    expect(r.findings.some((f) => f.code === "sec.bug_eval_use")).toBe(true);
    expect(r.verdict).toBe("RED"); // eval is critical
  });

  it("flags innerHTML unescaped", () => {
    const r = scanText({ text: "el.innerHTML = data;" });
    expect(r.findings.some((f) => f.code === "sec.bug_xss_unescaped")).toBe(true);
  });

  it("flags path traversal literal", () => {
    const r = scanText({ text: 'fs.readFile("../../etc/passwd")' });
    expect(r.findings.some((f) => f.code === "sec.bug_path_traversal")).toBe(true);
  });

  it("flags weak crypto", () => {
    const r = scanText({ text: `createHash("md5").update(pwd)` });
    expect(r.findings.some((f) => f.code === "sec.bug_weak_crypto")).toBe(true);
  });

  it("flags prototype pollution paths", () => {
    const r = scanText({ text: `obj["__proto__"] = data;` });
    expect(r.findings.some((f) => f.code === "sec.bug_prototype_pollution")).toBe(true);
  });
});

describe("scanText · spam detection", () => {
  it("clean short text is fine", () => {
    const r = scanText({ text: "hello world" });
    expect(r.verdict).toBe("GREEN");
  });

  it("flags spam boilerplate (multi-signal)", () => {
    const r = scanText({
      text: "You have won! Click here to claim your prize · nigerian prince needs your western union transfer".repeat(20),
    });
    expect(r.verdict).toBe("RED");
    expect(r.findings.some((f) => f.code === "sec.spam_boilerplate")).toBe(true);
  });
});

describe("scanFile · malware / polyglot", () => {
  it("detects PE executable magic", () => {
    const buf = Buffer.from([0x4d, 0x5a, 0x90, 0x00]);
    const r = scanFile({ buffer: buf, filename: "innocent.txt", mimeType: "text/plain" });
    expect(r.verdict).toBe("RED");
    expect(r.findings.some((f) => f.code === "sec.file_hash_malicious")).toBe(true);
  });

  it("detects ELF executable magic", () => {
    const buf = Buffer.from([0x7f, 0x45, 0x4c, 0x46]);
    const r = scanFile({ buffer: buf, filename: "hello", mimeType: "application/octet-stream" });
    expect(r.findings.some((f) => f.code === "sec.file_hash_malicious")).toBe(true);
  });

  it("accepts plain PNG", () => {
    const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    const r = scanFile({ buffer: buf, filename: "logo.png", mimeType: "image/png" });
    expect(r.verdict).toBe("GREEN");
  });

  it("detects polyglot · PNG with script tag", () => {
    // PNG header + script tag as text after
    const header = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    const script = Buffer.from("<script>alert(1)</script>", "utf8");
    const buf = Buffer.concat([header, script]);
    const r = scanFile({ buffer: buf, filename: "attack.png", mimeType: "image/png" });
    expect(r.findings.some((f) => f.code === "sec.polyglot_file")).toBe(true);
  });

  it("scans text file for secrets", () => {
    const buf = Buffer.from("const openai = 'sk-abcdefghij1234567890abcdef1234567890';", "utf8");
    const r = scanFile({ buffer: buf, filename: "leak.ts", mimeType: "text/plain" });
    expect(r.verdict).toBe("RED");
  });
});

describe("scoring · thresholds", () => {
  it("GREEN when no findings", () => {
    const r = scanText({ text: "clean code" });
    expect(r.score).toBe(100);
  });

  it("RED when any critical", () => {
    const r = scanText({ text: "eval(x)" });
    expect(r.verdict).toBe("RED");
    expect(r.score).toBeLessThan(100);
  });

  it("AMBER with warns · no criticals", () => {
    const r = scanText({ text: `el.innerHTML = data; const x = ../../foo;` });
    expect(r.verdict).toBe("AMBER");
    expect(r.score).toBeLessThan(100);
    expect(r.score).toBeGreaterThan(0);
  });
});
