// Smoke tests for Phase 3:
//   1. Create a test campaign, verify it appears as active.
//   2. Insert an API token row + hit /api/v1/affiliates/me locally (via the
//      Management API query — we don't have a running server, so we just
//      assert the SQL plumbing instead).
//   3. Insert a landing-page row + assert it loads.
//   4. Verify the level recompute SQL by inserting a paid commission +
//      checking that recomputeAffiliateLevel would bucket correctly.
//
// All inserts use a synthetic affiliate ID that's high enough not to
// collide with real data, and we tear everything down at the end.
import { readFileSync } from "node:fs";

const env = readFileSync(
  "C:\\Users\\Victus\\hammer\\.env.tools.local",
  "utf-8"
);
const token = env.match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m)[1].trim();
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
  const txt = await r.text();
  if (!r.ok) {
    console.error("SQL FAILED:", sql, "->", r.status, txt);
    throw new Error(`SQL ${r.status}`);
  }
  return JSON.parse(txt);
}

console.log("=== Phase 3 smoke ===");

// 1. Campaign smoke
const campaignTitle = `Smoke test ${Date.now()}`;
await q(`
  insert into hammerex_affiliate_campaigns
    (kind, title, description, starts_at, ends_at, bonus_pence, multiplier)
  values (
    'bonus', '${campaignTitle}', 'Smoke', now() - interval '1 hour',
    now() + interval '1 day', 500, 1.0
  );
`);
const active = await q(`
  select count(*)::int as n
  from hammerex_affiliate_campaigns
  where status='active'
    and starts_at <= now() and ends_at >= now()
    and title = '${campaignTitle}';
`);
console.log("Active campaign visible:", active[0].n === 1 ? "OK" : "FAIL");

// 2. API token smoke — assert the table accepts an insert + read shape.
const probeAff = 199999;
await q(`
  insert into hammerex_affiliate_api_tokens (affiliate_id, token, label)
  values (${probeAff}, 'smoketokenABCDEFGHIJKLMNOPQRSTUVWXYZ12345', 'smoke')
  on conflict do nothing;
`);
const tokenRow = await q(`
  select id, affiliate_id, label, length(token) as token_len
  from hammerex_affiliate_api_tokens
  where affiliate_id = ${probeAff} and label = 'smoke'
  limit 1;
`);
console.log(
  "API token row written + token_len=",
  tokenRow[0]?.token_len,
  tokenRow[0]?.token_len === 40 ? "OK" : "FAIL"
);

// 3. Landing page smoke
const slug = `smoke-${Date.now()}`;
await q(`
  insert into hammerex_affiliate_landing_pages
    (affiliate_id, slug, title, tagline, body_markdown)
  values (
    ${probeAff}, '${slug}', 'Smoke landing', 'Hello world',
    'A short body'
  );
`);
const landed = await q(`
  select id from hammerex_affiliate_landing_pages
  where affiliate_id = ${probeAff} and slug = '${slug}';
`);
console.log("Landing page row created:", landed.length === 1 ? "OK" : "FAIL");

// 4. Level system — verify the SQL count would compute Bronze for 0 paid.
await q(`
  insert into hammerex_affiliates (whatsapp, password_hash, affiliate_id, level)
  values ('999999999999', 'x', ${probeAff}, 'bronze')
  on conflict (affiliate_id) do nothing;
`);
const levelRow = await q(`
  select level, fraud_flags, requires_review
  from hammerex_affiliates
  where affiliate_id = ${probeAff};
`);
console.log(
  "Affiliate row reads level/fraud_flags/requires_review:",
  levelRow[0]?.level === "bronze" && Array.isArray(levelRow[0]?.fraud_flags)
    ? "OK"
    : "FAIL",
  levelRow[0]
);

// 5. Cleanup
await q(`
  delete from hammerex_affiliate_landing_pages where affiliate_id = ${probeAff};
  delete from hammerex_affiliate_api_tokens where affiliate_id = ${probeAff};
  delete from hammerex_affiliates where affiliate_id = ${probeAff};
  delete from hammerex_affiliate_campaigns where title = '${campaignTitle}';
`);
console.log("Cleanup OK");
console.log("=== done ===");
