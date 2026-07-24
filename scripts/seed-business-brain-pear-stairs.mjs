// One-shot seeder: creates the Pear Stairs test business + brain so
// the admin dashboard has something to Run-sync against.
//
// Safe to re-run — inserts fail with duplicate-domain (23505) which
// is caught and logged as "already seeded".

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const envText = readFileSync("C:\\Users\\Victus\\trades\\.env.local", "utf-8");
function envVar(name) {
  const m = envText.match(new RegExp(`^${name}=(.+)$`, "m"));
  if (!m) throw new Error(`Missing ${name} in .env.local`);
  return m[1].trim().replace(/^["']|["']$/g, "");
}

const sb = createClient(envVar("NEXT_PUBLIC_SUPABASE_URL"), envVar("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false }
});

const { data: existing } = await sb
  .from("business_brain_businesses")
  .select("id, name")
  .eq("primary_domain", "pearstairs.co.uk")
  .maybeSingle();

let businessId;
if (existing) {
  console.log(`Business already seeded: ${existing.name} (${existing.id})`);
  businessId = existing.id;
} else {
  const { data: biz, error } = await sb
    .from("business_brain_businesses")
    .insert({
      name:           "Pear Stairs",
      primary_domain: "pearstairs.co.uk",
      category_slug:  "staircase_maker"
    })
    .select("id")
    .single();
  if (error) { console.error("Business insert failed:", error); process.exit(1); }
  businessId = biz.id;
  console.log(`✓ Business created: ${businessId}`);
}

const { data: existingBrain } = await sb
  .from("business_brains").select("id").eq("business_id", businessId).maybeSingle();
if (existingBrain) {
  console.log(`Brain already exists: ${existingBrain.id}`);
} else {
  const { data: brain, error } = await sb
    .from("business_brains")
    .insert({
      business_id:      businessId,
      status:           "provisioning",
      sync_frequency:   "weekly",
      next_sync_due_at: new Date().toISOString()
    })
    .select("id")
    .single();
  if (error) { console.error("Brain insert failed:", error); process.exit(1); }
  console.log(`✓ Brain created: ${brain.id}`);
}

console.log("\nOpen /admin/business-brains and click Run sync to crawl pearstairs.co.uk.");
