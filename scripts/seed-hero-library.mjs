// seed-hero-library.mjs — imports scripts/hero-library.json into the
// hero_library Supabase table.
//
// Run with:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-hero-library.mjs
//
// Idempotent — uses upsert on id. Re-run after adding new library
// entries to the JSON file.

import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
});

const libPath = join(__dirname, "hero-library.json");
const raw = await readFile(libPath, "utf8");
const library = JSON.parse(raw);
const entries = library.entries || [];

console.log(`Seeding ${entries.length} hero library entries...`);

// Filter out any $pending_review blocks from an older format
const clean = entries.filter((e) => e.id && e.image_url);

const rows = clean.map((e) => ({
  id: e.id,
  image_url: e.image_url,
  subject: e.subject,
  keywords_strict: e.keywords_strict ?? [],
  excluded_trades: e.excluded_trades ?? [],
  vibe: e.vibe,
  text_zone: e.text_zone ?? {},
  theme_palette: e.theme_palette ?? {},
  aspect_variants: e.aspect_variants ?? {},
  sibling_group_id: e.sibling_group_id ?? null,
  hero_use_case: e.hero_use_case ?? "",
  burned_in_text: e.burned_in_text ?? false,
  worker_visible: e.worker_visible ?? false,
  recommended_use: e.recommended_use ?? "hero",
  notes: e.note ?? e.notes ?? null
}));

// Upsert in batches of 50 to avoid oversized payloads
const BATCH = 50;
let ok = 0;
let failed = 0;
for (let i = 0; i < rows.length; i += BATCH) {
  const batch = rows.slice(i, i + BATCH);
  const { error } = await supabase
    .from("hero_library")
    .upsert(batch, { onConflict: "id" });
  if (error) {
    console.error(`Batch ${i / BATCH + 1} failed:`, error.message);
    failed += batch.length;
  } else {
    ok += batch.length;
    process.stdout.write(`.`);
  }
}
console.log(`\n\nSeeded: ${ok} OK, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
