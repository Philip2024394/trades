// Seed nex_suppliers from data/nex-suppliers.json (Philip 2026-08-02).
//
// One-time migration · idempotent (upserts by supplier_id). JSON registry
// remains as read-only fallback for one release cycle per Philip's approval.
//
// Run:
//   node scripts/seed-nex-suppliers.mjs
//
// Requires:
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const raw = readFileSync("data/nex-suppliers.json", "utf8");
const registry = JSON.parse(raw);

console.log(`Seeding ${registry.suppliers.length} supplier(s) into nex_suppliers…`);

let inserted = 0, updated = 0, failed = 0;

for (const s of registry.suppliers) {
  const row = {
    supplier_id:     s.supplier_id,
    name:            s.name,
    trade:           Array.isArray(s.trade) ? s.trade : [],
    countries:       Array.isArray(s.countries) ? s.countries : [],
    capabilities:    Array.isArray(s.capabilities) ? s.capabilities : [],
    handoff_message: s.handoff_message ?? null,
    notes:           s.notes ?? null,
    active:          s.active === true,
    verified:        s.verified === true,
    priority:        ["primary","partner","listed"].includes(s.priority) ? s.priority : "listed",
  };

  // Check if row already exists so we can report insert vs update accurately
  const { data: existing } = await supabase
    .from("nex_suppliers")
    .select("supplier_id")
    .eq("supplier_id", row.supplier_id)
    .maybeSingle();

  const { error } = await supabase
    .from("nex_suppliers")
    .upsert(row, { onConflict: "supplier_id" });

  if (error) {
    console.error(`  ✗ ${row.supplier_id} (${row.name}) — ${error.message}`);
    failed++;
    continue;
  }

  if (existing) { console.log(`  ↻ ${row.supplier_id} (${row.name}) — updated`); updated++; }
  else          { console.log(`  ＋ ${row.supplier_id} (${row.name}) — inserted`); inserted++; }
}

console.log(`\nResult: ${inserted} inserted · ${updated} updated · ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
