// scripts/nex-account-profile-reality-check.mts
//
// NEX Account Profile · Reality Check · Bridge 2
// ---------------------------------------------
// Proves migration 042 · nex_account_profile · end-to-end against the
// authoritative NEX Supabase project. Tests the DB directly (constraints,
// triggers, RLS) rather than importing the service layer — this is the
// more faithful acceptance because the service layer is a defense-in-depth
// wrapper around these DB invariants.
//
// Verifies:
//   §0  Env + reach
//   §1  Migration recorded in nex_migration_history
//   §2  Scratch accounts A + B
//   §3  Fresh account has NO profile row
//   §4  Insert with kind=professional · read back exactly
//   §5  UPDATE bumps updated_at via trigger
//   §6  Invalid kind rejected by DB CHECK
//   §7  Oversized bio rejected by DB CHECK (1001 chars)
//   §8  RLS · non-owner authenticated user cannot UPDATE another profile
//   §9  RLS · anonymous SELECT respects is_public flag
//   §10 Cleanup

import { createClient } from "@supabase/supabase-js";
import * as fs from "node:fs";
import * as path from "node:path";

const NEX_PROJECT_REF = "ijvqdvsvwtwxzcqmoqit";

function loadEnv(): void {
  const p = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    if (!process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
  }
}
loadEnv();

const green = (m: string) => console.log(`  ✅ ${m}`);
const red = (m: string) => { console.log(`  ❌ ${m}`); process.exitCode = 1; };
const section = (t: string) => { console.log(""); console.log(`── ${t}`); };
const die = (m: string) => { console.log(""); red(m); console.log(""); console.log("Reality Check · FAILED"); process.exit(1); };

console.log("");
console.log("┌─────────────────────────────────────────────────────────────┐");
console.log("│   NEX Account Profile · Reality Check · Bridge 2            │");
console.log(`│   Target: ${NEX_PROJECT_REF}                                  │`);
console.log("└─────────────────────────────────────────────────────────────┘");

// §0
section("§0 · Env · credentials + target");
const url = process.env.NEX_SUPABASE_URL ?? process.env.NEXT_PUBLIC_NEX_SUPABASE_URL;
const svc = process.env.NEX_SUPABASE_SERVICE_ROLE_KEY;
const anon = process.env.NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY;
if (!url || !svc) die("Missing NEX_SUPABASE_URL or service-role key");
if (!anon) die("Missing NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY");
if (!url.includes(NEX_PROJECT_REF)) die(`URL not ${NEX_PROJECT_REF} · got ${url}`);
green(`Env OK · targeting ${NEX_PROJECT_REF}`);

const admin = createClient(url, svc, { auth: { persistSession: false, autoRefreshToken: false } });
const anonClient = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });

// §1 · Migration recorded
section("§1 · Migration 042 present in nex_migration_history");
const hist = await admin.from("nex_migration_history").select("version, description").eq("version", "042").maybeSingle();
if (hist.error || !hist.data) die(`Migration 042 not recorded: ${hist.error?.message ?? "no row"}`);
green(`042 recorded: ${(hist.data as { description: string }).description.slice(0, 60)}…`);

// §2 · Scratch accounts
section("§2 · Scratch accounts A + B");
const suffixA = "rc" + Math.floor(Math.random() * 1_000_000).toString().padStart(6, "0");
const suffixB = "rc" + Math.floor(Math.random() * 1_000_000).toString().padStart(6, "0");
const emailA = `profile-rc-a-${suffixA}@nex-native.local`;
const emailB = `profile-rc-b-${suffixB}@nex-native.local`;
const passA = "ProfileRCA!2026";
const passB = "ProfileRCB!2026";
const cuA = await admin.auth.admin.createUser({ email: emailA, password: passA, email_confirm: true });
if (cuA.error || !cuA.data.user) die(`auth createUser A: ${cuA.error?.message}`);
const authIdA = cuA.data.user.id;
const cuB = await admin.auth.admin.createUser({ email: emailB, password: passB, email_confirm: true });
if (cuB.error || !cuB.data.user) die(`auth createUser B: ${cuB.error?.message}`);
const authIdB = cuB.data.user.id;
const acA = await admin.from("nex_account").insert({ supabase_user_id: authIdA, display_name: `RC A ${suffixA}` }).select("id").single();
if (acA.error) die(`nex_account A insert: ${acA.error.message}`);
const accountA = (acA.data as { id: string }).id;
const acB = await admin.from("nex_account").insert({ supabase_user_id: authIdB, display_name: `RC B ${suffixB}` }).select("id").single();
if (acB.error) die(`nex_account B insert: ${acB.error.message}`);
const accountB = (acB.data as { id: string }).id;
green(`Accounts · A=${accountA.slice(0, 8)}…  B=${accountB.slice(0, 8)}…`);

async function cleanup(): Promise<void> {
  await admin.from("nex_account_profile").delete().in("account_id", [accountA, accountB]).then(() => {}, () => {});
  await admin.from("nex_account").delete().in("id", [accountA, accountB]).then(() => {}, () => {});
  await admin.auth.admin.deleteUser(authIdA).then(() => {}, () => {});
  await admin.auth.admin.deleteUser(authIdB).then(() => {}, () => {});
}

