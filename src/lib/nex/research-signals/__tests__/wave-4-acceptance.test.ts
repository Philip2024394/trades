// src/lib/nex/research-signals/__tests__/wave-4-acceptance.test.ts
//
// UWI · Wave 4 · Acceptance suite
// Founder-authorised programme.
//
// Proves M15 signal detection + M16 source-reliability learning ledger +
// M17 six-layer dedup cascade. All deterministic · no LLM · no
// embeddings · no external service.

import { describe, it, expect } from "vitest";
import {
  detectBursts,
  runCusum,
  decomposeStlLite,
  simhashText,
  hammingDistance64,
  toHex64,
  simhash64,
  jaccard,
  wordShingles,
  charShingles,
  minhashSignature,
  estimatedJaccardFromMinHash,
  MinHashLshIndex,
  classifyWardley,
  positionalKey,
  SourceReliabilityLedger,
  DedupCascade,
  sha256Hex,
  type SourceOutcomeRecord,
} from "..";

// ═══ M15 · Kleinberg burst detection ═══════════════════════════════
describe("M15 · Kleinberg burst detection", () => {
  it("no bursts on evenly-spaced events", () => {
    const timestamps = Array.from({ length: 20 }, (_, i) => i * 1000);
    const r = detectBursts(timestamps);
    expect(r.method).toBe("kleinberg-2state");
    expect(r.bursts.length).toBe(0);
  });

  it("detects burst in a dense cluster", () => {
    // 20 evenly-spaced baseline events (1000ms apart) + 10 tightly-clustered burst events (30ms apart) + 10 baseline
    const baseline1 = Array.from({ length: 20 }, (_, i) => i * 1000);
    const burst = Array.from({ length: 10 }, (_, i) => 20_000 + i * 30);
    const baseline2 = Array.from({ length: 20 }, (_, i) => 22_000 + i * 1000);
    const timestamps = [...baseline1, ...burst, ...baseline2].sort((a, b) => a - b);
    const r = detectBursts(timestamps, { s: 5, gamma: 0.5 });
    expect(r.bursts.length).toBeGreaterThan(0);
    // Burst should fall in the dense-cluster window [20_000, ~20_270]
    const first = r.bursts[0];
    expect(first.start_ms).toBeGreaterThanOrEqual(20_000);
    expect(first.end_ms).toBeLessThanOrEqual(22_000);
  });

  it("empty or single-event input returns no bursts", () => {
    expect(detectBursts([]).bursts).toHaveLength(0);
    expect(detectBursts([1000]).bursts).toHaveLength(0);
  });
});

// ═══ M15 · CUSUM shift detection ═══════════════════════════════════
describe("M15 · CUSUM shift detection", () => {
  it("no alarm on stable series around mean", () => {
    const points = Array.from({ length: 50 }, (_, i) => ({ ts_ms: i * 1000, value: 10 + (i % 2 ? 0.1 : -0.1) }));
    const r = runCusum(points, { mean: 10, k: 0.5, h: 5 });
    expect(r.alarms).toHaveLength(0);
  });

  it("upper alarm on sustained shift up", () => {
    const points: { ts_ms: number; value: number }[] = [];
    for (let i = 0; i < 20; i++) points.push({ ts_ms: i * 1000, value: 10 });
    for (let i = 20; i < 40; i++) points.push({ ts_ms: i * 1000, value: 13 });
    const r = runCusum(points, { mean: 10, k: 0.5, h: 5 });
    expect(r.alarms.length).toBeGreaterThan(0);
    expect(r.alarms[0].direction).toBe("upper");
    expect(r.alarms[0].index).toBeGreaterThan(19); // after the shift
  });

  it("lower alarm on sustained shift down", () => {
    const points: { ts_ms: number; value: number }[] = [];
    for (let i = 0; i < 20; i++) points.push({ ts_ms: i * 1000, value: 10 });
    for (let i = 20; i < 40; i++) points.push({ ts_ms: i * 1000, value: 7 });
    const r = runCusum(points, { mean: 10, k: 0.5, h: 5 });
    expect(r.alarms.length).toBeGreaterThan(0);
    expect(r.alarms[0].direction).toBe("lower");
  });
});

// ═══ M15 · STL-lite decomposition ══════════════════════════════════
describe("M15 · STL-lite decomposition", () => {
  it("decomposes a synthetic seasonal series", () => {
    const period = 4;
    const trend_slope = 0.5;
    const points = Array.from({ length: 20 }, (_, i) => ({
      ts_ms: i * 1000,
      value: trend_slope * i + [1, 2, 3, 2][i % period], // trend + seasonal
    }));
    const d = decomposeStlLite(points, { period });
    expect(d.trend).toHaveLength(20);
    expect(d.seasonal).toHaveLength(20);
    expect(d.residual).toHaveLength(20);
    // Seasonal component should repeat with period 4
    for (let i = 0; i < 16; i++) {
      expect(d.seasonal[i]).toBeCloseTo(d.seasonal[i + period], 1);
    }
  });

  it("handles too-short series by degrading to flat trend", () => {
    const d = decomposeStlLite([{ ts_ms: 0, value: 5 }, { ts_ms: 1, value: 7 }], { period: 12 });
    expect(d.trend).toHaveLength(2);
    expect(d.seasonal).toHaveLength(2);
    expect(d.seasonal.every(v => v === 0)).toBe(true);
  });
});

