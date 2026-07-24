// Author Studio draft store — persistence layer for in-progress Brain
// content. Author drafts land here as they type; the pack exporter
// (see _pack_exporter.ts) reads from here when the Author signs off
// on a module.
//
// Storage strategy:
//   • Prefer hammerex_nex_brain_content (per pending migration
//     brain_content_v0.sql) when the table exists.
//   • Fall back to filesystem-backed JSON at
//     `.author-studio-drafts/<brain_slug>/<module>.json` when the
//     migration has not yet been applied.
// This lets the Studio ship BEFORE the migration lands · Author work
// migrates cleanly the moment the table exists.
//
// The store treats the module payload as opaque JSON. The caller (route
// handler) validates against the module Zod schema before writing here
// and before reading is returned to the client.

import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const FALLBACK_ROOT = ".author-studio-drafts";

export type DraftKey = {
  brain_slug: string;
  module:     string;     // "craft" | "regulations" | ... (Zod-validated upstream)
};

export type DraftRecord = {
  brain_slug:    string;
  module:        string;
  author_id:     string;
  version:       string;
  payload:       unknown;
  updated_at:    string;   // ISO
};

// ─── Public API ──────────────────────────────────────────────────

export async function writeDraft(input: {
  brain_slug: string;
  module:     string;
  author_id:  string;
  version:    string;
  payload:    unknown;
}): Promise<DraftRecord> {
  const record: DraftRecord = {
    brain_slug: input.brain_slug,
    module:     input.module,
    author_id:  input.author_id,
    version:    input.version,
    payload:    input.payload,
    updated_at: new Date().toISOString()
  };

  const dbOk = await tryWriteDb(record);
  if (dbOk) return record;

  await writeFileFallback(record);
  return record;
}

export async function readDraft(key: DraftKey): Promise<DraftRecord | null> {
  const fromDb = await tryReadDb(key);
  if (fromDb) return fromDb;
  return readFileFallback(key);
}

export async function listDraftsForBrain(brain_slug: string): Promise<DraftRecord[]> {
  const fromDb = await tryListDb(brain_slug);
  if (fromDb) return fromDb;
  return listFileFallback(brain_slug);
}

// ─── Supabase attempt ────────────────────────────────────────────

async function tryWriteDb(record: DraftRecord): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin
      .from("hammerex_nex_brain_content")
      .upsert({
        brain_slug: record.brain_slug,
        module:     record.module,
        version:    record.version,
        payload:    record.payload,
        author_id:  record.author_id,
        status:     "draft",
        updated_at: record.updated_at
      }, { onConflict: "brain_slug,module,version" });
    if (error) {
      if (isTableMissing(error)) return false;
      // Other errors: log via throw for the caller to notice.
      throw new Error(`draft_write_failed: ${error.message}`);
    }
    return true;
  } catch (err) {
    if (err instanceof Error && err.message.includes("does not exist")) return false;
    throw err;
  }
}

async function tryReadDb(key: DraftKey): Promise<DraftRecord | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from("hammerex_nex_brain_content")
      .select("brain_slug, module, version, payload, author_id, updated_at")
      .eq("brain_slug", key.brain_slug)
      .eq("module", key.module)
      .eq("status", "draft")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      if (isTableMissing(error)) return null;
      return null;
    }
    return data as DraftRecord | null;
  } catch {
    return null;
  }
}

async function tryListDb(brain_slug: string): Promise<DraftRecord[] | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from("hammerex_nex_brain_content")
      .select("brain_slug, module, version, payload, author_id, updated_at")
      .eq("brain_slug", brain_slug)
      .eq("status", "draft")
      .order("module", { ascending: true });
    if (error) {
      if (isTableMissing(error)) return null;
      return null;
    }
    return (data ?? []) as DraftRecord[];
  } catch {
    return null;
  }
}

function isTableMissing(err: { message?: string; code?: string }): boolean {
  const msg = String(err?.message ?? "");
  // Multiple ways Supabase / PostgREST can signal the table doesn't exist:
  //   Postgres SQLSTATE 42P01 (undefined table)
  //   PostgREST wrappings: "Could not find the table 'x' in the schema cache"
  //   Raw pg: "relation ... does not exist"
  return (
    err?.code === "42P01" ||
    err?.code === "PGRST205" ||
    msg.includes("does not exist") ||
    msg.includes("Could not find the table") ||
    msg.includes("in the schema cache")
  );
}

// ─── Filesystem fallback ─────────────────────────────────────────

function fallbackPath(key: DraftKey): string {
  return path.join(process.cwd(), FALLBACK_ROOT, key.brain_slug, `${key.module}.json`);
}

async function writeFileFallback(record: DraftRecord): Promise<void> {
  const p = fallbackPath({ brain_slug: record.brain_slug, module: record.module });
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, JSON.stringify(record, null, 2), "utf8");
}

async function readFileFallback(key: DraftKey): Promise<DraftRecord | null> {
  try {
    const raw = await fs.readFile(fallbackPath(key), "utf8");
    return JSON.parse(raw) as DraftRecord;
  } catch (err: unknown) {
    if ((err as { code?: string })?.code === "ENOENT") return null;
    throw err;
  }
}

async function listFileFallback(brain_slug: string): Promise<DraftRecord[]> {
  const dir = path.join(process.cwd(), FALLBACK_ROOT, brain_slug);
  try {
    const entries = await fs.readdir(dir);
    const out: DraftRecord[] = [];
    for (const entry of entries) {
      if (!entry.endsWith(".json")) continue;
      const raw = await fs.readFile(path.join(dir, entry), "utf8");
      out.push(JSON.parse(raw) as DraftRecord);
    }
    return out;
  } catch (err: unknown) {
    if ((err as { code?: string })?.code === "ENOENT") return [];
    throw err;
  }
}
