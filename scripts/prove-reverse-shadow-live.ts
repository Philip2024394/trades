// scripts/prove-reverse-shadow-live.ts
//
// A3 · Wave 7 · Live reverse-shadow probe.
//
// Instantiates PostgresBrainStore (primary) + SupabaseStore (mirror)
// directly, wraps in MirrorToSupabaseBrainStore, inserts a probe
// KnowledgeRecord into Postgres, waits for the fire-and-forget mirror
// to complete, then queries Supabase to confirm the row appeared.
// Cleans up both sides on the way out.
//
// This bypasses the NEX_BRAIN_BACKEND/NEX_BRAIN_SHADOW_SUPABASE env
// gates entirely — the wrap is constructed explicitly, so local dev
// state (which reads/writes go where) is not affected.
//
// USAGE
//   npx tsx --env-file=.env.local scripts/prove-reverse-shadow-live.ts
//
// EXIT CODES
//   0 · PASS — mirror row visible in Supabase within 5 s
//   2 · FAIL — mirror row not visible after 5 s
//   1 · runner exception
//
// GUARDRAILS
//   · Probe record has record_id `reverse-shadow-probe-<epochms>` (unique per run)
//   · Cleanup runs even on failure
//   · Never touches any existing rows

import { PostgresBrainStore } from "@/lib/nex/brain/adapters/postgres";
import { SupabaseStore } from "@/lib/nex/brain/adapters/supabase";
import { MirrorToSupabaseBrainStore } from "@/lib/nex/brain/pg-to-supabase-shadow";
import type { KnowledgeRecord } from "@/lib/nex/brain/types";
import { createClient } from "@supabase/supabase-js";
import { Pool } from "pg";

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main(): Promise<void> {
  const now = Date.now();
  const record_id = `reverse-shadow-probe-${now}`;

  const probe: Omit<KnowledgeRecord, "id" | "created_at"> = {
    record_id,
    record_version: "v1",
    status: "DRAFT",
    canonical_owner: "reverse-shadow-probe",
    authored_by: "prove-reverse-shadow-live",
    title: "Reverse-shadow probe",
    category: "diagnostic",
    summary: "Ephemeral probe row · created and deleted by prove-reverse-shadow-live",
    body_markdown: "Do not use. Delete on sight if left behind.",
    primary_audience: "engineer",
  };

  console.log(`probe record_id: ${record_id}`);

  // Direct clients for cleanup + verification (bypass adapters)
  const pgUrl = process.env.NEX_POSTGRES_URL;
  if (!pgUrl) throw new Error("NEX_POSTGRES_URL not set");
  const pool = new Pool({ connectionString: pgUrl, max: 2 });

  const supaUrl = process.env.NEX_SUPABASE_URL
              ?? process.env.NEXT_PUBLIC_NEX_SUPABASE_URL
              ?? process.env.SUPABASE_URL
              ?? "";
  const supaKey = process.env.NEX_SUPABASE_SERVICE_ROLE_KEY
              ?? process.env.SUPABASE_SERVICE_ROLE_KEY
              ?? "";
  if (!supaUrl || !supaKey) throw new Error("Supabase env vars missing");
  const supa = createClient(supaUrl, supaKey, { auth: { persistSession: false } });

  // Instantiate the wrapped store
  const primary = new PostgresBrainStore();
  const mirror = new SupabaseStore();
  const wrapped = new MirrorToSupabaseBrainStore(primary, mirror);

  let pgId: string | null = null;

  try {
    // Insert via the wrap — mirror is fire-and-forget
    const { record, created } = await wrapped.insertRecordIdempotent(probe);
    pgId = record.id;
    console.log(`primary insert · created=${created} · pg id=${pgId}`);

    // Give the fire-and-forget mirror up to 5s to land
    const deadline = Date.now() + 5000;
    let supaRow: { id: string } | null = null;
    while (Date.now() < deadline) {
      const { data, error } = await supa
        .from("knowledge_records")
        .select("id")
        .eq("record_id", record_id)
        .maybeSingle();
      if (error && error.code !== "PGRST116") {
        throw new Error(`supabase query failed: ${error.message}`);
      }
      if (data) { supaRow = data as { id: string }; break; }
      await sleep(200);
    }

    if (!supaRow) {
      console.error("FAIL · mirror row did not appear on Supabase within 5s");
      process.exitCode = 2;
    } else {
      console.log(`mirror confirmed · supabase id=${supaRow.id}`);
      console.log("PASS · reverse-shadow live");
      process.exitCode = 0;
    }
  } finally {
    // Cleanup both sides regardless of pass/fail
    try {
      if (pgId) {
        await pool.query("DELETE FROM nex.knowledge_records WHERE id=$1", [pgId]);
        console.log("cleanup · pg row deleted");
      }
    } catch (e) {
      console.warn(`cleanup pg failed: ${(e as Error).message}`);
    }
    try {
      const { error } = await supa
        .from("knowledge_records")
        .delete()
        .eq("record_id", record_id);
      if (error) console.warn(`cleanup supabase failed: ${error.message}`);
      else console.log("cleanup · supabase row deleted");
    } catch (e) {
      console.warn(`cleanup supabase threw: ${(e as Error).message}`);
    }
    await pool.end();
  }
}

main().catch((e) => {
  const msg = e instanceof Error ? (e.stack ?? e.message) : String(e);
  process.stderr.write(`prove-reverse-shadow-live · runner exception:\n${msg}\n`);
  process.exit(1);
});
