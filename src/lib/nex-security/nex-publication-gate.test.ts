// NEX Publication Gate · deterministic classification tests (12 focused cases)
// 2026-09-19 · Ledger B additive · Read-only w.r.t. production files
//
// Every test asserts a specific classification behaviour. No secret values
// are ever exercised — only the classification RESULT for path patterns.

import { describe, it, expect } from "vitest";
import { readFileSync, statSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import {
  classifyPath,
  IP_CATEGORIES,
  IP_CLASSIFICATION_RULES,
  NEX_IP_REGISTRY_VERSION,
} from "./nex-ip-registry";
import {
  publicationPreflight,
  checkPath,
  NEX_PUBLICATION_GATE_VERSION,
} from "./nex-publication-gate";

const REPO_ROOT = process.cwd();

describe("NEX Publication Gate · deterministic classification · 12 tests", () => {
  // ── Test 1 · Protected cognitive file → IP_CORE ─────────────────
  it("Test 1 · Protected cognitive file (chat-turn) is classified IP_CORE", () => {
    const r = classifyPath(
      "src/lib/nex-agent/code-engine/capability-chat-turn.ts",
    );
    expect(r.category).toBe("IP_CORE");
    expect(r.risk).toBe("R4");
    expect(r.rule_id).toBe("core-01-chat-turn");
    console.log(`[T1] ${r.rule_id} · ${r.category} · ${r.risk} · ${r.evidence}`);
  });

  // ── Test 2 · Learning/experience implementation → IP_CORE ─────────
  it("Test 2 · Experience/generalisation implementation is classified IP_CORE", () => {
    const r1 = classifyPath(
      "src/lib/nex-agent/code-engine/capability-experience-abstraction.ts",
    );
    const r2 = classifyPath(
      "src/lib/nex-agent/code-engine/capability-experience-retrieval.ts",
    );
    const r3 = classifyPath(
      "src/lib/nex-agent/code-engine/capability-experience-corpus.ts",
    );
    expect(r1.category).toBe("IP_CORE");
    expect(r2.category).toBe("IP_CORE");
    expect(r3.category).toBe("IP_CORE");
    console.log(`[T2] abstraction=${r1.rule_id} retrieval=${r2.rule_id} corpus=${r3.rule_id}`);
  });

  // ── Test 3 · Learned corpus JSONL → IP_DATA ─────────────────────
  it("Test 3 · Learned corpus JSONL is classified IP_DATA", () => {
    const r1 = classifyPath(
      "data/nex1-investigation-conclusions/entries.jsonl",
    );
    const r2 = classifyPath("data/nex-brain/records.json");
    expect(r1.category).toBe("IP_DATA");
    expect(r1.risk).toBe("R4");
    expect(r2.category).toBe("IP_DATA");
    expect(r2.risk).toBe("R4");
    console.log(`[T3] investigation=${r1.rule_id} brain=${r2.rule_id}`);
  });

  // ── Test 4 · Proof methodology test → IP_SUPPORT ───────────────
  it("Test 4 · Intelligence proof test is classified IP_SUPPORT", () => {
    const r1 = classifyPath("src/lib/nex-cap/nex1-generalisation-proof.test.ts");
    const r2 = classifyPath("src/lib/nex-cap/nex1-experience-writer-proof.test.ts");
    const r3 = classifyPath("src/lib/nex-cap/nex1-nex-runs-tests.test.ts");
    expect(r1.category).toBe("IP_SUPPORT");
    expect(r2.category).toBe("IP_SUPPORT");
    expect(r3.category).toBe("IP_SUPPORT");
    console.log(`[T4] gen=${r1.rule_id} writer=${r2.rule_id} nex-runs=${r3.rule_id}`);
  });

  // ── Test 5 · Simulated secret → SECURITY_SECRET ─────────────────
  it("Test 5 · Fake secret path patterns are classified SECURITY_SECRET · no real secret exercised", () => {
    // Fabricated paths for classification purposes only · no file needed
    const cases = [
      ".env.local",
      ".env.production",
      ".nex-secrets/anything.hex",
      "data/founder-key-tmp-fake-1234abcd/founder-priv.hex",
      "data/nex-storage/nex_founder_delegations.jsonl",
      "config/founder-keys.local.json",
      "some/path/id_rsa.pem",
      "another/path/cert.pfx",
    ];
    for (const p of cases) {
      const r = classifyPath(p);
      expect(r.category).toBe("SECURITY_SECRET");
      console.log(`[T5] ${p} → ${r.rule_id} · ${r.category}`);
    }
  });

  // ── Test 6 · Generic public candidate NOT classified IP_CORE ────
  it("Test 6 · Generic non-IP path is not classified IP_CORE", () => {
    const cases = [
      "package.json",
      "tsconfig.json",
      "next.config.mjs",
      "node_modules/react/index.js",
      ".next/build-manifest.json",
    ];
    for (const p of cases) {
      const r = classifyPath(p);
      expect(r.category).toBe("NON_IP");
      expect(r.category).not.toBe("IP_CORE");
    }
    console.log(`[T6] ${cases.length} non-IP paths verified · none matched IP_CORE`);
  });

  // ── Test 7 · Publication gate blocks protected files ──────────
  it("Test 7 · Publication gate blocks IP_CORE / IP_SUPPORT / IP_DATA / SECURITY_SECRET", () => {
    const proposal = [
      "src/lib/nex-agent/code-engine/capability-chat-turn.ts",           // IP_CORE
      "src/lib/nex-cap/nex1-generalisation-proof.test.ts",               // IP_SUPPORT
      "data/nex1-investigation-conclusions/entries.jsonl",               // IP_DATA
      ".env.local",                                                      // SECURITY_SECRET
    ];
    const r = publicationPreflight({ proposed_files: proposal });
    expect(r.blocked_ip_core.length).toBe(1);
    expect(r.blocked_ip_support.length).toBe(1);
    expect(r.blocked_ip_data.length).toBe(1);
    expect(r.blocked_security_secret.length).toBe(1);
    expect(r.approved_for_founder_review.length).toBe(0);
    expect(r.authority_reminder).toBe("FOUNDER_AUTHORITY_REQUIRED_FOR_ANY_RELEASE");
    console.log(
      `[T7] blocked · core=${r.blocked_ip_core.length} · support=${r.blocked_ip_support.length} · data=${r.blocked_ip_data.length} · secret=${r.blocked_security_secret.length}`,
    );
  });

  // ── Test 8 · Safe candidate → FOUNDER_REVIEW ─────────────────
  it("Test 8 · Non-IP path passes preflight as APPROVED_FOR_FOUNDER_REVIEW", () => {
    const proposal = ["package.json", "tsconfig.json"];
    const r = publicationPreflight({ proposed_files: proposal });
    expect(r.approved_for_founder_review.length).toBe(2);
    expect(r.blocked_ip_core.length).toBe(0);
    expect(r.blocked_security_secret.length).toBe(0);
    for (const d of r.decisions) {
      expect(d.verdict).toBe("APPROVED_FOR_FOUNDER_REVIEW");
    }
    console.log(`[T8] ${r.approved_for_founder_review.length} paths approved for founder review`);
  });

  // ── Test 9 · Manifest hash deterministic ─────────────────────
  it("Test 9 · SHA-256 hash of a stable file is byte-identical across two reads", () => {
    // Read a stable frozen file (the abstraction module) twice · hash both
    const target = path.join(
      REPO_ROOT,
      "src/lib/nex-agent/code-engine/capability-experience-abstraction.ts",
    );
    const b1 = readFileSync(target);
    const b2 = readFileSync(target);
    const h1 = createHash("sha256").update(b1).digest("hex");
    const h2 = createHash("sha256").update(b2).digest("hex");
    expect(h1).toBe(h2);
    expect(h1).toHaveLength(64);
    console.log(`[T9] SHA-256(${path.basename(target)}) = ${h1.slice(0, 16)}...`);
  });

  // ── Test 10 · Modifying a temp file changes its recorded hash ──
  it("Test 10 · Recorded hash changes when protected content changes (temp fixture only)", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "nex-ip-hash-"));
    const f = path.join(dir, "protected.txt");
    writeFileSync(f, "content-A");
    const hA = createHash("sha256").update(readFileSync(f)).digest("hex");
    writeFileSync(f, "content-B");
    const hB = createHash("sha256").update(readFileSync(f)).digest("hex");
    expect(hA).not.toBe(hB);
    console.log(`[T10] A=${hA.slice(0, 12)} · B=${hB.slice(0, 12)} · differ=${hA !== hB}`);
  });

  // ── Test 11 · No protected data printed into gate output ─────
  it("Test 11 · publicationPreflight output contains only paths + rule metadata · never file contents", () => {
    const proposal = [
      ".env.local",
      "data/nex1-investigation-conclusions/entries.jsonl",
      "src/lib/nex-agent/code-engine/capability-chat-turn.ts",
    ];
    const r = publicationPreflight({ proposed_files: proposal });
    const serialised = JSON.stringify(r);
    // Absolutely NO file content · verify by absence of common file-content tokens
    expect(serialised).not.toMatch(/BEGIN [A-Z]+ KEY/);
    expect(serialised).not.toMatch(/-----BEGIN/);
    expect(serialised).not.toMatch(/PRIVATE KEY/);
    expect(serialised).not.toMatch(/entry_id/);
    expect(serialised).not.toMatch(/selection_state/);
    expect(serialised).not.toMatch(/import\s+.*from/);
    // Every proposed path IS present (that's the input echo, expected)
    for (const p of proposal) expect(serialised.includes(p)).toBe(true);
    console.log(`[T11] gate output size ${serialised.length} bytes · no content leaked`);
  });

  // ── Test 12 · No LLM dependency introduced by protection code ──
  it("Test 12 · nex-security modules import no LLM / network dependency", () => {
    const regSrc = readFileSync(
      path.join(REPO_ROOT, "src/lib/nex-security/nex-ip-registry.ts"),
      "utf8",
    );
    const gateSrc = readFileSync(
      path.join(REPO_ROOT, "src/lib/nex-security/nex-publication-gate.ts"),
      "utf8",
    );
    const bad = /(anthropic|openai|@anthropic|OpenAI\(|Anthropic\(|@google\/generative-ai|groq|gemini-|claude-\d|node-fetch|axios|got|isomorphic-fetch|https?\/\/api\.)/i;
    // strip comments for a fair check
    const clean = (s: string) =>
      s.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(bad.test(clean(regSrc))).toBe(false);
    expect(bad.test(clean(gateSrc))).toBe(false);
    // Constants sanity
    expect(NEX_IP_REGISTRY_VERSION).toMatch(/^nex-ip-registry\.v1\./);
    expect(NEX_PUBLICATION_GATE_VERSION).toMatch(/^nex-publication-gate\.v1\./);
    console.log(`[T12] zero LLM · zero network · registry=${NEX_IP_REGISTRY_VERSION} · gate=${NEX_PUBLICATION_GATE_VERSION}`);
  });

  // ── SANITY · every category represented in taxonomy ─────────
  it("SANITY · every IpCategory has a descriptor and the rule table is non-empty", () => {
    const seen = new Set(IP_CATEGORIES.map((c) => c.category));
    for (const c of [
      "IP_CORE",
      "IP_SUPPORT",
      "IP_DATA",
      "SECURITY_SECRET",
      "PUBLIC_CANDIDATE",
      "NON_IP",
      "UNKNOWN",
    ]) {
      expect(seen.has(c as any)).toBe(true);
    }
    expect(IP_CLASSIFICATION_RULES.length).toBeGreaterThan(20);
    console.log(`[SANITY] ${IP_CATEGORIES.length} categories · ${IP_CLASSIFICATION_RULES.length} rules`);
  });

  // ── Convenience · single-path checkPath returns matching verdict ─
  it("SANITY · checkPath() returns the same verdict as publicationPreflight()", () => {
    const p = "src/lib/nex-agent/code-engine/capability-candidate-selector.ts";
    const single = checkPath(p);
    const preflight = publicationPreflight({ proposed_files: [p] });
    expect(single.verdict).toBe(preflight.decisions[0].verdict);
    expect(single.classification.category).toBe(
      preflight.decisions[0].classification.category,
    );
    console.log(`[SANITY] checkPath ↔ preflight consistent · ${single.verdict}`);
  });
});
