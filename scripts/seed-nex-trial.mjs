// Nex trial-data seed script.
//
// Seeds a small, self-consistent demo dataset so every Nex engine
// (BI · PI · Est · CX · MD · FI · SC · PM · CV · NET) has real rows
// to reason against on a fresh install.
//
// Usage:
//   node scripts/seed-nex-trial.mjs             # DRY-RUN (default) — prints SQL only
//   node scripts/seed-nex-trial.mjs --write     # actually executes against Supabase
//   node scripts/seed-nex-trial.mjs --purge     # dry-run of the purge (remove demo-nex-* rows)
//   node scripts/seed-nex-trial.mjs --purge --write
//
// Every row uses a `demo-nex-` slug prefix so purging is safe.
// Every INSERT uses ON CONFLICT so re-running is idempotent.
//
// What gets seeded:
//   • 3 demo trade merchants (plasterer, sparky, chippy) — different cities
//   • 2 demo homeowners
//   • 2 demo SiteBook projects (kitchen + loft), each with 3 members
//   • Photos, cost lines (some paid / overdue / awaiting), snags
//   • Network reviews (mix of ratings, some with owner replies)
//   • App CRM contacts hydrated from the homeowners
//
// SKIPPED (documented honestly):
//   • app_quote_workspace_quotes + app_job_diary_jobs — those require
//     os_parties + os_projects + os_properties rows. Adding them
//     safely needs a wider migration audit. Result: the Est / FI
//     realised-profit / PM forecast engines will show "no accepted
//     quotes yet" for the trial data. Everything else has data.

import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";

const IS_WRITE  = process.argv.includes("--write");
const IS_PURGE  = process.argv.includes("--purge");

const REF = "msdonkkechxzgagyguoe";
const ENV_PATH = "C:\\Users\\Victus\\hammer\\.env.tools.local";

// ─── SQL: single set of statements, ordered by dependency ────────

