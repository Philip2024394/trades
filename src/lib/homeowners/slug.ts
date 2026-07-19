// Homeowner slug generator.
//
// Every homeowner's SiteBook lives at thenetworkers.app/{slug} — root
// level, mirroring the shortest possible URL for a personal SiteBook.
// First-come-first-served: first homeowner with a given name gets the
// shortest slug; subsequent collisions add a numeric suffix.
//
// Rules:
//   - lowercase, letters + digits only (no hyphens by default —
//     hyphens only appear on collision suffixes: theoldrectory-2,
//     theoldrectory-3, etc.)
//   - max 40 chars
//   - starts with a letter
//   - blacklist of reserved app routes so nobody can claim /find,
//     /about, /admin, etc.
//   - collision-safe with -{n} suffix, first user wins the base slug

import { supabaseAdmin } from "@/lib/supabaseAdmin";

const MAX_SLUG_LEN = 40;

// Words the homeowner can NEVER claim as a slug — they'd shadow
// existing top-level app routes. Keep in sync with directory listing
// of src/app/*.
const RESERVED_SLUGS = new Set([
  "about", "activity", "admin", "affiliates", "api", "apps", "archive",
  "auth", "beacon-join", "capture", "claim", "community", "contact",
  "dashboard", "entity", "feed", "find", "golden-path", "home",
  "homeowners", "homepage-split", "i", "inbox", "insights", "join",
  "legal", "news", "newsletter", "preview", "project", "property",
  "quote", "review", "reviewer", "shared-estimate", "showcase",
  "signin", "sign-in", "sitebook", "sitebook-project", "sitebook-showcase",
  "site-board", "site-office", "status", "store", "studio", "support",
  "tc", "trade", "trade-hq", "trade-off", "why", "manifest", "robots",
  "sitemap", "not-found", "error", "global-error", "layout", "page",
  "public", "static", "_next", "favicon", "hello", "www", "app", "help",
  "terms", "privacy", "settings", "pricing", "docs", "blog",
  "r",     // /r/{token}    — public reply pages for SiteBook WA threads
  "join"   // /join/{token} — public invitation accept pages
]);

export function baseSlugFromNickname(nickname: string): string {
  // Strip ALL non-alphanumeric characters — no hyphens in the base
  // slug. "The Old Rectory" → "theoldrectory". Collision suffixes
  // add -2, -3 etc. later.
  const cleaned = nickname
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]/g, "");
  const safe = /^[a-z]/.test(cleaned) ? cleaned : `home${cleaned}`;
  const trimmed = safe.slice(0, MAX_SLUG_LEN);
  return trimmed || `home${Date.now().toString(36)}`;
}

function isReserved(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.toLowerCase());
}

/**
 * Reserve a unique homeowner slug. Checks the homeowners table AND
 * the reserved-words blacklist. First-come-first-served: first user
 * with a given name gets the shortest slug (no suffix). Subsequent
 * collisions get "-2", "-3", etc.
 *
 * Merchant slugs (at /trade/{slug}) live in a different namespace,
 * so no cross-check needed. Reserved words prevent shadowing
 * existing top-level app routes.
 */
export async function reserveHomeownerSlug(base: string): Promise<string> {
  const clean = base.slice(0, MAX_SLUG_LEN);
  // If the base itself is reserved, start with -1 suffix immediately.
  let candidate = isReserved(clean) ? `${clean}-1` : clean;
  let suffix = 1;

  while (true) {
    const res = await supabaseAdmin
      .from("hammerex_homeowners")
      .select("id")
      .ilike("slug", candidate)
      .maybeSingle();
    if (!res.data && !isReserved(candidate)) return candidate;

    suffix += 1;
    const suffixStr = `-${suffix}`;
    candidate = clean.slice(0, MAX_SLUG_LEN - suffixStr.length) + suffixStr;
    if (suffix > 99) return `${clean.slice(0, 25)}-${Date.now().toString(36)}`;
  }
}
