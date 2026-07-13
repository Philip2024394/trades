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
console.log("── material_prices table ──");
console.log(
  await q(
    `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='hammerex_material_prices' ORDER BY ordinal_position`
  )
);
console.log("\n── property_id columns ──");
console.log(
  await q(
    `SELECT table_name, column_name FROM information_schema.columns WHERE column_name='property_id' AND table_name IN ('hammerex_trade_off_yard_posts','hammerex_yard_beacon_responses')`
  )
);
console.log("\n── Activity accepts beacon_fired ──");
console.log(
  await q(
    `SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname='os_activity_events_kind_check'`
  )
);