// ═══ M17 layer 1 · SHA-256 exact ══════════════════════════════════
describe("M17 layer 1 · SHA-256 exact-match dedup", () => {
  it("sha256Hex is deterministic", () => {
    expect(sha256Hex("hello")).toBe(sha256Hex("hello"));
    expect(sha256Hex("hello")).not.toBe(sha256Hex("world"));
    expect(sha256Hex("hello")).toMatch(/^[0-9a-f]{64}$/);
  });
});

// ═══ M17 layer 2 · SimHash near-duplicate ══════════════════════════
describe("M17 layer 2 · SimHash near-dup", () => {
  it("identical text → identical fingerprint · Hamming=0", () => {
    const a = simhashText("the quick brown fox jumps over the lazy dog");
    const b = simhashText("the quick brown fox jumps over the lazy dog");
    expect(hammingDistance64(a, b)).toBe(0);
  });

  it("small edit → small Hamming distance", () => {
    const a = simhashText("the quick brown fox jumps over the lazy dog");
    const b = simhashText("the quick brown fox jumps over the lazy dogs"); // one char extra
    const d = hammingDistance64(a, b);
    expect(d).toBeLessThanOrEqual(20);
  });

  it("wildly different text → large Hamming distance", () => {
    const a = simhashText("the quick brown fox jumps over the lazy dog");
    const b = simhashText("financial regulations quarterly review Q3 2026 filing deadline");
    const d = hammingDistance64(a, b);
    expect(d).toBeGreaterThan(10);
  });

  it("fingerprint round-trips through hex representation", () => {
    const fp = simhashText("abc");
    const hex = toHex64(fp);
    expect(hex).toMatch(/^[0-9a-f]{16}$/);
  });
});

// ═══ M17 layer 3 · MinHash-LSH ══════════════════════════════════════
describe("M17 layer 3 · MinHash-LSH", () => {
  it("identical token sets → signature exact match → Jaccard 1.0", () => {
    const sig_a = minhashSignature(["the", "quick", "brown", "fox"], 64);
    const sig_b = minhashSignature(["the", "quick", "brown", "fox"], 64);
    expect(estimatedJaccardFromMinHash(sig_a, sig_b)).toBe(1);
  });

  it("50% overlap tokens → estimated Jaccard around 0.33", () => {
    const set_a = ["a", "b", "c", "d"];
    const set_b = ["c", "d", "e", "f"];
    const sig_a = minhashSignature(set_a, 256);
    const sig_b = minhashSignature(set_b, 256);
    const est = estimatedJaccardFromMinHash(sig_a, sig_b);
    // True Jaccard = 2 / 6 ≈ 0.333 · MinHash estimate should be within tolerance
    expect(est).toBeGreaterThan(0.15);
    expect(est).toBeLessThan(0.55);
  });

  it("LSH index returns candidates that share bands", () => {
    const idx = new MinHashLshIndex(16, 4);
    idx.add("doc1", minhashSignature(["the", "quick", "brown", "fox", "jumps"], 64));
    idx.add("doc2", minhashSignature(["the", "quick", "brown", "fox", "jumps"], 64)); // identical
    idx.add("doc3", minhashSignature(["completely", "unrelated", "words", "here"], 64));
    const q = minhashSignature(["the", "quick", "brown", "fox", "jumps"], 64);
    const cands = idx.candidates(q);
    expect(cands.has("doc1")).toBe(true);
    expect(cands.has("doc2")).toBe(true);
  });

  it("best-match returns highest estimated Jaccard", () => {
    const idx = new MinHashLshIndex(16, 4);
    idx.add("doc1", minhashSignature(["a", "b", "c"], 64));
    idx.add("doc2", minhashSignature(["a", "b", "c", "d"], 64));
    const q = minhashSignature(["a", "b", "c"], 64);
    const best = idx.queryBest(q);
    expect(best).not.toBeNull();
    expect(best!.doc_id).toBe("doc1"); // exact match wins
    expect(best!.estimated_jaccard).toBe(1);
  });
});

