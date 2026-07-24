import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import path from "node:path";
import { promises as fs } from "node:fs";

vi.mock("server-only", () => ({}));

// Force draft store to filesystem fallback.
vi.mock("@/lib/supabaseAdmin", () => {
  const err = { message: "relation does not exist", code: "42P01" };
  const missingResult = { error: err, data: null };
  function makeChain(): unknown {
    return new Proxy(function() { return makeChain(); }, {
      get(_t, prop) {
        if (prop === "then") return (fn: (v: unknown) => unknown) => Promise.resolve(missingResult).then(fn);
        return () => makeChain();
      },
      apply() { return makeChain(); }
    });
  }
  return { supabaseAdmin: { from: () => makeChain() } };
});

const FIXTURE_SLUG = "fixture_merge_test";

async function cleanFixture() {
  await fs.rm(path.join(process.cwd(), ".author-studio-drafts", FIXTURE_SLUG), { recursive: true, force: true });
}

const header = () => ({ version: "0.1.0", authored_by: "author-1", authored_at: new Date().toISOString(), regions: [] as string[] });

beforeEach(cleanFixture);
afterEach(cleanFixture);

describe("mergeCandidate", () => {
  it("refuses to merge a pending candidate", async () => {
    const { mergeCandidate } = await import("./_merge");
    const result = await mergeCandidate({
      brain_slug: FIXTURE_SLUG,
      author_id: "author-1",
      candidate: {
        id: "c1", brain_slug: FIXTURE_SLUG, kind: "craft.fact",
        payload: { id: "f1", statement: "test1", evidence: [{ source: "src" }], confidence: "medium" },
        source_span: "s", needs_author_source: false,
        provenance: { llm_model: "m", proposed_at: "t", prompt_version: "v", input_hash: "h" },
        status: "pending",
        admin_status: "unreviewed",
        review_history: []
      }
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("invalid_payload");
  });

  it("auto-scaffolds an empty module when no draft exists yet (first Accept in a fresh Brain)", async () => {
    const { readDraft } = await import("../_draft_store");
    const { mergeCandidate } = await import("./_merge");
    const result = await mergeCandidate({
      brain_slug: FIXTURE_SLUG,
      author_id: "author-1",
      candidate: {
        id: "c1", brain_slug: FIXTURE_SLUG, kind: "craft.fact",
        payload: { id: "f1", statement: "test1", evidence: [{ source: "src" }], confidence: "medium" },
        source_span: "s", needs_author_source: false,
        provenance: { llm_model: "m", proposed_at: "t", prompt_version: "v", input_hash: "h" },
        status: "accepted",
        admin_status: "unreviewed",
        review_history: []
      }
    });
    expect(result.ok).toBe(true);
    const draft = await readDraft({ brain_slug: FIXTURE_SLUG, module: "craft" });
    expect((draft?.payload as { facts: unknown[] }).facts).toHaveLength(1);
  });

  it("appends an accepted craft.fact into an existing craft draft", async () => {
    const { writeDraft, readDraft } = await import("../_draft_store");
    const { mergeCandidate } = await import("./_merge");

    // Seed the craft draft.
    await writeDraft({
      brain_slug: FIXTURE_SLUG, module: "craft", author_id: "author-1", version: "0.1.0",
      payload: { header: header(), facts: [], techniques: [], glossary: [] }
    });

    const result = await mergeCandidate({
      brain_slug: FIXTURE_SLUG, author_id: "author-1",
      candidate: {
        id: "c1", brain_slug: FIXTURE_SLUG, kind: "craft.fact",
        payload: { id: "f1", statement: "test1 fact", evidence: [{ source: "src" }], confidence: "medium" },
        source_span: "s", needs_author_source: false,
        provenance: { llm_model: "m", proposed_at: "t", prompt_version: "v", input_hash: "h" },
        status: "accepted",
        admin_status: "unreviewed",
        review_history: []
      }
    });
    expect(result.ok).toBe(true);

    const draft = await readDraft({ brain_slug: FIXTURE_SLUG, module: "craft" });
    expect((draft?.payload as { facts: unknown[] }).facts).toHaveLength(1);
  });

  it("rejects merge that produces an invalid module (bad payload shape)", async () => {
    const { writeDraft } = await import("../_draft_store");
    const { mergeCandidate } = await import("./_merge");
    await writeDraft({
      brain_slug: FIXTURE_SLUG, module: "craft", author_id: "author-1", version: "0.1.0",
      payload: { header: header(), facts: [], techniques: [], glossary: [] }
    });
    const result = await mergeCandidate({
      brain_slug: FIXTURE_SLUG, author_id: "author-1",
      candidate: {
        id: "c1", brain_slug: FIXTURE_SLUG, kind: "craft.fact",
        payload: { id: "f1", statement: "", evidence: [], confidence: "medium" }, // empty evidence array
        source_span: "s", needs_author_source: false,
        provenance: { llm_model: "m", proposed_at: "t", prompt_version: "v", input_hash: "h" },
        status: "accepted",
        admin_status: "unreviewed",
        review_history: []
      }
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("invalid_module_after_merge");
  });
});
