import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import path from "node:path";
import { promises as fs } from "node:fs";

vi.mock("server-only", () => ({}));

// Stub supabaseAdmin so any call throws — forces the filesystem
// fallback path in the draft store, which is what we want for tests.
// Stub every chainable method to return the same "table missing" error
// so the draft store falls through to the filesystem fallback we want
// to exercise. Recursive Proxy makes chain length irrelevant.
vi.mock("@/lib/supabaseAdmin", () => {
  const err = { message: "relation does not exist", code: "42P01" };
  const missingResult = { error: err, data: null };
  function makeChain(): unknown {
    return new Proxy(function() { return makeChain(); }, {
      get(_target, prop) {
        if (prop === "then") {
          // Terminal await — behave like a resolved Promise of the error.
          return (onFulfilled: (v: unknown) => unknown) => Promise.resolve(missingResult).then(onFulfilled);
        }
        return () => makeChain();
      },
      apply() { return makeChain(); }
    });
  }
  return {
    supabaseAdmin: {
      from: () => makeChain()
    }
  };
});

const FIXTURE_SLUG = "fixture_studio_brain";
const FALLBACK_ROOT = ".author-studio-drafts";

async function cleanFixture() {
  const dir = path.join(process.cwd(), FALLBACK_ROOT, FIXTURE_SLUG);
  await fs.rm(dir, { recursive: true, force: true });
}

beforeEach(cleanFixture);
afterEach(cleanFixture);

async function importStudio() {
  return import("./_pack_exporter");
}
async function importDraftStore() {
  return import("./_draft_store");
}

describe("Studio pack exporter", () => {
  it("reports missing_manifest when only some modules drafted", async () => {
    const { writeDraft } = await importDraftStore();
    await writeDraft({
      brain_slug: FIXTURE_SLUG,
      module: "craft",
      author_id: "author-1",
      version: "0.1.0",
      payload: {
        header: { version: "0.1.0", authored_by: "author-1", authored_at: new Date().toISOString(), regions: [] },
        facts: [], techniques: [], glossary: []
      }
    });
    const { exportPackFromDrafts } = await importStudio();
    const result = await exportPackFromDrafts(FIXTURE_SLUG);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("missing_manifest");
  });

  it("reports missing_module listing every unmet V1 module", async () => {
    const { writeDraft } = await importDraftStore();
    // Only manifest + craft — everything else missing.
    await writeDraft({
      brain_slug: FIXTURE_SLUG,
      module: "manifest",
      author_id: "author-1",
      version: "0.1.0",
      payload: {
        slug: FIXTURE_SLUG, name: "Fixture", category: "trade", version: "0.1.0", status: "draft",
        primary_author_id: "author-1", primary_author_name: "T", primary_author_creds: "T",
        supported_countries: ["UK"], supported_regions: null,
        published_at: null, last_reviewed_at: null, v1_modules_present: []
      }
    });
    await writeDraft({
      brain_slug: FIXTURE_SLUG,
      module: "craft",
      author_id: "author-1",
      version: "0.1.0",
      payload: {
        header: { version: "0.1.0", authored_by: "author-1", authored_at: new Date().toISOString(), regions: [] },
        facts: [], techniques: [], glossary: []
      }
    });
    const { exportPackFromDrafts } = await importStudio();
    const result = await exportPackFromDrafts(FIXTURE_SLUG);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("missing_module");
    expect(result.missing).toContain("regulations");
  });

  it("round-trips a fully drafted pack through the loader", async () => {
    const { writeDraft } = await importDraftStore();
    const header = { version: "0.1.0", authored_by: "author-1", authored_at: new Date().toISOString(), regions: [] as string[] };

    await writeDraft({
      brain_slug: FIXTURE_SLUG, module: "manifest", author_id: "author-1", version: "0.1.0",
      payload: {
        slug: FIXTURE_SLUG, name: "Fixture", category: "trade", version: "0.1.0", status: "published",
        primary_author_id: "author-1", primary_author_name: "T", primary_author_creds: "T",
        supported_countries: ["UK"], supported_regions: null,
        published_at: null, last_reviewed_at: null, v1_modules_present: []
      }
    });
    await writeDraft({ brain_slug: FIXTURE_SLUG, module: "craft",         author_id: "author-1", version: "0.1.0", payload: { header, facts: [], techniques: [], glossary: [] } });
    await writeDraft({ brain_slug: FIXTURE_SLUG, module: "regulations",   author_id: "author-1", version: "0.1.0", payload: { header, regulations: [], rules: [] } });
    await writeDraft({ brain_slug: FIXTURE_SLUG, module: "materials",     author_id: "author-1", version: "0.1.0", payload: { header, materials: [] } });
    await writeDraft({ brain_slug: FIXTURE_SLUG, module: "workflow",      author_id: "author-1", version: "0.1.0", payload: { header, playbooks: [] } });
    await writeDraft({ brain_slug: FIXTURE_SLUG, module: "defects",       author_id: "author-1", version: "0.1.0", payload: { header, defects: [] } });
    await writeDraft({ brain_slug: FIXTURE_SLUG, module: "pricing_model", author_id: "author-1", version: "0.1.0", payload: { header, rules: [] } });

    const { exportPackFromDrafts } = await importStudio();
    const result = await exportPackFromDrafts(FIXTURE_SLUG);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.loaded.manifest.slug).toBe(FIXTURE_SLUG);
  });
});