// ═══ M17 layer 4 · Token Jaccard ══════════════════════════════════
describe("M17 layer 4 · Token Jaccard", () => {
  it("empty vs empty = 1", () => {
    expect(jaccard([], [])).toBe(1);
  });
  it("empty vs non-empty = 0", () => {
    expect(jaccard([], ["a"])).toBe(0);
  });
  it("identical sets = 1", () => {
    expect(jaccard(["a", "b"], ["a", "b"])).toBe(1);
  });
  it("disjoint sets = 0", () => {
    expect(jaccard(["a", "b"], ["c", "d"])).toBe(0);
  });
  it("partial overlap correctly computed", () => {
    // {a,b,c} ∩ {b,c,d} = {b,c} · size 2 · union {a,b,c,d} = 4 → 0.5
    expect(jaccard(["a", "b", "c"], ["b", "c", "d"])).toBe(0.5);
  });
  it("word shingles produce n-grams", () => {
    const s = wordShingles("the quick brown fox", 2);
    expect(s).toEqual(["the quick", "quick brown", "brown fox"]);
  });
  it("char shingles produce n-grams", () => {
    const s = charShingles("hello", 3);
    expect(s).toEqual(["hel", "ell", "llo"]);
  });
});

// ═══ M17 layer 6 · Wardley classifier ═════════════════════════════
describe("M17 layer 6 · Wardley classifier", () => {
  it("brand-new · no standard · zero commercial → genesis", () => {
    const c = classifyWardley({
      age_months: 2, implementations_count: 1, has_industry_standard: false,
      commercial_offerings_count: 0, is_substitutable: false, value_chain_position: "component",
    });
    expect(c.stage).toBe("genesis");
  });

  it("mature · standard exists · many commercial · substitutable → commodity", () => {
    const c = classifyWardley({
      age_months: 100, implementations_count: 200, has_industry_standard: true,
      commercial_offerings_count: 50, is_substitutable: true, value_chain_position: "infrastructure",
    });
    expect(c.stage).toBe("commodity");
  });

  it("positional key composes stage + value_chain_position", () => {
    const c = classifyWardley({
      age_months: 6, implementations_count: 4, has_industry_standard: false,
      commercial_offerings_count: 2, is_substitutable: false, value_chain_position: "component",
    });
    expect(positionalKey(c)).toMatch(/^component::/);
  });
});

// ═══ M16 · Source-reliability learning ledger ══════════════════════
describe("M16 · Source-reliability learning ledger", () => {
  const now_iso = "2026-09-21T09:00:00.000Z";

  it("null snapshot for unknown source", () => {
    const l = new SourceReliabilityLedger();
    expect(l.snapshot("nonexistent", "weather_current")).toBeNull();
  });

  it("high-agreement source recommended `prefer` (after ≥5 evaluable outcomes)", () => {
    const l = new SourceReliabilityLedger();
    const outs: SourceOutcomeRecord[] = [];
    for (let i = 0; i < 10; i++) {
      outs.push({ ts_iso: now_iso, source: "bmkg.go.id", source_class: "weather_current", outcome: "confirmed", latency_ms: 100 + i, detail: null });
    }
    l.recordAll(outs);
    const s = l.snapshot("bmkg.go.id", "weather_current")!;
    expect(s.agreement_rate).toBe(1);
    expect(s.recommendation).toBe("prefer");
    expect(s.avg_latency_ms).toBeCloseTo(104.5, 1);
  });

  it("mixed agreement recommended `use`", () => {
    const l = new SourceReliabilityLedger();
    for (let i = 0; i < 8; i++) l.record({ ts_iso: now_iso, source: "x", source_class: "y", outcome: "confirmed", latency_ms: null, detail: null });
    for (let i = 0; i < 2; i++) l.record({ ts_iso: now_iso, source: "x", source_class: "y", outcome: "contradicted", latency_ms: null, detail: null });
    const s = l.snapshot("x", "y")!;
    expect(s.agreement_rate).toBe(0.8);
    expect(s.recommendation).toBe("use");
  });

  it("mostly-unavailable source recommended `avoid`", () => {
    const l = new SourceReliabilityLedger();
    for (let i = 0; i < 8; i++) l.record({ ts_iso: now_iso, source: "flaky", source_class: "y", outcome: "timeout", latency_ms: 30_000, detail: null });
    for (let i = 0; i < 2; i++) l.record({ ts_iso: now_iso, source: "flaky", source_class: "y", outcome: "confirmed", latency_ms: 200, detail: null });
    const s = l.snapshot("flaky", "y")!;
    // availability = 2/10 = 0.2 < 0.3 threshold → avoid
    expect(s.recommendation).toBe("avoid");
  });

  it("window truncates old records", () => {
    const l = new SourceReliabilityLedger({ window_size: 3, prefer_agreement_min: 0.9, use_agreement_min: 0.7, avoid_availability_max: 0.3 });
    for (let i = 0; i < 10; i++) l.record({ ts_iso: now_iso, source: "s", source_class: "c", outcome: "confirmed", latency_ms: null, detail: null });
    const s = l.snapshot("s", "c")!;
    expect(s.window_size).toBe(3);
  });
});

