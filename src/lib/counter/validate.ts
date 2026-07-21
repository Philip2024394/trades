// The Counter · content validator.
//
// Phase 1 rules (Philip 2026-07-20 Counter design):
//   1. No canteen name / slug appears in title or body → auto-flag,
//      72h posting ban
//   2. No off-topic body (basic keyword blocklist) → auto-flag, 72h ban
//
// Phase 2 will add: image pHash cross-check vs canteen banners,
// ML image classifier for construction-only, LLM borderline scoring.
//
// The validator returns a shape the caller can log AND surface in the
// UI ("your post was flagged because …"). Never throws — validation
// failure is a normal outcome, not an exception.

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type CounterValidationResult =
  | { ok: true }
  | { ok: false; reason: string; ruleId: "canteen_name" | "off_topic" | "empty" | "too_short" | "too_long" };

const OFF_TOPIC_BLOCKLIST = [
  // Common spam-magnet non-construction categories.
  "essay", "casino", "crypto", "nft", "seo services", "web design",
  "escort", "dating", "loan", "onlyfans", "porn", "gambl", "poker",
  "diet pill", "weight loss", "supplement"
];

const MIN_TITLE = 6;
const MAX_TITLE = 120;
const MIN_BODY  = 20;
const MAX_BODY  = 1200;

let canteenNamesCache: { at: number; names: string[] } | null = null;
const CANTEEN_NAMES_TTL_MS = 5 * 60 * 1000;   // 5 min

/** Fetch every canteen name + slug from the DB. Cached for 5 minutes
 *  so validation stays cheap on hot paths. */
async function loadCanteenNames(): Promise<string[]> {
  const now = Date.now();
  if (canteenNamesCache && (now - canteenNamesCache.at) < CANTEEN_NAMES_TTL_MS) {
    return canteenNamesCache.names;
  }
  const res = await supabaseAdmin
    .from("hammerex_canteens")
    .select("slug, name, host_display_name");
  const names = new Set<string>();
  for (const row of (res.data ?? [])) {
    const r = row as { slug: string; name: string; host_display_name: string | null };
    if (r.slug && r.slug.length >= 3) names.add(r.slug.toLowerCase());
    if (r.name && r.name.length >= 3) names.add(r.name.toLowerCase());
    if (r.host_display_name && r.host_display_name.length >= 3) names.add(r.host_display_name.toLowerCase());
  }
  const arr = Array.from(names);
  canteenNamesCache = { at: now, names: arr };
  return arr;
}

/** Validate a Counter post before insert. Applies all Phase-1 rules. */
export async function validateCounterPost(input: {
  title:              string;
  body:               string;
  posterCanteenSlug?: string;    // whitelist the poster's own canteen name
}): Promise<CounterValidationResult> {
  const title = input.title.trim();
  const body  = input.body.trim();

  if (!title || !body)      return { ok: false, reason: "Title and description are both required.", ruleId: "empty" };
  if (title.length < MIN_TITLE) return { ok: false, reason: `Title must be at least ${MIN_TITLE} characters.`, ruleId: "too_short" };
  if (title.length > MAX_TITLE) return { ok: false, reason: `Title cannot exceed ${MAX_TITLE} characters.`,   ruleId: "too_long" };
  if (body.length  < MIN_BODY)  return { ok: false, reason: `Description must be at least ${MIN_BODY} characters.`, ruleId: "too_short" };
  if (body.length  > MAX_BODY)  return { ok: false, reason: `Description cannot exceed ${MAX_BODY} characters.`,     ruleId: "too_long" };

  const lowerTitle = title.toLowerCase();
  const lowerBody  = body.toLowerCase();

  // Rule 1 — canteen name in title/body.
  const canteenNames = await loadCanteenNames();
  const ownName      = input.posterCanteenSlug?.toLowerCase();
  for (const name of canteenNames) {
    if (ownName && name === ownName) continue;    // poster can reference their own canteen
    // Word-boundary match so "site" doesn't match "on-site".
    const pattern = new RegExp(`\\b${escapeRegex(name)}\\b`, "i");
    if (pattern.test(lowerTitle) || pattern.test(lowerBody)) {
      return {
        ok: false,
        reason: `Posts to The Counter can't reference other canteens by name ("${name}"). Post the listing on its own merit.`,
        ruleId: "canteen_name"
      };
    }
  }

  // Rule 2 — off-topic body.
  for (const bad of OFF_TOPIC_BLOCKLIST) {
    if (lowerBody.includes(bad) || lowerTitle.includes(bad)) {
      return {
        ok: false,
        reason: `The Counter is for construction products and trade services only ("${bad}" is off-topic).`,
        ruleId: "off_topic"
      };
    }
  }

  return { ok: true };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Check whether a poster is currently banned from The Counter.
 *  Returns null if not banned; otherwise returns the ban expiry ISO. */
export async function counterBanState(listingId: string): Promise<{
  bannedUntil: string;
  reason: string | null;
} | null> {
  const res = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("counter_banned_until, counter_last_flag_reason")
    .eq("id", listingId)
    .maybeSingle();
  if (!res.data?.counter_banned_until) return null;
  if (new Date(res.data.counter_banned_until as string).getTime() <= Date.now()) return null;
  return {
    bannedUntil: res.data.counter_banned_until as string,
    reason:      (res.data.counter_last_flag_reason as string | null) ?? null
  };
}

/** Apply the 72h ban clock. Repeat offences within 30 days escalate
 *  to 168h (7d). Called only when validation returns { ok: false }
 *  with a real content-rule failure (not size/format issues). */
export async function applyCounterBan(input: {
  listingId: string;
  reason:    string;
}): Promise<void> {
  const cur = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("counter_flag_count, counter_banned_until")
    .eq("id", input.listingId)
    .maybeSingle();
  const priorCount = (cur.data?.counter_flag_count as number | undefined) ?? 0;
  const banHours   = priorCount === 0 ? 72 : priorCount === 1 ? 168 : 24 * 30; // 30d after 3rd
  const bannedUntil = new Date(Date.now() + banHours * 3600 * 1000).toISOString();
  await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .update({
      counter_banned_until:     bannedUntil,
      counter_last_flag_reason: input.reason,
      counter_flag_count:       priorCount + 1
    })
    .eq("id", input.listingId);
}
