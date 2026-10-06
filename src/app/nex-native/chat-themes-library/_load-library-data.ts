// src/app/nex-native/chat-themes-library/_load-library-data.ts
//
// Shared library data loader · Step 1B (sealed 2026-10-06).
//
// Both the Category Landing (`page.tsx`) and the Category Showcase
// route (`category/[categoryId]/page.tsx`) need the same session,
// tier, trial state, viewer avatar, feature-flag toggles and merged
// theme collection. Rather than duplicate that logic into two server
// components, it lives here once.
//
// This file is server-only (reads session + Supabase admin) · callers
// must be server components. Nothing in this helper branches on
// theme id or category id · all data returned is universal.

import "server-only";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import {
  effectiveTier,
  hasUsedThemesTrial,
  isThemesTrialActive,
  themesTrialExpiresAt,
} from "@/lib/nex-native/account-service";
import * as chatThemeService from "@/lib/nex-native/chat-theme-service";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import type { NexAccountRow } from "@/lib/nex-native/types";
import type { BrowserThemeRow } from "./_theme-browser-client";
import { listLiveWorldsAsBrowserRows } from "./_live-worlds-adapter";
import { EXPLORE_CATEGORY_ID } from "@/lib/nex-native/theme-category/registry";

// Re-export the pure helper so existing callers (if any) continue to
// find `countCategoryMembers` here · the actual implementation lives
// in `_category-member-counts.ts` so it can be imported without
// pulling in `supabase-admin`.
export { countCategoryMembers } from "./_category-member-counts";

export type LibraryLoadResult =
  | { kind: "unauthenticated" }
  | {
      kind: "ok";
      sessionAccountId: string;
      currentTier: ReturnType<typeof effectiveTier>;
      currentThemeId: string;
      canUsePremium: boolean;
      trialActive: boolean;
      trialUsed: boolean;
      trialExpiresIso: string | null;
      viewerAvatarUrl: string | null;
      browserThemes: BrowserThemeRow[];
      usePhoneTiles: boolean;
      useImmersivePreview: boolean;
    };

/** Load everything the Theme Library's server components need to
 *  render · session, account tier/trial, merged theme collection
 *  (DB + code-registered live-worlds), feature-flag toggles. Returns
 *  `{ kind: "unauthenticated" }` when no session is present so each
 *  caller can decide whether to redirect or 404. */
export async function loadLibraryData(): Promise<LibraryLoadResult> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) return { kind: "unauthenticated" };

  // Read tier + trial state + current theme from the latest DB row
  // (session may be stale). themes_trial_used_at is required by
  // effectiveTier so trial-active accounts unlock the premium
  // catalogue automatically for the 7-day window.
  const row = await nexSupabaseAdmin
    .from("nex_account")
    .select("tier, bisnis_expires_at, chat_theme, themes_trial_used_at")
    .eq("id", session.account.id)
    .maybeSingle();
  const account = (row.data ?? {}) as Pick<
    NexAccountRow,
    "tier" | "bisnis_expires_at" | "chat_theme" | "themes_trial_used_at"
  >;
  const currentTier = effectiveTier(account);
  const currentThemeId = account.chat_theme ?? "default";
  const canUsePremium = currentTier === "bisnis" || currentTier === "pro";
  const trialActive = isThemesTrialActive(account);
  const trialUsed = hasUsedThemesTrial(account);
  const trialExpiresIso = themesTrialExpiresAt(account);

  // Viewer's own profile photo · used by themes without a built-in
  // hero_image_url to preview the Portrait Bloom mechanic with the
  // viewer's actual face.
  const viewerAvatarUrl = await (async () => {
    try {
      const svc = await import("@/lib/nex-native/account-profile-service");
      const profile = await svc.getProfileByAccountId(session.account.id);
      return profile?.avatar_url ?? null;
    } catch {
      return null;
    }
  })();

  // Merged theme collection: live-worlds (code) + DB themes (filtered
  // against id collisions · code wins). Live-world rows carry their
  // category_id from the ThemePackage; DB rows default to
  // EXPLORE_CATEGORY_ID until a future authorisation decides whether
  // to add a DB column. Mirrors the Step 1A adapter / page.tsx logic.
  const dbThemes = await chatThemeService.listActiveThemes();
  const liveWorldRows = listLiveWorldsAsBrowserRows();
  const liveWorldIds = new Set(liveWorldRows.map((r) => r.id));
  const dbRowsFiltered = dbThemes.filter((t) => !liveWorldIds.has(t.id));
  const browserThemes: BrowserThemeRow[] = [
    ...liveWorldRows,
    ...dbRowsFiltered.map((t) => ({
      id: t.id,
      name: t.name,
      tagline: t.tagline,
      accent_hex: t.accent_hex,
      bubble_rim_hex: t.bubble_rim_hex,
      composer_rim_hex: t.composer_rim_hex,
      tier: t.tier,
      category: t.category,
      category_id: EXPLORE_CATEGORY_ID,
      hero_image_url: t.hero_image_url,
      sort_order: t.sort_order,
      intro_video_url: t.intro_video_url,
      intro_poster_url: t.intro_poster_url,
      wallpaper_config: t.wallpaper_config,
    })),
  ];

  // Feature flags · kept here so both routes consume the same flags
  // and the kill-switch behaviour stays consistent across every
  // Library surface.
  const usePhoneTiles = process.env.NEX_THEMES_PHONE_TILES !== "0";
  const useImmersivePreview =
    process.env.NEX_THEMES_IMMERSIVE_PREVIEW !== "0";

  return {
    kind: "ok",
    sessionAccountId: session.account.id,
    currentTier,
    currentThemeId,
    canUsePremium,
    trialActive,
    trialUsed,
    trialExpiresIso,
    viewerAvatarUrl,
    browserThemes,
    usePhoneTiles,
    useImmersivePreview,
  };
}

// countCategoryMembers lives in `./_category-member-counts.ts` and is
// re-exported above so test harnesses can import it without pulling
// in the Supabase admin module.
