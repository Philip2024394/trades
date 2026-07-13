import { readFileSync } from "node:fs";
const envText = readFileSync(
  "C:\\Users\\Victus\\hammer\\.env.tools.local",
  "utf-8"
);
const token = envText.match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m)[1].trim();
const ref = "msdonkkechxzgagyguoe";
async function q(sql) {
  const r = await fetch(
    `https://api.supabase.com/v1/projects/${ref}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ query: sql })
    }
  );
  return await r.json();
}

// Test 1: do the "missing" tables actually exist?
const suspect = [
  "installed_apps",
  "installed_packs",
  "app_events",
  "app_crm_contacts",
  "app_crm_tasks",
  "app_job_diary_entries",
  "app_reviews_reviews",
  "app_products_merchant_offers",
  "app_quote_workspace_quotes",
  "studio_saved_buttons",
  "studio_global_buttons",
  "studio_payment_providers",
  "studio_payment_orders",
  "hero_library",
  "os_billing_customers",
  "os_billing_webhook_events",
  "os_project_videos",
  "os_storage_quotas",
  "merchants"
];
console.log("── Table existence check ──");
const r = await q(
  `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN (${suspect.map((t) => `'${t}'`).join(",")}) ORDER BY table_name;`
);
const found = new Set((Array.isArray(r) ? r : []).map((x) => x.table_name));
for (const t of suspect) {
  console.log(`${found.has(t) ? "  EXISTS  " : "  MISSING "} ${t}`);
}

console.log("\n── Any supabase_migrations tracking table? ──");
const mig = await q(
  `SELECT count(*) as n FROM information_schema.tables WHERE table_schema='supabase_migrations' AND table_name='schema_migrations';`
);
console.log(mig);

console.log("\n── Total public tables ──");
const totals = await q(
  `SELECT count(*) as n FROM information_schema.tables WHERE table_schema='public';`
);
console.log(totals);