const SEED_STATEMENTS = [
  // Merchants
  `INSERT INTO hammerex_trade_off_listings (slug, display_name, trading_name, primary_trade, secondary_trades, city, country, postcode_prefix, whatsapp, email, lat, lng)
   VALUES
     ('demo-nex-phil-plumbing', 'Phil Plumbing', 'Phil Plumbing Ltd', 'plumber',   '{"heating","gas"}',      'Manchester', 'United Kingdom', 'M25', '+447700000101', 'demo-phil@example.com', 53.4808, -2.2426),
     ('demo-nex-dave-sparks',   'Dave Sparks',   'Dave Sparks Ltd',   'electrician','{"solar","networking"}', 'Manchester', 'United Kingdom', 'M25', '+447700000102', 'demo-dave@example.com', 53.4810, -2.2450),
     ('demo-nex-tom-carpentry', 'Tom Carpentry', NULL,                'carpenter', '{"joiner","kitchens"}',  'Leeds',      'United Kingdom', 'LS1', '+447700000103', 'demo-tom@example.com',  53.7997, -1.5492)
   ON CONFLICT (slug) DO UPDATE SET display_name = EXCLUDED.display_name, primary_trade = EXCLUDED.primary_trade, city = EXCLUDED.city, postcode_prefix = EXCLUDED.postcode_prefix, lat = EXCLUDED.lat, lng = EXCLUDED.lng;`,

  // Homeowners
  `INSERT INTO hammerex_homeowners (email, first_name, last_name, whatsapp_number, city, postcode, house_nickname, slug, premium_tier)
   VALUES
     ('demo-smith@example.com', 'Elaine', 'Smith', '+447700000201', 'Manchester', 'M25 1AB', 'Smith House',   'demo-nex-smith-house',  'free'),
     ('demo-jones@example.com', 'Rob',    'Jones', '+447700000202', 'Leeds',      'LS1 4RB', 'Jones Cottage', 'demo-nex-jones-cottage', 'free')
   ON CONFLICT (email) DO UPDATE SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, house_nickname = EXCLUDED.house_nickname, slug = EXCLUDED.slug;`,

  // Projects
  `INSERT INTO hammerex_sitebook_projects (homeowner_id, title, description, trade_types, address_postcode, address_city, budget_min_gbp, budget_max_gbp, timeline, status, started_at)
   SELECT ho.id, p.title, p.description, p.trade_types::text[], p.postcode, p.city, p.bmin, p.bmax, p.timeline, p.status, p.started
   FROM (VALUES
     ('demo-smith@example.com', 'Smith kitchen refit',  'Full kitchen refit including plumbing + electrics + carpentry.', ARRAY['plumber','electrician','carpenter'], 'M25 1AB', 'Manchester', 12000, 18000, '1-3-months'::text, 'in-progress'::text, now() - interval '18 days'),
     ('demo-jones@example.com', 'Jones loft conversion','Loft to double bedroom with en-suite.',                          ARRAY['carpenter','electrician'],           'LS1 4RB', 'Leeds',      25000, 32000, '3-plus-months'::text, 'in-progress'::text, now() - interval '30 days')
   ) AS p(email, title, description, trade_types, postcode, city, bmin, bmax, timeline, status, started)
   JOIN hammerex_homeowners ho ON ho.email = p.email
   ON CONFLICT DO NOTHING;`,

  // Members (linking merchants to projects)
  `INSERT INTO hammerex_sitebook_members (project_id, listing_id, merchant_slug, merchant_name, trade_type, member_role, status, invited_at, hired_at)
   SELECT proj.id, list.id, list.slug, list.display_name, list.primary_trade, 'lead'::text, m.status, now() - interval '15 days', CASE WHEN m.status <> 'invited' THEN now() - interval '12 days' ELSE NULL END
   FROM (VALUES
     ('Smith kitchen refit',   'demo-nex-phil-plumbing', 'in-progress'::text),
     ('Smith kitchen refit',   'demo-nex-dave-sparks',   'in-progress'::text),
     ('Smith kitchen refit',   'demo-nex-tom-carpentry', 'hired'::text),
     ('Jones loft conversion', 'demo-nex-tom-carpentry', 'in-progress'::text),
     ('Jones loft conversion', 'demo-nex-dave-sparks',   'hired'::text)
   ) AS m(project_title, merchant_slug, status)
   JOIN hammerex_sitebook_projects proj ON proj.title = m.project_title
   JOIN hammerex_trade_off_listings list ON list.slug  = m.merchant_slug
   ON CONFLICT DO NOTHING;`,

  // Photos
  `INSERT INTO hammerex_sitebook_photos (project_id, uploaded_by_type, uploaded_by_name, storage_url, caption, stage)
   SELECT proj.id, p.by_type, p.by_name, p.url, p.caption, p.stage
   FROM (VALUES
     ('Smith kitchen refit',   'homeowner', 'Elaine',   'https://placehold.co/800x600?text=Before',           'Kitchen — before',            'before'),
     ('Smith kitchen refit',   'trade',     'Phil',     'https://placehold.co/800x600?text=First+fix+plumbing','First-fix plumbing done',    'in-progress'),
     ('Smith kitchen refit',   'trade',     'Dave',     'https://placehold.co/800x600?text=Electrics',        'First-fix electrics',         'in-progress'),
     ('Jones loft conversion', 'homeowner', 'Rob',      'https://placehold.co/800x600?text=Loft+empty',       'Empty loft',                  'before'),
     ('Jones loft conversion', 'trade',     'Tom',      'https://placehold.co/800x600?text=Steels+in',        'Steels installed',            'in-progress')
   ) AS p(project_title, by_type, by_name, url, caption, stage)
   JOIN hammerex_sitebook_projects proj ON proj.title = p.project_title
   ON CONFLICT DO NOTHING;`,

  // Cost lines — mix of statuses so the FI/CX engines get real data.
  `INSERT INTO hammerex_sitebook_costs (homeowner_id, project_id, trade_listing_id, trade_name, kind, description, agreed_pence, paid_pence, status, due_at)
   SELECT ho.id, proj.id, list.id, list.display_name, c.kind, c.description, c.agreed, c.paid, c.status, c.due
   FROM (VALUES
     ('Smith kitchen refit',   'demo-nex-phil-plumbing', 'labour'::text,    'First-fix plumbing labour',                   180000, 180000, 'paid'::text,      now() - interval '5 days'),
     ('Smith kitchen refit',   'demo-nex-phil-plumbing', 'materials'::text, 'Copper pipe + fittings',                       80000,  80000, 'paid'::text,      now() - interval '10 days'),
     ('Smith kitchen refit',   'demo-nex-dave-sparks',   'labour'::text,    'First-fix electrics',                         220000, 100000, 'part_paid'::text, now() - interval '2 days'),
     ('Smith kitchen refit',   'demo-nex-tom-carpentry', 'labour'::text,    'Kitchen carcass install',                     450000,      0, 'agreed'::text,    now() + interval '10 days'),
     ('Jones loft conversion', 'demo-nex-tom-carpentry', 'labour'::text,    'Loft frame + plasterboard',                   680000, 340000, 'part_paid'::text, now() + interval '5 days'),
     ('Jones loft conversion', 'demo-nex-tom-carpentry', 'materials'::text, 'Timber + insulation',                         310000,      0, 'agreed'::text,    now() - interval '3 days'),
     ('Jones loft conversion', 'demo-nex-dave-sparks',   'supplier'::text,  'Consumer unit + accessories (Screwfix)',       90000,  90000, 'paid'::text,      now() - interval '14 days')
   ) AS c(project_title, merchant_slug, kind, description, agreed, paid, status, due)
   JOIN hammerex_sitebook_projects proj ON proj.title = c.project_title
   JOIN hammerex_trade_off_listings list ON list.slug  = c.merchant_slug
   JOIN hammerex_homeowners ho ON ho.id = proj.homeowner_id
   ON CONFLICT DO NOTHING;`,

  // Snags / things to fix
  `INSERT INTO hammerex_sitebook_things_to_fix (homeowner_id, project_id, title, assignee_listing_id, assignee_name, status)
   SELECT ho.id, proj.id, t.title, list.id, list.display_name, t.status
   FROM (VALUES
     ('Smith kitchen refit',   'Cold-water isolator handle stiff', 'demo-nex-phil-plumbing', 'open'::text),
     ('Smith kitchen refit',   'Socket needs re-siting',           'demo-nex-dave-sparks',   'in_progress'::text),
     ('Jones loft conversion', 'Skirting scuff on landing',        'demo-nex-tom-carpentry', 'fixed'::text)
   ) AS t(project_title, title, merchant_slug, status)
   JOIN hammerex_sitebook_projects proj ON proj.title = t.project_title
   JOIN hammerex_trade_off_listings list ON list.slug  = t.merchant_slug
   JOIN hammerex_homeowners ho ON ho.id = proj.homeowner_id
   ON CONFLICT DO NOTHING;`,

  // Network reviews — a mix of ratings + reply behaviour
  `INSERT INTO hammerex_network_reviews (merchant_slug, reviewer_display_name, reviewer_city, quality_score, communication_score, punctuality_score, value_score, cleanliness_score, overall_score, body, status, publish_at, owner_response_body, owner_response_at)
   VALUES
     ('demo-nex-phil-plumbing', 'Elaine Smith', 'Manchester', 5, 5, 5, 5, 5, 5.0, 'Phil sorted our whole first fix in two days, clean and tidy job.',  'live', now() - interval '9 days', 'Cheers Elaine — glad it went well.', now() - interval '8 days'),
     ('demo-nex-phil-plumbing', 'Simon Grey',   'Bolton',     4, 5, 4, 5, 4, 4.4, 'Turned up on time, priced fair.',                                    'live', now() - interval '60 days', NULL, NULL),
     ('demo-nex-dave-sparks',   'Elaine Smith', 'Manchester', 5, 4, 5, 4, 5, 4.6, 'Second-fix perfect, one socket needed moving but done same day.',    'live', now() - interval '2 days',  NULL, NULL),
     ('demo-nex-tom-carpentry', 'Rob Jones',    'Leeds',      5, 5, 5, 4, 5, 4.8, 'Loft frame is spot on. Would use again.',                             'live', now() - interval '20 days', 'Thanks Rob.', now() - interval '19 days'),
     ('demo-nex-tom-carpentry', 'Anna Patel',   'Wakefield',  3, 4, 3, 3, 4, 3.4, 'Fine work, running a bit behind schedule.',                          'live', now() - interval '90 days', NULL, NULL)
   ON CONFLICT DO NOTHING;`,

  // CRM contacts — one per (merchant, homeowner) pair with an activity trail
  `INSERT INTO app_crm_contacts (merchant_id, display_name, email, email_hash, whatsapp_e164, whatsapp_hash, postcode, source, lifecycle_stage, last_activity_at, last_touch_at)
   SELECT list.id, ho.first_name || ' ' || ho.last_name, ho.email, encode(digest(lower(ho.email), 'sha256'), 'hex'), ho.whatsapp_number, encode(digest(ho.whatsapp_number, 'sha256'), 'hex'), ho.postcode, 'sitebook_project', 'active', now() - interval '3 days', now() - interval '3 days'
   FROM hammerex_sitebook_members m
   JOIN hammerex_sitebook_projects proj ON proj.id = m.project_id
   JOIN hammerex_homeowners ho ON ho.id = proj.homeowner_id
   JOIN hammerex_trade_off_listings list ON list.id = m.listing_id
   WHERE m.merchant_slug LIKE 'demo-nex-%'
   ON CONFLICT (merchant_id, email_hash) DO NOTHING;`
];

