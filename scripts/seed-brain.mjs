#!/usr/bin/env node
/* eslint-disable no-console */
// Seed a Brain registry row into hammerex_nex_brains.
//
// Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in your env
// (typically loaded from .env.local by whatever wrapper you run this
// through). If the table doesn't exist yet (brain_content_v0.sql
// migration not applied), the script exits cleanly with a clear
// message pointing at the migration.
//
// Usage:
//   node scripts/seed-brain.mjs \
//     --slug staircase \
//     --name "Staircase Brain" \
//     --author phillipofarrell@gmail.com \
//     [--author-name "«Legal Name»"] \
//     [--author-creds "«Certification»"] \
//     [--country UK]

function args() {
  const argv = process.argv.slice(2);
  const out = {
    slug: null,
    name: null,
    author: null,
    authorName: null,
    authorCreds: null,
    country: "UK"
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--slug")         out.slug        = argv[++i];
    else if (a === "--name")    out.name        = argv[++i];
    else if (a === "--author")  out.author      = argv[++i];
    else if (a === "--author-name")  out.authorName  = argv[++i];
    else if (a === "--author-creds") out.authorCreds = argv[++i];
    else if (a === "--country") out.country     = argv[++i];
    else if (a === "--help" || a === "-h") { help(); process.exit(0); }
    else { console.error(`Unknown arg: ${a}`); help(); process.exit(2); }
  }
  return out;
}

function help() {
  console.log(`Seed a Brain registry row.

Usage:
  node scripts/seed-brain.mjs --slug <slug> --name <name> --author <email>
                              [--author-name <legal name>]
                              [--author-creds <certification>]
                              [--country UK]

Requires env:
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY

Exits cleanly if hammerex_nex_brains does not yet exist (apply
brain_content_v0.sql migration first).
`);
}

const { slug, name, author, authorName, authorCreds, country } = args();

if (!slug || !name || !author) {
  console.error("--slug, --name, and --author are all required.");
  help();
  process.exit(2);
}
if (!/^[a-z][a-z0-9_-]{1,63}$/.test(slug)) {
  console.error(`--slug '${slug}' does not match the Brain slug pattern [a-z][a-z0-9_-]{1,63}`);
  process.exit(2);
}

const supaUrl = process.env.SUPABASE_URL;
const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supaUrl || !supaKey) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in the environment.");
  process.exit(1);
}

const row = {
  slug,
  name,
  category:             "trade",
  version:              "0.1.0",
  status:               "draft",
  primary_author_id:    author.trim().toLowerCase(),
  primary_author_name:  authorName ?? null,
  primary_author_creds: authorCreds ?? null,
  supported_countries:  [country]
};

// Use PostgREST (Supabase REST) to insert idempotently via upsert.
const endpoint = `${supaUrl.replace(/\/$/, "")}/rest/v1/hammerex_nex_brains`;

const res = await fetch(endpoint, {
  method: "POST",
  headers: {
    "apikey":         supaKey,
    "Authorization":  `Bearer ${supaKey}`,
    "Content-Type":   "application/json",
    "Prefer":         "resolution=merge-duplicates,return=representation"
  },
  body: JSON.stringify(row)
});

const text = await res.text();

if (res.status === 404 || /relation .+ does not exist|Could not find the table/i.test(text)) {
  console.error("hammerex_nex_brains table does not exist yet.");
  console.error("Apply the pending migration first:");
  console.error("  docs/implementation/pending-migrations/brain_content_v0.sql");
  console.error("See docs/implementation/pending-migrations/APPROVAL_PACKAGE.md for the approval + apply procedure.");
  process.exit(1);
}

if (!res.ok) {
  console.error(`Insert failed (${res.status}): ${text}`);
  process.exit(1);
}

console.log(`Seeded Brain '${slug}' successfully.`);
console.log(text);
