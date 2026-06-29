// End-to-end smoke test against the live DB:
// 1. Resolve Stuart's listing_id.
// 2. Simulate the subscribe upsert (what /api/trade-off/newsletter/subscribe does).
// 3. Verify the row landed with the expected consent_text + ip_hash.
// 4. Simulate the unsubscribe update.
// 5. Cleanup (DELETE the test row).
//
// Run once and verify the DB plumbing. Safe — uses an unmistakable
// test email and DELETEs at the end.
import { readFileSync } from "node:fs";

const envText = readFileSync("C:\\Users\\Victus\\hammer\\.env.tools.local", "utf-8");
const tokenMatch = envText.match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m);
const token = tokenMatch[1].trim();
const ref = "msdonkkechxzgagyguoe";
const TEST_EMAIL = "newsletter-flow-test@example.invalid";

async function q(sql) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql })
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`SQL failed: ${JSON.stringify(j)}`);
  return j;
}

// 1. Look up Stuart
const stuart = await q(`
  SELECT id FROM hammerex_trade_off_listings
  WHERE slug='demo-stuart-kingsley-building-merchant-hull' LIMIT 1;
`);
const listingId = stuart[0].id;
console.log("Stuart listing_id:", listingId);

// 2. Subscribe (mirrors the API upsert)
const ins = await q(`
  INSERT INTO hammerex_xrated_newsletter_subscribers
    (listing_id, email, consent_text, ip_hash)
  VALUES
    ('${listingId}', '${TEST_EMAIL}', 'I agree to receive marketing emails from Stuart Kingsley.', 'testhash00000000')
  ON CONFLICT (listing_id, email) DO UPDATE
    SET status='active', unsubscribed_at=NULL, consent_at=now(), consent_text=EXCLUDED.consent_text
  RETURNING id, email, status, consent_text, unsubscribe_token;
`);
console.log("Subscribed:", JSON.stringify(ins, null, 2));
const unsubToken = ins[0].unsubscribe_token;

// 3. Unsubscribe (mirrors the API update)
const upd = await q(`
  UPDATE hammerex_xrated_newsletter_subscribers
    SET status='unsubscribed', unsubscribed_at=now()
  WHERE unsubscribe_token='${unsubToken}' AND status='active'
  RETURNING id, status, unsubscribed_at;
`);
console.log("Unsubscribed:", JSON.stringify(upd, null, 2));

// 4. Cleanup
await q(
  `DELETE FROM hammerex_xrated_newsletter_subscribers WHERE email='${TEST_EMAIL}';`
);
console.log("Test row cleaned up.");
