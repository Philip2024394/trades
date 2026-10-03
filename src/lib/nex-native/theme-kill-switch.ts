// src/lib/nex-native/theme-kill-switch.ts
//
// §12 Item 3 · theme kill-switch service.
//
// Operates at the VISUAL THEME level per sealed doctrine §12 Item 3.
// Reuses the existing nex_chat_theme.is_active column (migration 048)
// as the authoritative "theme available" flag — no new table, no new
// migration. Toggling is_active=false:
//   · removes the theme from listActiveThemes()
//   · causes getThemeById() to return null (callers already fall back
//     to the default theme per Item 1 audit)
//   · signals the pilot page to render the SafeFallbackRenderer via
//     the Tier 2 VisualThemeBoundary's forceFallback prop
//
// Audit trail uses the existing /api/nex/events bus per sealed doctrine
// §9 reuse. No parallel audit store.
//
// This module does NOT disable chat_surface — only visual_theme. The
// doctrine's conversation-continuity invariant is preserved by Tier 1
// Chat Core + Tier 2 Visual Theme Boundary + SafeFallbackRenderer, all
// of which remain in place and reachable.

import "server-only";
import { nexSupabaseAdmin } from "./supabase-admin";
import { logger } from "@/lib/nex/observability/logger";

const log = logger("nex-native.theme-kill-switch");

export interface ThemeKillSwitchStatus {
  theme_id: string;
  theme_name: string;
  is_active: boolean;
  is_kill_switched: boolean; // convenience: !is_active
  updated_at: string;
}

/** §12 Item 3 · Finding #2 fail-safe wrapper. Resolves the kill-switch
 *  state with service-layer resilience: on any lookup failure, logs a
 *  normalized diagnostic (no raw error.message, no stack) and returns
 *  the safe default of `false` (theme NOT considered kill-switched)
 *  so pilot page renders degrade gracefully rather than crashing.
 *
 *  Doctrine §5a · service/network/storage failures remain governed by
 *  their own resilience mechanisms — this is that mechanism for the
 *  kill-switch lookup. §4 invariant is preserved: the pilot page
 *  continues to render, essential chat continues, and HQ retains the
 *  authoritative evidence that the lookup failed (via the logger).
 *
 *  Callers who need to observe a lookup failure directly should use
 *  the throwing isThemeKillSwitched below instead. */
export async function isThemeKillSwitchedSafe(theme_id: string): Promise<boolean> {
  try {
    return await isThemeKillSwitched(theme_id);
  } catch {
    log.error("kill_switch_lookup_failed", {
      theme_id,
      safe_default: "not_kill_switched",
    });
    return false;
  }
}

/** True when the given theme is currently kill-switched (is_active=false). */
export async function isThemeKillSwitched(theme_id: string): Promise<boolean> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_chat_theme")
    .select("is_active")
    .eq("id", theme_id)
    .maybeSingle();
  if (error) {
    throw new Error(
      `theme-kill-switch.isThemeKillSwitched: ${error.message}`,
    );
  }
  if (!data) return false; // theme row absent · treat as not kill-switched
  return (data as { is_active: boolean }).is_active === false;
}

/** Enumerate every known theme with its kill-switch status · for HQ UI. */
export async function listThemeKillSwitchStatus(): Promise<ThemeKillSwitchStatus[]> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_chat_theme")
    .select("id, name, is_active, updated_at")
    .order("name", { ascending: true });
  if (error) {
    throw new Error(
      `theme-kill-switch.listThemeKillSwitchStatus: ${error.message}`,
    );
  }
  return (data ?? []).map((raw) => {
    const row = raw as {
      id: string;
      name: string;
      is_active: boolean;
      updated_at: string;
    };
    return {
      theme_id: row.id,
      theme_name: row.name,
      is_active: row.is_active,
      is_kill_switched: row.is_active === false,
      updated_at: row.updated_at,
    };
  });
}

export interface SetKillSwitchInput {
  theme_id: string;
  /** true = disable (kill-switch active) · false = re-enable the theme */
  disabled: boolean;
  /** Who performed the toggle · short admin label · max 64 chars */
  actor: string;
  /** Optional short admin reason · max 240 chars · no raw error text */
  reason?: string | null;
}

/** Toggle a theme's kill-switch state. Preserves is_active row semantics
 *  (migration 048) and emits a theme_kill_switch event to the existing
 *  event bus for audit trail. Returns the resulting status. */
export async function setThemeKillSwitched(
  input: SetKillSwitchInput,
): Promise<ThemeKillSwitchStatus> {
  if (!input.theme_id || typeof input.theme_id !== "string") {
    throw new Error("theme-kill-switch.setThemeKillSwitched: theme_id required");
  }
  if (typeof input.disabled !== "boolean") {
    throw new Error("theme-kill-switch.setThemeKillSwitched: disabled must be boolean");
  }
  if (!input.actor || input.actor.length > 64) {
    throw new Error(
      "theme-kill-switch.setThemeKillSwitched: actor required · max 64 chars",
    );
  }
  if (input.reason && input.reason.length > 240) {
    throw new Error(
      "theme-kill-switch.setThemeKillSwitched: reason exceeds 240 chars · raw error text or conversation content is forbidden",
    );
  }

  const target_active = !input.disabled;

  const { data, error } = await nexSupabaseAdmin
    .from("nex_chat_theme")
    .update({ is_active: target_active })
    .eq("id", input.theme_id)
    .select("id, name, is_active, updated_at")
    .single();
  if (error || !data) {
    throw new Error(
      `theme-kill-switch.setThemeKillSwitched: ${error?.message ?? "theme not found"}`,
    );
  }

  // Emit audit event via existing event bus · fire-and-forget.
  void emitKillSwitchEvent({
    theme_id: input.theme_id,
    disabled: input.disabled,
    actor: input.actor,
    reason: input.reason ?? null,
  }).catch(() => {
    /* audit emission is best-effort · the DB write is authoritative */
  });

  log.info("theme_kill_switch_toggled", {
    theme_id: input.theme_id,
    disabled: input.disabled,
    actor: input.actor,
  });

  const row = data as {
    id: string;
    name: string;
    is_active: boolean;
    updated_at: string;
  };
  return {
    theme_id: row.id,
    theme_name: row.name,
    is_active: row.is_active,
    is_kill_switched: row.is_active === false,
    updated_at: row.updated_at,
  };
}

interface EmitInput {
  theme_id: string;
  disabled: boolean;
  actor: string;
  reason: string | null;
}

async function emitKillSwitchEvent(input: EmitInput): Promise<void> {
  // Resolve the base URL from env or default to localhost · in server
  // runtime the dev server's own origin is reachable via loopback.
  const base =
    process.env.NEX_PUBLIC_APP_BASE_URL ??
    process.env.NEXT_PUBLIC_APP_BASE_URL ??
    "http://localhost:3008";
  try {
    await fetch(`${base}/api/nex/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        event_type: "theme_kill_switch",
        source: "human",
        actor_id: input.actor,
        outcome: input.disabled ? "informational" : "informational",
        payload: {
          theme_id: input.theme_id,
          disabled: input.disabled,
          reason: input.reason,
        },
      }),
      // Short timeout so a slow bus doesn't block the admin UI.
      signal: AbortSignal.timeout(2000),
    });
  } catch {
    /* best-effort · DB is authoritative */
  }
}