const PURGE_STATEMENTS = [
  // Purge in reverse dependency order.
  `DELETE FROM app_crm_contacts WHERE merchant_id IN (SELECT id FROM hammerex_trade_off_listings WHERE slug LIKE 'demo-nex-%');`,
  `DELETE FROM hammerex_network_reviews WHERE merchant_slug LIKE 'demo-nex-%';`,
  `DELETE FROM hammerex_sitebook_things_to_fix WHERE homeowner_id IN (SELECT id FROM hammerex_homeowners WHERE slug LIKE 'demo-nex-%');`,
  `DELETE FROM hammerex_sitebook_costs WHERE homeowner_id IN (SELECT id FROM hammerex_homeowners WHERE slug LIKE 'demo-nex-%');`,
  `DELETE FROM hammerex_sitebook_photos WHERE project_id IN (SELECT id FROM hammerex_sitebook_projects WHERE homeowner_id IN (SELECT id FROM hammerex_homeowners WHERE slug LIKE 'demo-nex-%'));`,
  `DELETE FROM hammerex_sitebook_members WHERE merchant_slug LIKE 'demo-nex-%';`,
  `DELETE FROM hammerex_sitebook_projects WHERE homeowner_id IN (SELECT id FROM hammerex_homeowners WHERE slug LIKE 'demo-nex-%');`,
  `DELETE FROM hammerex_homeowners WHERE slug LIKE 'demo-nex-%';`,
  `DELETE FROM hammerex_trade_off_listings WHERE slug LIKE 'demo-nex-%';`
];

