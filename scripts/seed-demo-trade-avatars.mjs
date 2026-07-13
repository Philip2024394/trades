// Assign real construction-persona avatars to every demo-* trade in
// hammerex_trade_off_listings. Uses ImageKit transforms (?tr=…) to
// server-side face-crop each hero-library image to a 256x256 square
// so `object-contain` in the browser Avatar component still respects
// the global "no client-side crop" rule.
//
// Safe to re-run: unconditional overwrite of avatar_url on demo-*
// slugs only. Never touches real signups.

import { readFileSync } from "node:fs";
const envText = readFileSync(
  "C:\\Users\\Victus\\hammer\\.env.tools.local",
  "utf-8"
);
const token = envText.match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m)[1].trim();
const ref = "msdonkkechxzgagyguoe";

async function sql(q) {
  const r = await fetch(
    `https://api.supabase.com/v1/projects/${ref}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ query: q })
    }
  );
  const txt = await r.text();
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${txt}`);
  return JSON.parse(txt);
}

// Face-crop transform: 256x256 square, ImageKit face-detection focus,
// c-maintain_ratio keeps proportion where possible + face fills the
// frame. Same image can be served at multiple sizes just by URL.
function avatarize(url) {
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}tr=w-256,h-256,fo-face,c-maintain_ratio`;
}

// Base hero-library persona URLs from scripts/hero-library.json.
// Grouped by primary_trade slug so a matching listing gets a matching
// portrait. A listing with no match rotates through the FALLBACK pool.
const PORTRAITS = {
  electrician: [
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%205,%202026,%2001_26_18%20AM.png",
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%205,%202026,%2001_23_54%20AM.png"
  ],
  carpenter: [
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%203,%202026,%2008_40_16%20AM.png",
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%203,%202026,%2009_12_44%20AM.png",
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%205,%202026,%2001_09_30%20AM.png"
  ],
  joiner: [
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%205,%202026,%2012_06_42%20AM.png",
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%205,%202026,%2012_01_55%20AM.png"
  ],
  plasterer: [
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%206,%202026,%2002_18_53%20AM.png",
    "https://ik.imagekit.io/9mrgsv2rp/Jul%206,%202026,%2001_47_47%20AM.png",
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%206,%202026,%2001_46_49%20AM.png",
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jun%2030,%202026,%2006_38_39%20PM.png"
  ],
  roofer: [
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%206,%202026,%2001_44_51%20PM.png",
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%205,%202026,%2010_44_14%20PM.png",
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%205,%202026,%2010_41_29%20PM.png"
  ],
  bricklayer: [
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%203,%202026,%2008_40_16%20AM.png"
  ],
  scaffolder: [
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%203,%202026,%2009_07_25%20AM.png"
  ]
};

// Everyone else rotates through this generic construction-persona pool
// so no demo card ever falls back to the coloured-letter avatar.
const FALLBACK = [
  ...PORTRAITS.carpenter,
  ...PORTRAITS.electrician,
  ...PORTRAITS.plasterer,
  ...PORTRAITS.roofer,
  ...PORTRAITS.joiner
];

// ─── Fetch demo trades ────────────────────────────────────────────
const listingsRes = await sql(`
  SELECT id, slug, primary_trade, display_name
    FROM hammerex_trade_off_listings
   WHERE slug LIKE 'demo-%'
   ORDER BY primary_trade, slug
`);
const listings = listingsRes[0]?.rows ?? listingsRes;
console.log(`Loaded ${listings.length} demo trades.`);

// ─── Build updates ────────────────────────────────────────────────
const updates = [];
const fallbackCounter = { i: 0 };
for (const l of listings) {
  const bucket = PORTRAITS[l.primary_trade];
  const pool = bucket && bucket.length > 0 ? bucket : FALLBACK;
  const pick = pool[
    // Stable pick per listing so re-runs don't shuffle the demos.
    // Hash slug into a small integer.
    hash(l.slug) % pool.length
  ];
  updates.push({ id: l.id, avatar: avatarize(pick) });
}
console.log(`Prepared ${updates.length} avatar assignments.`);

function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++)
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// ─── Chunked update ────────────────────────────────────────────────
// Postgres CASE-WHEN across 40 rows is safe in one statement.
const chunks = chunk(updates, 30);
let total = 0;
for (const c of chunks) {
  const cases = c
    .map((u) => `WHEN '${u.id}'::uuid THEN '${u.avatar.replace(/'/g, "''")}'`)
    .join("\n");
  const ids = c.map((u) => `'${u.id}'::uuid`).join(",");
  await sql(`
    UPDATE hammerex_trade_off_listings
       SET avatar_url = CASE id
                          ${cases}
                        END
     WHERE id IN (${ids});
  `);
  total += c.length;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size)
    out.push(arr.slice(i, i + size));
  return out;
}

console.log(`Updated ${total} demo trade avatars.`);
