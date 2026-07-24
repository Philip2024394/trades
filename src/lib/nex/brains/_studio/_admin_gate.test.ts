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

const FIXTURE_SLUG = "fixture_admin_gate";

async function cleanFixture() {
  await fs.rm(path.join(process.cwd(), ".author-studio-drafts", FIXTURE_SLUG), { recursive: true, force: true });
}

const header = () => ({ version: "0.1.0", authored_by: "author-1", authored_at: new Date().toISOString(), regions: [] as string[] });

beforeEach(cleanFixture);
afterEach(cleanFixture);

async function seedFullDraft() {
  const { writeDraft } = await import("./_draft_store");
  await writeDraft({
    brain_slug: FIXTURE_SLUG, module: "manifest", author_id: "author-1", version: "0.1.0",
    payload: {
      slug: FIXTURE_SLUG, name: "Fixture", category: "trade", version: "0.1.0", status: "published",
      primary_author_id: "author-1", primary_author_name: "T", primary_author_creds: "T",
      supported_countries: ["UK"], supported_regions: null,
      published_at: null, last_reviewed_at: null, v1_modules_present: []
    }
  });
  const modules: Array<[string, Record<string, unknown>]> = [
    ["craft",         { header: header(), facts: [], techniques: [], glossary: [] }],
    ["regulations",   { header: header(), regulations: [], rules: [] }],
    ["materials",     { header: header(), materials: [] }],
    ["workflow",      { header: header(), playbooks: [] }],
    ["defects",       { header: header(), defects: [] }],
    ["pricing_model", { header: header(), rules: [] }]
  ];
  for (const [name, payload] of modules) {
    await writeDraft({ brain_slug: FIXTURE_SLUG, module: name, author_id: "author-1", version: "0.1.0", payload });
  }
}

async function seedCandidates(candidates: Array<{ id: string; status: "accepted" | "edited"; admin_status: "unreviewed" | "approved" | "rejected" | "changes_requested" | "sent_back" | "merged" }>) {
  const { saveRun } = await import("./_extraction/_queue");
  const now = new Date().toISOString();
  await saveRun({
    run_id: "run1",
    brain_slug: FIXTURE_SLUG,
    author_id: "author-1",
    input_hash: "hh",
    input_length: 1,
    llm_model: "test",
    created_at: now,
    candidates: candidates.map((c) => ({
      id: c.id, brain_slug: FIXTURE_SLUG, kind: "craft.fact",
      payload: {},
      source_span: "s",
      needs_author_source: false,
      provenance: { llm_model: "test", proposed_at: now, prompt_version: "v", input_hash: "h" },
      status: c.status,
      admin_status: c.admin_status,
      review_history: []
    }))
  });
}

describe("exportPackFromDrafts · admin gate", () => {
  it("draft mode always exports (no gate)", async () => {
    await seedFullDraft();
    await seedCandidates([{ id: "c1", status: "accepted", admin_status: "unreviewed" }]);
    const { exportPackFromDrafts } = await import("./_pack_exporter");
    const result = await exportPackFromDrafts(FIXTURE_SLUG, "draft");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.mode).toBe("draft");
    expect(result.admin_gate_pending?.length).toBe(1);
  });

  it("published mode blocks when any Author-accepted candidate is unreviewed", async () => {
    await seedFullDraft();
    await seedCandidates([
      { id: "c1", status: "accepted", admin_status: "unreviewed" },
      { id: "c2", status: "accepted", admin_status: "approved" }
    ]);
    const { exportPackFromDrafts } = await import("./_pack_exporter");
    const result = await exportPackFromDrafts(FIXTURE_SLUG, "published");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("admin_gate_blocked");
    expect(result.pending?.length).toBe(1);
  });

  it("published mode blocks when a candidate has changes_requested status", async () => {
    await seedFullDraft();
    await seedCandidates([{ id: "c1", status: "accepted", admin_status: "changes_requested" }]);
    const { exportPackFromDrafts } = await import("./_pack_exporter");
    const result = await exportPackFromDrafts(FIXTURE_SLUG, "published");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("admin_gate_blocked");
  });

  it("published mode passes when every Author-accepted candidate is terminal (approved / rejected / merged)", async () => {
    await seedFullDraft();
    await seedCandidates([
      { id: "c1", status: "accepted", admin_status: "approved" },
      { id: "c2", status: "accepted", admin_status: "rejected" },
      { id: "c3", status: "accepted", admin_status: "merged" }
    ]);
    const { exportPackFromDrafts } = await import("./_pack_exporter");
    const result = await exportPackFromDrafts(FIXTURE_SLUG, "published");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.mode).toBe("published");
  });

  it("published mode passes when there are no candidates at all (Author authored directly)", async () => {
    await seedFullDraft();
    const { exportPackFromDrafts } = await import("./_pack_exporter");
    const result = await exportPackFromDrafts(FIXTURE_SLUG, "published");
    expect(result.ok).toBe(true);
  });
});
