"use server";

// src/app/nex-head-quarters/surface-health/_actions.ts
//
// §12 Item 3 · Server Actions for the HQ Surface-Health page.
//
// Two actions:
//   · transitionAction      · wraps Item 1 transitionLifecycle(id, 'investigating', …)
//                             preserving legal-transition + verify-while-active guards
//   · setKillSwitchAction   · wraps theme-kill-switch service (toggles nex_chat_theme.is_active)
//
// Both actions require NEX_HQ_ADMIN_TOKEN to be set in the environment
// AND the submitted admin_token form field to match. Matches the
// existing /api/nex/comms-social/controls admin convention · nothing
// mutates without the token.

import { revalidatePath } from "next/cache";
import { transitionLifecycle } from "@/lib/nex-native/surface-health-service";
import { setThemeKillSwitched } from "@/lib/nex-native/theme-kill-switch";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

function checkAdminToken(formToken: FormDataEntryValue | null): string | null {
  const envToken = process.env.NEX_HQ_ADMIN_TOKEN;
  if (!envToken || envToken.length < 8) {
    return "admin_token_missing_in_env";
  }
  if (typeof formToken !== "string" || formToken !== envToken) {
    return "unauthorized";
  }
  return null;
}

export async function transitionAction(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const authErr = checkAdminToken(form.get("admin_token"));
  if (authErr) return { ok: false, error: authErr };

  const id = form.get("id");
  const reason = form.get("reason");
  if (typeof id !== "string" || id.length === 0) {
    return { ok: false, error: "id_required" };
  }
  try {
    await transitionLifecycle(
      id,
      "investigating",
      typeof reason === "string" && reason.length > 0 ? reason : null,
    );
    revalidatePath("/nex-head-quarters/surface-health");
    return { ok: true };
  } catch {
    // Service-layer errors are logged by the service's own logger; we
    // return a generic code so no internal message detail is ever
    // reflected back through the Server Action channel (doctrine §7.4
    // · §8).
    return { ok: false, error: "service_error" };
  }
}

export async function setKillSwitchAction(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const authErr = checkAdminToken(form.get("admin_token"));
  if (authErr) return { ok: false, error: authErr };

  const theme_id = form.get("theme_id");
  const disabled_raw = form.get("disabled");
  const actor = form.get("actor");
  const reason = form.get("reason");
  if (typeof theme_id !== "string" || theme_id.length === 0) {
    return { ok: false, error: "theme_id_required" };
  }
  if (typeof actor !== "string" || actor.length === 0) {
    return { ok: false, error: "actor_required" };
  }
  const disabled =
    disabled_raw === "true" || disabled_raw === "1" || disabled_raw === "on";
  try {
    await setThemeKillSwitched({
      theme_id,
      disabled,
      actor,
      reason: typeof reason === "string" && reason.length > 0 ? reason : null,
    });
    revalidatePath("/nex-head-quarters/surface-health");
    return { ok: true };
  } catch {
    // Service-layer errors are logged by the service's own logger · we
    // return a generic code so no internal message detail is reflected
    // back through the Server Action channel (doctrine §7.4 · §8).
    // Matches the transitionAction catch block.
    return { ok: false, error: "service_error" };
  }
}
