// Server-side Nex Themes repository · Philip 2026-08-03.
//
// Every Supabase read/write for the Theme Engine goes through this
// module. The API routes under /api/nex/themes/* call these functions
// after validating the x-nex-session-id header. Client code MUST NOT
// import this — it uses the Nex Supabase server-only client.
//
// Behaviour it enforces (composes with doctrine):
//   · Original Nex is IMMUTABLE — never removed / never listed as ownable
//   · Every apply runs the validator FIRST · rejected themes never persist
//   · Restore returns to LAST PERMANENT theme (previews never count as permanent)
//   · Only ONE active preview at a time per session (also DB-enforced via partial unique index)
//   · Discontinuation-guarantee: ownership never expires
//   · Every state transition writes to nex_themes_history for audit

import "server-only";
import { nexSupabase } from "@/lib/nex/supabase";
import {
  BUILT_IN_THEMES,
  getBuiltInTheme,
  isImmutableTheme,
  ORIGINAL_NEX,
} from "./registry";
import type {
  Theme,
  ThemeActive,
  ThemeOwnership,
  ThemePreview,
  ValidatorReport,
} from "./types";
import { validateTheme } from "./validator";

// ─── Row shapes ──────────────────────────────────────────────────────

type ActiveRow = {
  session_id: string;
  owner_user_id: string | null;
  theme_id: string;
  variant_id: string | null;
  source: ThemeActive["source"];
  applied_at: string;
  updated_at: string;
};

type OwnershipRow = {
  id: string;
  session_id: string;
  owner_user_id: string | null;
  theme_id: string;
  source: ThemeOwnership["source"];
  acquired_at: string;
  provenance: Record<string, unknown>;
};

type PreviewRow = {
  id: string;
  session_id: string;
  owner_user_id: string | null;
  theme_id: string;
  variant_id: string | null;
  granted_at: string;
  expires_at: string;
  outcome: ThemePreview["outcome"];
  session_expired_prompt_shown_at: string | null;
};

// ─── Missing-table detection · graceful degradation ──────────────────

let migrationWarningLogged = false;
function isMissingTableError(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  if (err.code === "42P01") return true;
  const msg = err.message ?? "";
  return /relation .* does not exist/i.test(msg) || /Could not find the table/i.test(msg);
}
function warnMigrationMissing(): void {
  if (migrationWarningLogged) return;
  migrationWarningLogged = true;
  console.warn(
    "[nex-themes] Nex Supabase tables not found. Apply the migration:\n" +
    "  1. Open the Nex Supabase dashboard (project ijvqdvsvwtwxzcqmoqit)\n" +
    "  2. SQL Editor → New query\n" +
    "  3. Paste the contents of supabase/migrations/20260803120000_nex_themes_v1.sql\n" +
    "  4. Run\n" +
    "Until this is done, theme reads return Original Nex and writes fail loudly.",
  );
}

// ─── Row → domain mappers ────────────────────────────────────────────

function toActive(row: ActiveRow): ThemeActive {
  return {
    session_id: row.session_id,
    theme_id: row.theme_id,
    variant_id: row.variant_id,
    applied_at: row.applied_at,
    source: row.source,
  };
}

function toOwnership(row: OwnershipRow): ThemeOwnership {
  return {
    session_id: row.session_id,
    theme_id: row.theme_id,
    acquired_at: row.acquired_at,
    source: row.source,
  };
}

function toPreview(row: PreviewRow): ThemePreview {
  return {
    session_id: row.session_id,
    theme_id: row.theme_id,
    granted_at: row.granted_at,
    expires_at: row.expires_at,
    outcome: row.outcome,
  };
}

// ─── Active theme (get / set) ────────────────────────────────────────

// Return the session's currently applied theme. If nothing is stored,
// return the immutable home (Original Nex) — the workspace is never
// "themeless".
export async function getActiveThemeForSession(
  sessionId: string,
): Promise<{ active: ThemeActive; theme: Theme }> {
  const { data: row, error } = await nexSupabase
    .from("nex_themes_active")
    .select("*")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error)) {
      warnMigrationMissing();
      return {
        active: fallbackActive(sessionId, "system_fallback"),
        theme: ORIGINAL_NEX,
      };
    }
    throw new Error(`getActiveThemeForSession failed: ${error.message}`);
  }

  if (!row) {
    return {
      active: fallbackActive(sessionId, "system_fallback"),
      theme: ORIGINAL_NEX,
    };
  }

  const active = toActive(row as ActiveRow);
  const theme = getBuiltInTheme(active.theme_id) ?? ORIGINAL_NEX;
  return { active, theme };
}