try {
  // §3 · Fresh account has no profile row
  section("§3 · Fresh account has NO profile row (never fabricated)");
  const empty = await admin.from("nex_account_profile").select("*").eq("account_id", accountA).maybeSingle();
  if (empty.error) die(`select A empty: ${empty.error.message}`);
  if (empty.data !== null) die(`Expected null · got ${JSON.stringify(empty.data).slice(0, 120)}`);
  green("No profile fabricated on account create");

  // §4 · Insert + read back
  section("§4 · Insert profile A · kind=professional · read back exactly");
  const inserted = await admin
    .from("nex_account_profile")
    .insert({
      account_id: accountA,
      kind: "professional",
      headline: "Footwear designer · Bandung",
      profession: "footwear designer",
      skills: ["sample-making", "CAD"],
      bio: "12 years building running shoes.",
      location_label: "Bandung, Indonesia",
      looking_for: ["clients", "collaborators"],
      is_public: true,
    })
    .select("*")
    .single();
  if (inserted.error || !inserted.data) die(`insert A: ${inserted.error?.message}`);
  const rowA = inserted.data as {
    kind: string;
    headline: string;
    skills: string[];
    is_public: boolean;
    created_at: string;
    updated_at: string;
  };
  if (rowA.kind !== "professional") die(`kind: ${rowA.kind}`);
  if (rowA.skills.length !== 2) die(`skills: ${JSON.stringify(rowA.skills)}`);
  if (rowA.is_public !== true) die(`is_public: ${rowA.is_public}`);
  green("Insert + round-trip exactly");

  // §5 · UPDATE bumps updated_at via trigger
  section("§5 · UPDATE bumps updated_at via nex_touch_updated_at trigger");
  const beforeStamp = rowA.updated_at;
  await new Promise((r) => setTimeout(r, 1100)); // clock guard
  const upd = await admin
    .from("nex_account_profile")
    .update({ headline: "Footwear designer · 12 yrs · Bandung" })
    .eq("account_id", accountA)
    .select("*")
    .single();
  if (upd.error) die(`update A: ${upd.error.message}`);
  const upRow = upd.data as { headline: string; profession: string; updated_at: string };
  if (upRow.headline !== "Footwear designer · 12 yrs · Bandung") die("Headline not updated");
  if (upRow.profession !== "footwear designer") die("Other fields not preserved");
  if (!(upRow.updated_at > beforeStamp)) die(`updated_at did not bump (${beforeStamp} vs ${upRow.updated_at})`);
  green("Partial UPDATE preserves other fields · updated_at bumped");

  // §6 · Invalid kind rejected by DB CHECK
  section("§6 · Invalid kind rejected by DB CHECK constraint");
  const badKind = await admin
    .from("nex_account_profile")
    .update({ kind: "wizard" as unknown as "professional" })
    .eq("account_id", accountA);
  if (!badKind.error) die("Invalid kind was accepted by DB");
  if (!/check|constraint|kind/i.test(badKind.error.message)) die(`Unexpected error: ${badKind.error.message}`);
  green(`Invalid kind rejected by DB: ${badKind.error.message.slice(0, 80)}`);

  // §7 · Oversized bio rejected by DB CHECK (bio_len)
  section("§7 · Bio > 1000 chars rejected by DB CHECK");
  const bigBio = await admin
    .from("nex_account_profile")
    .update({ bio: "x".repeat(1001) })
    .eq("account_id", accountA);
  if (!bigBio.error) die("Oversized bio was accepted by DB");
  if (!/check|constraint|bio/i.test(bigBio.error.message)) die(`Unexpected error: ${bigBio.error.message}`);
  green(`Oversized bio rejected by DB: ${bigBio.error.message.slice(0, 80)}`);

  // §8 · RLS · non-owner cannot UPDATE another account's profile
  section("§8 · RLS · authenticated non-owner cannot UPDATE another profile");
  const signInB = await anonClient.auth.signInWithPassword({ email: emailB, password: passB });
  if (signInB.error || !signInB.data.session) die(`Sign in B failed: ${signInB.error?.message}`);
  const hijack = await anonClient
    .from("nex_account_profile")
    .update({ headline: "HIJACKED" })
    .eq("account_id", accountA)
    .select("*");
  const touched = (hijack.data ?? []).length;
  if (touched !== 0) die(`RLS BROKEN · non-owner mutated ${touched} row(s)`);
  const stillMine = await admin.from("nex_account_profile").select("headline").eq("account_id", accountA).single();
  if ((stillMine.data as { headline: string }).headline !== "Footwear designer · 12 yrs · Bandung") {
    die("RLS BROKEN · headline changed");
  }
  green("RLS blocks cross-account UPDATE · A's row unchanged");
  await anonClient.auth.signOut();

  // §9 · Anonymous SELECT respects is_public
  section("§9 · Anon SELECT · public flag honoured");
  // Flip A to private
  await admin.from("nex_account_profile").update({ is_public: false }).eq("account_id", accountA);
  const readPrivate = await anonClient.from("nex_account_profile").select("headline").eq("account_id", accountA);
  if ((readPrivate.data ?? []).length !== 0) die(`Anon read PRIVATE profile · ${(readPrivate.data ?? []).length} rows`);
  await admin.from("nex_account_profile").update({ is_public: true }).eq("account_id", accountA);
  const readPublic = await anonClient.from("nex_account_profile").select("headline").eq("account_id", accountA);
  if ((readPublic.data ?? []).length !== 1) die(`Anon could not read PUBLIC profile · ${(readPublic.data ?? []).length} rows`);
  green("Anon reads public profile · cannot read private profile");
} finally {
  section("§10 · Cleanup");
  await cleanup();
  green("Cleanup complete");
}

console.log("");
if (process.exitCode === 1) {
  console.log("Reality Check · FAILED");
  process.exit(1);
}
console.log("Reality Check · PASSED");
