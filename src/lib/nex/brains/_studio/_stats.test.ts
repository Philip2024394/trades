import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import path from "node:path";
import { promises as fs } from "node:fs";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabaseAdmin", () => {
  const err = { message: "relation does not exist", code: "42P01" };
  const missingResult = { error: err, data: null };
  function makeChain(): unknown {
    return new Proxy(function () { return makeChain(); }, {
      get(_t, prop) {
        if (prop === "then") return (fn: (v: unknown) => unknown) => Promise.resolve(missingResult).then(fn);
        return () => makeChain();
      },
      apply() { return makeChain(); }
    });
  }
  return { supabaseAdmin: { from: () => makeChain() } };
});

const FIXTURE_SLUG = "fixture_stats";
async function clean() {
  await fs.rm(path.join(process.cwd(), ".author-studio-drafts", FIXTURE_SLUG), { recursive: true, force: true });
}
const header = () => ({ version: "0.1.0", authored_by: "author-1", authored_at: new Date().toISOString(), regions: [] as string[] });

beforeEach(clean);
afterEach(clean);

describe("computeBrainStats", () => {
  it("returns zeros for a Brain with no drafts and no runs", async () => {
    const { computeBrainStats } = await import("./_stats");
    const s = await computeBrainStats(FIXTURE_SLUG);
    expect(s.knowledge_nodes).toBe(0);
    expect(s.questions_learned).toBe(0);
    expect(s.confidence_pct).toBeNull();
    expect(s.brain_coverage_pct).toBe(0);
    expect(s.faqs).toBeNull();
    expect(s.knowledge_graph_links).toBeNull();
  });

  it("counts author-accepted candidates as knowledge_nodes and per-kind subcounts", async () => {
    const { saveRun } = await import("./_extraction/_queue");
    const { computeBrainStats } = await import("./_stats");
    const now = new Date().toISOString();
    await saveRun({
      run_id: "r1", brain_slug: FIXTURE_SLUG, author_id: "author-1",
      input_hash: "hh", input_length: 1, llm_model: "m", created_at: now,
      candidates: [
        { id: "c1", brain_slug: FIXTURE_SLUG, kind: "craft.fact", payload: {}, source_span: "s", needs_author_source: false, provenance: { llm_model: "m", proposed_at: now, prompt_version: "v", input_hash: "h" }, status: "accepted", admin_status: "approved",   review_history: [] },
        { id: "c2", brain_slug: FIXTURE_SLUG, kind: "craft.fact", payload: {}, source_span: "s", needs_author_source: false, provenance: { llm_model: "m", proposed_at: now, prompt_version: "v", input_hash: "h" }, status: "accepted", admin_status: "unreviewed", review_history: [] },
        { id: "c3", brain_slug: FIXTURE_SLUG, kind: "defects.defect", payload: {}, source_span: "s", needs_author_source: false, provenance: { llm_model: "m", proposed_at: now, prompt_version: "v", input_hash: "h" }, status: "accepted", admin_status: "rejected", review_history: [] },
        { id: "c4", brain_slug: FIXTURE_SLUG, kind: "craft.fact", payload: {}, source_span: "s", needs_author_source: false, provenance: { llm_model: "m", proposed_at: now, prompt_version: "v", input_hash: "h" }, status: "rejected", admin_status: "unreviewed", review_history: [] },
        { id: "c5", brain_slug: FIXTURE_SLUG, kind: "craft.fact", payload: {}, source_span: "s", needs_author_source: false, provenance: { llm_model: "m", proposed_at: now, prompt_version: "v", input_hash: "h" }, status: "pending",  admin_status: "unreviewed", review_history: [] }
      ]
    });
    const s = await computeBrainStats(FIXTURE_SLUG);
    expect(s.questions_learned).toBe(1);
    expect(s.knowledge_nodes).toBe(3);        // c1 c2 c3 accepted
    expect(s.expert_observations).toBe(2);    // c1 c2 accepted craft.fact
    expect(s.admin_approved_total).toBe(1);
    expect(s.admin_pending_review).toBe(1);
    expect(s.admin_rejected_total).toBe(1);
    expect(s.author_approved_total).toBe(3);
  });

  it("computes vision_rules from defects with vision_hints", async () => {
    const { writeDraft } = await import("./_draft_store");
    await writeDraft({
      brain_slug: FIXTURE_SLUG, module: "defects", author_id: "author-1", version: "0.1.0",
      payload: {
        header: header(),
        defects: [
          { id: "d1", name: "n", symptoms: ["s"], severity: "cosmetic", vision_hints: ["hint"], evidence: [], confidence: "medium" },
          { id: "d2", name: "n", symptoms: ["s"], severity: "cosmetic", vision_hints: [],       evidence: [], confidence: "low" },
          { id: "d3", name: "n", symptoms: ["s"], severity: "cosmetic", vision_hints: ["a","b"], evidence: [], confidence: "high" }
        ]
      }
    });
    const { computeBrainStats } = await import("./_stats");
    const s = await computeBrainStats(FIXTURE_SLUG);
    expect(s.defects_captured).toBe(3);
    expect(s.vision_rules).toBe(2);
  });

  it("computes confidence_pct as weighted average across draft items", async () => {
    const { writeDraft } = await import("./_draft_store");
    await writeDraft({
      brain_slug: FIXTURE_SLUG, module: "craft", author_id: "author-1", version: "0.1.0",
      payload: {
        header: header(),
        facts: [
          { id: "f1", statement: "s", evidence: [{ source: "x" }], confidence: "high" },   // 0.9
          { id: "f2", statement: "s", evidence: [{ source: "x" }], confidence: "medium" }, // 0.7
          { id: "f3", statement: "s", evidence: [{ source: "x" }], confidence: "low" }     // 0.5
        ],
        techniques: [], glossary: []
      }
    });
    const { computeBrainStats } = await import("./_stats");
    const s = await computeBrainStats(FIXTURE_SLUG);
    // avg (0.9 + 0.7 + 0.5) / 3 = 0.7 → 70%
    expect(s.confidence_pct).toBe(70);
  });

  it("computes brain_coverage_pct from manifest v1_modules_present", async () => {
    const { writeDraft } = await import("./_draft_store");
    await writeDraft({
      brain_slug: FIXTURE_SLUG, module: "manifest", author_id: "author-1", version: "0.1.0",
      payload: {
        slug: FIXTURE_SLUG, name: "Fixture", category: "trade", version: "0.1.0", status: "draft",
        primary_author_id: "author-1", primary_author_name: "T", primary_author_creds: "T",
        supported_countries: ["UK"], supported_regions: null,
        published_at: null, last_reviewed_at: null,
        v1_modules_present: ["craft", "regulations", "materials"]  // 3 of 6
      }
    });
    const { computeBrainStats } = await import("./_stats");
    const s = await computeBrainStats(FIXTURE_SLUG);
    expect(s.brain_coverage_pct).toBe(50);
  });
});
