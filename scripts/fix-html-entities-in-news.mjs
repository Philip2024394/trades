// One-shot: strip literal HTML entities from seeded news posts (and the
// listings bio column) so /news/[slug] renders proper Unicode glyphs
// instead of the literal `&ldquo;` text the seed script left behind.
//
// Why the bug exists: the markdown renderer at src/lib/newsMarkdown.ts
// escapeHtml()s the body first, which turns `&` into `&amp;` — so seed
// content that contains `&ldquo;` is double-escaped on render. Fix is to
// rewrite the persisted text once, then keep seed scripts using real
// Unicode characters from now on.

import { readFileSync } from "node:fs";

const envText = readFileSync("C:\\Users\\Victus\\hammer\\.env.tools.local", "utf-8");
const tokenMatch = envText.match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m);
if (!tokenMatch) throw new Error("SUPABASE_ACCESS_TOKEN missing from .env.tools.local");
const token = tokenMatch[1].trim();
const ref = "msdonkkechxzgagyguoe";

async function runQuery(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ query })
  });
  const txt = await r.text();
  if (!r.ok) {
    console.error(`Supabase ${r.status}:`, txt);
    process.exit(1);
  }
  return txt;
}

// Build the chained REPLACE expression in JS so the SQL stays readable
// and we don't fight Postgres single-quote escaping mid-statement.
// Pairs are [literal-entity, replacement-glyph]. Order matters: `&amp;`
// is last so we don't pre-decode `&amp;ldquo;` into `&ldquo;` then strip
// it on the same pass.
const replacements = [
  ["&ldquo;", "“"],   // “
  ["&rdquo;", "”"],   // ”
  ["&lsquo;", "‘"],   // ‘
  ["&rsquo;", "’"],   // ’
  ["&mdash;", "—"],   // —
  ["&ndash;", "–"],   // –
  ["&hellip;", "…"],  // …
  ["&middot;", "·"],  // ·
  ["&amp;", "&"]
];

// Escape single quotes for Postgres literal strings.
const pgLit = (s) => "'" + s.replace(/'/g, "''") + "'";

function chainReplace(col) {
  let expr = col;
  for (const [from, to] of replacements) {
    expr = `REPLACE(${expr}, ${pgLit(from)}, ${pgLit(to)})`;
  }
  return expr;
}

const newsBodyExpr = chainReplace("body_markdown");
const newsExcerptExpr = chainReplace("excerpt");
const listingsBioExpr = chainReplace("bio");

const updateNews = `
  UPDATE hammerex_xrated_news_posts
  SET
    body_markdown = ${newsBodyExpr},
    excerpt = CASE WHEN excerpt IS NULL THEN NULL ELSE ${newsExcerptExpr} END
  WHERE body_markdown ~ '&(ldquo|rdquo|lsquo|rsquo|mdash|ndash|hellip|middot|amp);'
     OR (excerpt IS NOT NULL AND excerpt ~ '&(ldquo|rdquo|lsquo|rsquo|mdash|ndash|hellip|middot|amp);')
  RETURNING id, slug;
`;

const updateListings = `
  UPDATE hammerex_trade_off_listings
  SET bio = ${listingsBioExpr}
  WHERE bio IS NOT NULL
    AND bio ~ '&(ldquo|rdquo|lsquo|rsquo|mdash|ndash|hellip|middot|amp);'
  RETURNING id, slug;
`;

console.log("Fixing entities in hammerex_xrated_news_posts...");
const newsResult = await runQuery(updateNews);
console.log("News posts updated:", newsResult);

console.log("\nFixing entities in hammerex_trade_off_listings.bio...");
const listingsResult = await runQuery(updateListings);
console.log("Listings updated:", listingsResult);

// Confirm zero remaining literal entities.
const verifyNews = `
  SELECT COUNT(*)::int AS remaining
  FROM hammerex_xrated_news_posts
  WHERE body_markdown ~ '&(ldquo|rdquo|lsquo|rsquo|mdash|ndash|hellip|middot|amp);'
     OR (excerpt IS NOT NULL AND excerpt ~ '&(ldquo|rdquo|lsquo|rsquo|mdash|ndash|hellip|middot|amp);');
`;
const verifyListings = `
  SELECT COUNT(*)::int AS remaining
  FROM hammerex_trade_off_listings
  WHERE bio IS NOT NULL AND bio ~ '&(ldquo|rdquo|lsquo|rsquo|mdash|ndash|hellip|middot|amp);';
`;
console.log("\nVerification — news remaining:", await runQuery(verifyNews));
console.log("Verification — listings remaining:", await runQuery(verifyListings));