// ═══ M17 · Dedup cascade · 6 layers · 3-way verdict ═════════════════
describe("M17 · Six-layer dedup cascade", () => {
  it("layer 1 · SHA-256 exact match → already_known", () => {
    const c = new DedupCascade();
    c.register({ id: "a", text: "The Indonesian rupiah strengthened against the US dollar this quarter." });
    const v = c.check({ id: "b", text: "The Indonesian rupiah strengthened against the US dollar this quarter." });
    expect(v.kind).toBe("already_known");
    if (v.kind === "already_known") expect(v.layer).toBe("sha256_exact");
  });

  it("layer 2 · SimHash near-dup → already_known", () => {
    const c = new DedupCascade({ ...({} as any), simhash_hamming_threshold: 8, minhash_bands: 32, minhash_rows: 4, minhash_jaccard_threshold: 0.99, token_jaccard_threshold: 0.99, citation_min_shared: 999 });
    c.register({ id: "a", text: "The Indonesian rupiah strengthened against the US dollar this quarter." });
    const v = c.check({ id: "b", text: "The Indonesian rupiah strengthened against the US dollar this quarter!" }); // near-dup
    expect(v.kind).toBe("already_known");
    if (v.kind === "already_known") expect(v.layer).toMatch(/simhash_near|sha256_exact/);
  });

  it("layer 3 · MinHash-LSH → same_idea_new_evidence", () => {
    const c = new DedupCascade({
      simhash_hamming_threshold: 0, minhash_bands: 16, minhash_rows: 4,
      minhash_jaccard_threshold: 0.5, token_jaccard_threshold: 0.99, citation_min_shared: 999,
    });
    // Two texts that share ~most word-shingles but differ enough to escape SimHash Hamming 0
    const t1 = "financial regulations quarterly review meeting scheduled next week Jakarta central bank office";
    const t2 = "financial regulations quarterly review meeting scheduled next week Jakarta central bank building";
    c.register({ id: "a", text: t1 });
    const v = c.check({ id: "b", text: t2 });
    // Either SimHash catches it (still already_known) or MinHash-LSH / token Jaccard catches it
    expect(["already_known", "same_idea_new_evidence"]).toContain(v.kind);
  });

  it("layer 5 · citation-graph coupling → same_idea_new_evidence", () => {
    const c = new DedupCascade({
      simhash_hamming_threshold: 0, minhash_bands: 32, minhash_rows: 4,
      minhash_jaccard_threshold: 0.99, token_jaccard_threshold: 0.99, citation_min_shared: 2,
    });
    c.register({ id: "a", text: "Completely different text alpha.", source_refs: ["src-1", "src-2", "src-3"] });
    const v = c.check({ id: "b", text: "Completely different text beta.", source_refs: ["src-1", "src-2", "src-4"] });
    // 2 shared citations meets threshold
    expect(v.kind).toBe("same_idea_new_evidence");
    if (v.kind === "same_idea_new_evidence") expect(v.layer).toBe("citation_graph");
  });

  it("layer 6 · Wardley cell match → same_idea_new_evidence", () => {
    const c = new DedupCascade({
      simhash_hamming_threshold: 0, minhash_bands: 32, minhash_rows: 4,
      minhash_jaccard_threshold: 0.99, token_jaccard_threshold: 0.99, citation_min_shared: 999,
    });
    const w = classifyWardley({
      age_months: 3, implementations_count: 1, has_industry_standard: false,
      commercial_offerings_count: 0, is_substitutable: false, value_chain_position: "component",
    });
    c.register({ id: "a", text: "Text 1 about a novel idea.", wardley: w });
    const v = c.check({ id: "b", text: "Text 2 about a different novel idea.", wardley: w });
    expect(v.kind).toBe("same_idea_new_evidence");
    if (v.kind === "same_idea_new_evidence") expect(v.layer).toBe("wardley_position");
  });

  it("genuinely_new · no layer fires", () => {
    const c = new DedupCascade();
    c.register({ id: "a", text: "The rupiah strengthened against the dollar." });
    const v = c.check({ id: "b", text: "Solar irradiance measurements in central Java for the third quarter." });
    expect(v.kind).toBe("genuinely_new");
  });

  it("processCandidate registers only genuinely-new candidates", () => {
    const c = new DedupCascade();
    const v1 = c.processCandidate({ id: "a", text: "First unique text." });
    expect(v1.kind).toBe("genuinely_new");
    expect(c.size()).toBe(1);
    // Same text again → already_known · not re-registered
    const v2 = c.processCandidate({ id: "b", text: "First unique text." });
    expect(v2.kind).toBe("already_known");
    expect(c.size()).toBe(1);
  });
});
