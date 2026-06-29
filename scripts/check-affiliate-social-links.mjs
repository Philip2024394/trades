// Manual one-shot: walk every affiliate-claimed social link, HEAD-check
// (with GET fallback) and update status/last_checked_at on each row.
// Reads NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from
// .env.local. In production the Vercel Cron route
// /api/cron/social-link-health does the same work on an hourly schedule.
import { readFileSync } from "node:fs";

function envVal(path, key) {
  const txt = readFileSync(path, "utf-8");
  const m = txt.match(new RegExp(`^${key}=(.+)$`, "m"));
  return m ? m[1].trim().replace(/^"|"$/g, "") : null;
}

const envPath = "C:\\Users\\Victus\\trades\\.env.local";
const supabaseUrl = envVal(envPath, "NEXT_PUBLIC_SUPABASE_URL");
const serviceKey = envVal(envPath, "SUPABASE_SERVICE_ROLE_KEY");
if (!supabaseUrl || !serviceKey) {
  console.error("Missing Supabase env vars in .env.local.");
  process.exit(1);
}

const headers = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  "Content-Type": "application/json"
};

const TIMEOUT_MS = 5000;
const UA =
  "Mozilla/5.0 (compatible; XratedTradesHealthBot/1.0; +https://xratedtrade.com/affiliates)";

async function checkUrl(url) {
  try {
    const u = new URL(url);
    if (!["http:", "https:"].includes(u.protocol)) return "broken";
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let res;
    try {
      res = await fetch(url, {
        method: "HEAD",
        redirect: "follow",
        signal: controller.signal,
        headers: { "User-Agent": UA }
      });
    } catch (e) {
      if (e?.name === "AbortError") return "broken";
      try {
        res = await fetch(url, {
          method: "GET",
          redirect: "follow",
          signal: controller.signal,
          headers: { "User-Agent": UA }
        });
      } catch {
        return "broken";
      }
    } finally {
      clearTimeout(timer);
    }
    if (res.status >= 200 && res.status < 400) return "active";
    if (res.status === 404 || res.status === 410) return "removed";
    return "broken";
  } catch {
    return "broken";
  }
}

const list = await fetch(
  `${supabaseUrl}/rest/v1/hammerex_affiliate_social_links?select=id,url&order=last_checked_at.asc.nullsfirst&limit=500`,
  { headers }
);
const links = await list.json();
console.log(`Checking ${links.length} links…`);
let active = 0, broken = 0, removed = 0;
for (const row of links) {
  const status = await checkUrl(row.url);
  if (status === "active") active++;
  else if (status === "removed") removed++;
  else broken++;
  await fetch(
    `${supabaseUrl}/rest/v1/hammerex_affiliate_social_links?id=eq.${row.id}`,
    {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        status,
        last_checked_at: new Date().toISOString()
      })
    }
  );
}
console.log(`Done. active=${active} broken=${broken} removed=${removed}`);
