import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
const envText = readFileSync("C:\\Users\\Victus\\trades\\.env.local", "utf-8");
function e(name) { return envText.match(new RegExp(`^${name}=(.+)$`, "m"))[1].trim().replace(/^["']|["']$/g, ""); }
const sb = createClient(e("NEXT_PUBLIC_SUPABASE_URL"), e("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });

const { data: pearStairs } = await sb.from("business_brain_businesses")
  .select("id").eq("primary_domain", "pearstairs.co.uk").maybeSingle();
if (pearStairs) {
  await sb.from("business_brain_businesses").delete().eq("id", pearStairs.id);
  console.log("✓ Removed Pear Stairs (blocked by Cloudflare)");
}

const { data: existing } = await sb.from("business_brain_businesses")
  .select("id").eq("primary_domain", "stairplan.com").maybeSingle();
if (existing) {
  console.log("Stairplan already exists:", existing.id);
} else {
  const { data: biz } = await sb.from("business_brain_businesses").insert({
    name: "Stairplan", primary_domain: "stairplan.com", category_slug: "staircase_maker"
  }).select("id").single();
  await sb.from("business_brains").insert({
    business_id: biz.id, status: "provisioning", sync_frequency: "weekly",
    crawl_root_url: "https://www.stairplan.com/",
    next_sync_due_at: new Date().toISOString()
  });
  console.log("✓ Created Stairplan test business:", biz.id);
}