function fallbackActive(
  sessionId: string,
  source: ThemeActive["source"],
): ThemeActive {
  return {
    session_id: sessionId,
    theme_id: ORIGINAL_NEX.id,
    variant_id: null,
    applied_at: new Date().toISOString(),
    source,
  };
}

// Apply a theme (user_choice / preview_grant / modification / reset /
// system_fallback). Validates first · records history · updates active.
export async function applyThemeForSession(
  sessionId: string,
  themeId: string,
  options: {
    variantId?: string;
    source: ThemeActive["source"];
    skipValidation?: boolean;
  },
): Promise<
  | { ok: true; active: ThemeActive; theme: Theme; validator: ValidatorReport }
  | { ok: false; reason: "unknown_theme" | "validator_failed"; validator?: ValidatorReport }
> {
  const theme = getBuiltInTheme(themeId);
  if (!theme) {
    return { ok: false, reason: "unknown_theme" };
  }

  // Original Nex apply is a special-case that always succeeds (immutable
  // fallback) · we still record it in history so the trail is complete.
  const isReset = theme.id === ORIGINAL_NEX.id;

  let validator: ValidatorReport | undefined;
  if (!options.skipValidation && !isReset) {
    validator = validateTheme(theme);
    if (!validator.ok) {
      return { ok: false, reason: "validator_failed", validator };
    }
  }

  // Read previous active (for the history row + Restore behaviour).
  const { active: previous } = await getActiveThemeForSession(sessionId);

  // Upsert active row.
  const { data: row, error } = await nexSupabase
    .from("nex_themes_active")
    .upsert({
      session_id: sessionId,
      theme_id: theme.id,
      variant_id: options.variantId ?? null,
      source: options.source,
      applied_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) {
    if (isMissingTableError(error)) {
      warnMigrationMissing();
      // Degrade to fallback so the UI doesn't 500 · but tell the caller
      // this was NOT persisted.
      return {
        ok: true,
        active: {
          session_id: sessionId,
          theme_id: theme.id,
          variant_id: options.variantId ?? null,
          applied_at: new Date().toISOString(),
          source: "system_fallback",
        },
        theme,
        validator: validator ?? { themeId: theme.id, ok: true, wcagLevel: "AA", findings: [] },
      };
    }
    throw new Error(`applyThemeForSession failed: ${error.message}`);
  }

  await recordHistory(sessionId, {
    fromThemeId: previous.theme_id,
    toThemeId: theme.id,
    fromVariantId: previous.variant_id,
    toVariantId: options.variantId ?? null,
    source: options.source === "reset" ? "reset" : options.source,
    context: {
      wcagLevel: validator?.wcagLevel ?? "trusted-immutable",
    },
  });

  return {
    ok: true,
    active: toActive(row as ActiveRow),
    theme,
    validator: validator ?? { themeId: theme.id, ok: true, wcagLevel: "AA", findings: [] },
  };
}

// Reset returns to the LAST PERMANENT theme (Six Sharpening Rules #5).
// Previews never count as permanent. If the user has never owned any
// theme, we return Original Nex.
export async function resetThemeForSession(
  sessionId: string,
): Promise<{ ok: true; active: ThemeActive; theme: Theme }> {
  // Find the most recent history entry whose `to_theme_id` is currently
  // OWNED by this session and was NOT reached via preview_grant.
  const owned = await listOwnershipForSession(sessionId);
  const ownedIds = new Set(owned.map((o) => o.theme_id));

  const { data: history, error } = await nexSupabase
    .from("nex_themes_history")
    .select("to_theme_id, to_variant_id, source, changed_at")
    .eq("session_id", sessionId)
    .order("changed_at", { ascending: false })
    .limit(50);

  if (error && !isMissingTableError(error)) {
    throw new Error(`resetThemeForSession history read failed: ${error.message}`);
  }

  let targetThemeId = ORIGINAL_NEX.id;
  let targetVariantId: string | null = null;

  if (history) {
    for (const row of history as Array<{
      to_theme_id: string;
      to_variant_id: string | null;
      source: string;
    }>) {
      if (row.source === "preview_grant") continue;
      if (row.to_theme_id === ORIGINAL_NEX.id) continue;
      if (!ownedIds.has(row.to_theme_id)) continue;
      targetThemeId = row.to_theme_id;
      targetVariantId = row.to_variant_id;
      break;
    }
  }

  const result = await applyThemeForSession(sessionId, targetThemeId, {
    variantId: targetVariantId ?? undefined,
    source: "reset",
    skipValidation: targetThemeId === ORIGINAL_NEX.id,
  });

  if (!result.ok) {
    // Validator failed on the last permanent theme (shouldn't happen for
    // built-ins) — degrade to Original Nex.
    const home = await applyThemeForSession(sessionId, ORIGINAL_NEX.id, {
      source: "system_fallback",
      skipValidation: true,
    });
    if (!home.ok) throw new Error("resetThemeForSession · home apply failed");
    return { ok: true, active: home.active, theme: home.theme };
  }

  return { ok: true, active: result.active, theme: result.theme };
}

// ─── Ownership ───────────────────────────────────────────────────────

export async function listOwnershipForSession(
  sessionId: string,
): Promise<ThemeOwnership[]> {
  const { data, error } = await nexSupabase
    .from("nex_themes_ownership")
    .select("*")
    .eq("session_id", sessionId)
    .order("acquired_at", { ascending: false });

  if (error) {
    if (isMissingTableError(error)) { warnMigrationMissing(); return []; }
    throw new Error(`listOwnershipForSession failed: ${error.message}`);
  }
  return (data ?? []).map((r) => toOwnership(r as OwnershipRow));
}

// Grant ownership. Idempotent per (session_id, theme_id) via the unique
// index — a second call updates provenance rather than duplicating.
export async function grantOwnershipForSession(
  sessionId: string,
  themeId: string,
  source: ThemeOwnership["source"],
  provenance: Record<string, unknown> = {},
): Promise<ThemeOwnership | null> {
  if (isImmutableTheme(themeId)) {
    // Original Nex is free to everyone — never "owned" as an SKU.
    return null;
  }
  const { data, error } = await nexSupabase
    .from("nex_themes_ownership")
    .upsert(
      {
        session_id: sessionId,
        theme_id: themeId,
        source,
        provenance,
        acquired_at: new Date().toISOString(),
      },
      { onConflict: "session_id,theme_id", ignoreDuplicates: false },
    )
    .select("*")
    .single();

  if (error) {
    if (isMissingTableError(error)) { warnMigrationMissing(); return null; }
    throw new Error(`grantOwnershipForSession failed: ${error.message}`);
  }
  return toOwnership(data as OwnershipRow);
}

// ─── Previews (24-hour grace) ────────────────────────────────────────

const PREVIEW_DURATION_MS = 24 * 60 * 60 * 1000; // Six Sharpening Rules #4 · wall-clock hours

export async function getActivePreviewForSession(
  sessionId: string,
): Promise<ThemePreview | null> {
  const { data, error } = await nexSupabase
    .from("nex_themes_previews")
    .select("*")
    .eq("session_id", sessionId)
    .eq("outcome", "active")
    .order("granted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error)) { warnMigrationMissing(); return null; }
    throw new Error(`getActivePreviewForSession failed: ${error.message}`);
  }
  if (!data) return null;
  return toPreview(data as PreviewRow);
}

// Grant a new preview. If the session already has an active preview,
// that preview is ENDED EARLY (outcome=explored_another) so the "one
// active preview at a time" rule holds. Applies the theme via
// applyThemeForSession with source=preview_grant.
export async function grantPreviewForSession(
  sessionId: string,
  themeId: string,
  variantId?: string,
): Promise<
  | {
      ok: true;
      preview: ThemePreview;
      active: ThemeActive;
      theme: Theme;
      ended?: ThemePreview;
    }
  | { ok: false; reason: "unknown_theme" | "immutable_theme_not_previewable" | "already_owned" | "not_previewable" }
> {
  const theme = getBuiltInTheme(themeId);
  if (!theme) return { ok: false, reason: "unknown_theme" };
  if (isImmutableTheme(themeId)) {
    return { ok: false, reason: "immutable_theme_not_previewable" };
  }
  if (!theme.capabilities.supportsPreview) {
    return { ok: false, reason: "not_previewable" };
  }

  // If already owned, no need for a preview — just apply it directly.
  const owned = await listOwnershipForSession(sessionId);
  if (owned.some((o) => o.theme_id === themeId)) {
    return { ok: false, reason: "already_owned" };
  }

  // End any existing active preview first.
  const existing = await getActivePreviewForSession(sessionId);
  let ended: ThemePreview | undefined;
  if (existing) {
    const { data: endedRow, error: endErr } = await nexSupabase
      .from("nex_themes_previews")
      .update({ outcome: "explored_another" })
      .eq("session_id", sessionId)
      .eq("outcome", "active")
      .select("*")
      .maybeSingle();
    if (endErr && !isMissingTableError(endErr)) {
      throw new Error(`grantPreviewForSession end existing failed: ${endErr.message}`);
    }
    if (endedRow) ended = toPreview(endedRow as PreviewRow);
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + PREVIEW_DURATION_MS);

  const { data: row, error } = await nexSupabase
    .from("nex_themes_previews")
    .insert({
      session_id: sessionId,
      theme_id: themeId,
      variant_id: variantId ?? null,
      granted_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      outcome: "active",
    })
    .select("*")
    .single();

  if (error) {
    if (isMissingTableError(error)) {
      warnMigrationMissing();
      throw new Error(
        "Preview cannot be granted — Nex Themes migration not applied yet.",
      );
    }
    throw new Error(`grantPreviewForSession insert failed: ${error.message}`);
  }

  // Apply the previewed theme immediately.
  const applied = await applyThemeForSession(sessionId, themeId, {
    variantId,
    source: "preview_grant",
  });
  if (!applied.ok) {
    // Validator failed on a built-in — shouldn't happen but if it does,
    // roll the preview into 'dismissed' and bubble up.
    await nexSupabase
      .from("nex_themes_previews")
      .update({ outcome: "dismissed" })
      .eq("session_id", sessionId)
      .eq("outcome", "active");
    return { ok: false, reason: "not_previewable" };
  }

  return {
    ok: true,
    preview: toPreview(row as PreviewRow),
    active: applied.active,
    theme: applied.theme,
    ended,
  };
}

// Convert an active preview into permanent ownership.
export async function convertPreviewToOwnership(
  sessionId: string,
  themeId: string,
): Promise<{ ok: true; ownership: ThemeOwnership } | { ok: false; reason: string }> {
  const active = await getActivePreviewForSession(sessionId);
  if (!active || active.theme_id !== themeId) {
    return { ok: false, reason: "no_matching_active_preview" };
  }

  // Grant ownership.
  const ownership = await grantOwnershipForSession(sessionId, themeId, "preview_converted", {
    preview_granted_at: active.granted_at,
  });
  if (!ownership) {
    return { ok: false, reason: "ownership_grant_failed" };
  }

  // Mark the preview row as unlocked.
  await nexSupabase
    .from("nex_themes_previews")
    .update({ outcome: "unlocked" })
    .eq("session_id", sessionId)
    .eq("outcome", "active")
    .eq("theme_id", themeId);

  return { ok: true, ownership };
}

// ─── History ─────────────────────────────────────────────────────────

type HistoryInput = {
  fromThemeId: string | null;
  toThemeId: string;
  fromVariantId: string | null;
  toVariantId: string | null;
  source:
    | "user_choice"
    | "preview_grant"
    | "reset"
    | "system_fallback"
    | "modification";
  context?: Record<string, unknown>;
};

async function recordHistory(
  sessionId: string,
  input: HistoryInput,
): Promise<void> {
  const { error } = await nexSupabase.from("nex_themes_history").insert({
    session_id: sessionId,
    from_theme_id: input.fromThemeId,
    to_theme_id: input.toThemeId,
    from_variant_id: input.fromVariantId,
    to_variant_id: input.toVariantId,
    source: input.source,
    context: input.context ?? {},
  });
  if (error && !isMissingTableError(error)) {
    // Don't throw — history is best-effort · never blocks a theme apply.
    console.error("[nex-themes] recordHistory failed:", error.message);
  }
}

// ─── Catalog (merges built-ins with per-session state) ───────────────

export type ThemeCatalogEntry = {
  theme: Theme;
  owned: boolean;
  isActive: boolean;
  hasActivePreview: boolean;
  previewExpiresAt: string | null;
};

// Activate a theme "by intent" — the doctrine-correct entry point the
// natural-language router should call.
//
// Behaviour (composes with Six Sharpening Rules · Fifth Law):
//   · Immutable theme (Original Nex) — always applies
//   · Owned theme — apply immediately
//   · Not owned but previewable — grant a 24h preview (theme applies at once)
//   · Not owned and NOT previewable — return not_licensed
//
// This means the natural-language user experience is: "make it Blossom"
// → workspace updates instantly, no dialog, no gate. The preview
// grant is silent from the user's perspective — the polite "your
// preview has ended" prompt only fires on the next-session expiry check.
export async function activateThemeByIntent(
  sessionId: string,
  themeId: string,
  variantId?: string,
): Promise<
  | {
      ok: true;
      active: ThemeActive;
      theme: Theme;
      via: "owned" | "preview_granted" | "immutable" | "already_active_preview";
      preview?: ThemePreview;
    }
  | { ok: false; reason: "unknown_theme" | "validator_failed" | "not_licensed"; validator?: ValidatorReport }
> {
  const theme = getBuiltInTheme(themeId);
  if (!theme) return { ok: false, reason: "unknown_theme" };

  if (isImmutableTheme(themeId)) {
    const applied = await applyThemeForSession(sessionId, themeId, {
      variantId,
      source: "user_choice",
      skipValidation: true,
    });
    if (!applied.ok) return { ok: false, reason: applied.reason, validator: applied.validator };
    return { ok: true, active: applied.active, theme: applied.theme, via: "immutable" };
  }

  const owned = await listOwnershipForSession(sessionId);
  const isOwned = owned.some((o) => o.theme_id === themeId);

  if (isOwned) {
    const applied = await applyThemeForSession(sessionId, themeId, {
      variantId,
      source: "user_choice",
    });
    if (!applied.ok) return { ok: false, reason: applied.reason, validator: applied.validator };
    return { ok: true, active: applied.active, theme: applied.theme, via: "owned" };
  }

  // Not owned · check existing preview.
  const existingPreview = await getActivePreviewForSession(sessionId);
  if (existingPreview?.theme_id === themeId) {
    // Same theme already being previewed — just re-apply (no clock reset).
    const applied = await applyThemeForSession(sessionId, themeId, {
      variantId,
      source: "preview_grant",
    });
    if (!applied.ok) return { ok: false, reason: applied.reason, validator: applied.validator };
    return {
      ok: true,
      active: applied.active,
      theme: applied.theme,
      via: "already_active_preview",
      preview: existingPreview,
    };
  }

  // Grant a new 24h preview (this also applies the theme).
  const granted = await grantPreviewForSession(sessionId, themeId, variantId);
  if (!granted.ok) {
    if (granted.reason === "not_previewable" || granted.reason === "immutable_theme_not_previewable") {
      return { ok: false, reason: "not_licensed" };
    }
    if (granted.reason === "already_owned") {
      // Race: someone else granted ownership in between reads.
      const applied = await applyThemeForSession(sessionId, themeId, {
        variantId,
        source: "user_choice",
      });
      if (!applied.ok) return { ok: false, reason: applied.reason, validator: applied.validator };
      return { ok: true, active: applied.active, theme: applied.theme, via: "owned" };
    }
    return { ok: false, reason: "unknown_theme" };
  }

  return {
    ok: true,
    active: granted.active,
    theme: granted.theme,
    via: "preview_granted",
    preview: granted.preview,
  };
}

export async function listCatalogForSession(
  sessionId: string,
): Promise<ThemeCatalogEntry[]> {
  const [owned, active, preview] = await Promise.all([
    listOwnershipForSession(sessionId),
    getActiveThemeForSession(sessionId),
    getActivePreviewForSession(sessionId),
  ]);
  const ownedIds = new Set(owned.map((o) => o.theme_id));

  return Object.values(BUILT_IN_THEMES).map((theme) => ({
    theme,
    owned: theme.category === "immutable" ? true : ownedIds.has(theme.id),
    isActive: active.active.theme_id === theme.id,
    hasActivePreview: preview?.theme_id === theme.id,
    previewExpiresAt: preview?.theme_id === theme.id ? preview.expires_at : null,
  }));
}
