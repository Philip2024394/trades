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

console.log("── Beacon columns on hammerex_trade_off_yard_posts ──");
console.log(
  await q(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'hammerex_trade_off_yard_posts'
      AND column_name LIKE 'beacon%'
    ORDER BY column_name;`)
);

console.log("\n── Responses table ──");
console.log(
  await q(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'hammerex_yard_beacon_responses'
    ORDER BY ordinal_position;`)
);

console.log("\n── Kind check accepts 'beacon' ──");
console.log(
  await q(`
    SELECT pg_get_constraintdef(oid) AS def
    FROM pg_constraint
    WHERE conname = 'hammerex_trade_off_yard_posts_kind_check';`)
);

console.log("\n── Triggers on responses table ──");
console.log(
  await q(`
    SELECT trigger_name, event_manipulation
    FROM information_schema.triggers
    WHERE event_object_table = 'hammerex_yard_beacon_responses'
    ORDER BY trigger_name;`)
);

console.log("\n── Live beacons in feed ──");
console.log(
  await q(`
    SELECT id, kind, beacon_expires_at, beacon_response_count
    FROM hammerex_trade_off_yard_posts
    WHERE kind = 'beacon' AND status = 'live'
    ORDER BY created_at DESC
    LIMIT 5;`)
);
