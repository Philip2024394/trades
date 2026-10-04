// src/lib/nex-native/theme-intro-service.ts
//
// NEX Phase 4A · premium theme intro-video state helpers.
// Founder-authorised 2026-10-04.
//
// Two surfaces:
//   · hasSeenThemeIntro(accountId, themeId) — single-row EXISTS probe
//     used by the chat server component to decide whether to mount
//     the ThemeIntroInterstitial. Pure read · fail-soft.
//
//   · markThemeIntroSeen(accountId, themeId) — append-only insert.
//     The client fires this at `video.onended` as fire-and-forget ·
//     chat entry MUST never block on this call. Idempotent · a
//     repeat insert hits ON CONFLICT DO NOTHING and succeeds silently.
//
// Both functions catch all errors and return a safe default:
//   · hasSeenThemeIntro → `false` on error so the intro plays
//     (worst-case the user watches a short video they've seen before
//     · we never block entry · we never claim they've seen it when
//     uncertain).
//   · markThemeIntroSeen → swallows errors so the caller can
//     fire-and-forget without a try/catch at the call site.

import "server-only";
import { nexSupabaseAdmin } from "./supabase-admin";
import type { NexUuid } from "./types";

/** True iff a row exists in nex_theme_intro_seen for this
 *  (account_id, theme_id) pair. */
export async function hasSeenThemeIntro(
  accountId: NexUuid,
  themeId: string,
): Promise<boolean> {
  if (!accountId || !themeId) return false;
  try {
    const { data, error } = await nexSupabaseAdmin
      .from("nex_theme_intro_seen")
      .select("account_id")
      .eq("account_id", accountId)
      .eq("theme_id", themeId)
      .limit(1)
      .maybeSingle();
    if (error) {
      // Safe default · let the intro play. We never falsely claim
      // the user has seen something.
      return false;
    }
    return !!data;
  } catch {
    return false;
  }
}

/** Record that this account has seen this theme's intro. Idempotent
 *  (ON CONFLICT · the row already existing is a success · not an
 *  error). Fire-and-forget · callers do not need to await this to
 *  continue · failure is swallowed. */
export async function markThemeIntroSeen(
  accountId: NexUuid,
  themeId: string,
): Promise<void> {
  if (!accountId || !themeId) return;
  try {
    await nexSupabaseAdmin
      .from("nex_theme_intro_seen")
      .upsert(
        { account_id: accountId, theme_id: themeId },
        { onConflict: "account_id,theme_id", ignoreDuplicates: true },
      );
  } catch {
    // Deliberately swallow · the client has already finished playing
    // the intro and the chat is already open · retrying or surfacing
    // this error would just confuse the user. Worst case the user
    // sees the intro again next time.
  }
}