// ─── Runner ──────────────────────────────────────────────────────

async function runSQL(sql, token) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body:    JSON.stringify({ query: sql })
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${txt}`);
  return txt;
}

function loadToken() {
  if (!existsSync(ENV_PATH)) {
    console.error(`Env file not found at ${ENV_PATH} — cannot execute in --write mode.`);
    process.exit(1);
  }
  const envText = readFileSync(ENV_PATH, "utf-8");
  const match = envText.match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m);
  if (!match) {
    console.error(`SUPABASE_ACCESS_TOKEN missing from ${ENV_PATH}.`);
    process.exit(1);
  }
  return match[1].trim();
}

async function main() {
  const statements = IS_PURGE ? PURGE_STATEMENTS : SEED_STATEMENTS;
  const mode       = IS_PURGE ? "PURGE"          : "SEED";

  if (!IS_WRITE) {
    console.log(`--- ${mode} DRY-RUN — no rows will be touched.`);
    console.log(`--- Add --write to actually execute against Supabase project ${REF}.`);
    console.log();
    for (const [i, s] of statements.entries()) {
      console.log(`--- Statement ${i + 1}/${statements.length}`);
      console.log(s);
      console.log();
    }
    console.log(`--- End of dry-run. ${statements.length} statement(s) prepared.`);
    return;
  }

  const token = loadToken();
  console.log(`--- ${mode} WRITE MODE — executing ${statements.length} statement(s) against ${REF}.`);
  for (const [i, s] of statements.entries()) {
    process.stdout.write(`Statement ${i + 1}/${statements.length} … `);
    try {
      await runSQL(s, token);
      console.log("ok");
    } catch (err) {
      console.log("failed");
      console.error(err.message);
      process.exit(1);
    }
  }
  console.log(`--- Done. Every Nex engine now has demo-nex-* data to reason against.`);
  if (!IS_PURGE) {
    console.log(`\nDemo entities created:`);
    console.log(`  Merchants:  demo-nex-phil-plumbing · demo-nex-dave-sparks · demo-nex-tom-carpentry`);
    console.log(`  Homeowners: demo-nex-smith-house · demo-nex-jones-cottage`);
    console.log(`  Projects:   Smith kitchen refit · Jones loft conversion`);
    console.log(`\nAsk Nex as one of the demo merchants:`);
    console.log(`  "how's business?"           (BI + MD)`);
    console.log(`  "how are my projects?"      (PM overview)`);
    console.log(`  "tell me about Elaine Smith" (CX)`);
    console.log(`  "who owes me money?"        (CX + FI)`);
    console.log(`  "run today's business"      (command centre)`);
    console.log(`  "find me a carpenter"       (NET matchmaker)`);
    console.log(`  "my trust profile"          (NET trust)`);
    console.log(`  "my collaborators"          (NET collaboration graph)`);
    console.log(`\nPurge with:  node scripts/seed-nex-trial.mjs --purge --write`);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
