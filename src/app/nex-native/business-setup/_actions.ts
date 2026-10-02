"use server";

// src/app/nex-native/business-setup/_actions.ts
//
// Phase 2 Business NEX Activation · server actions.
// Rev 6 FROZEN · clarifications 1-4 (2026-10-02).
//
// Two server actions live here:
//
//   saveBusinessActivationAction(draft)
//     First-time activation OR override edit.
//     Writes `profile`, computes override diffs vs recommendations,
//     writes only the diffs. Never writes a NULL profile.
//
//   reclassifyBusinessAction(new_profile)
//     Post-activation profile change. Writes ONLY `profile`.
//     Owner overrides are never touched. Content never deleted.
//
// Both go through the authorization gate from _authorization.ts.
// Both reuse the Phase 1 engine for recommendation diffs.

import { revalidatePath } from "next/cache";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import {
  BusinessAuthorizationError,
  assertCanActivateBusinessFor,
  assertCanWriteBusinessConfig,
} from "@/lib/nex-native/business/_authorization";
import type {
  BusinessProfile,
  CapabilityKey,
  ContentTypeKey,
  CtaIntent,
} from "@/lib/nex-native/business/types";
import { getRecommendedCapabilities } from "@/lib/nex-native/business/capabilities";
import { getRecommendedContentTypes } from "@/lib/nex-native/business/content";
import { subtypesOfProfile } from "@/lib/nex-native/business/engine";
import { BUSINESS_SUBTYPES } from "@/lib/nex-native/business/subtypes";
import { AVAILABLE_CAPABILITIES } from "@/lib/nex-native/business/capabilities";
import { AVAILABLE_CONTENT_TYPES } from "@/lib/nex-native/business/content";

const VALID_CTA_INTENTS: ReadonlySet<string> = new Set([
  "order", "book", "appointment", "reserve",
  "enquire", "quote", "callback", "buy",
]);

export interface SaveActivationInput {
  profile: BusinessProfile;
  capability_wizard_toggle: Partial<Record<CapabilityKey, boolean>>;
  content_wizard_toggle: Partial<Record<ContentTypeKey, boolean>>;
  cta_preference: CtaIntent | null;
}

export interface SaveActivationResult {
  ok: boolean;
  business_id?: string;
  wrote: {
    profile: boolean;
    capability_overrides: Record<string, boolean> | null;
    content_overrides: Record<string, boolean> | null;
    cta_preference: CtaIntent | null;
  };
  error?: { code: string; message: string };
}

// -----------------------------------------------------------------------------
// Validation
// -----------------------------------------------------------------------------

function validateProfile(p: BusinessProfile): string | null {
  if (!p || typeof p !== "object") return "profile missing";
  if (!p.primary || typeof p.primary !== "object") return "primary missing";
  if (!(BUSINESS_SUBTYPES as readonly string[]).includes(p.primary.subtype)) {
    return `unknown primary subtype: ${p.primary.subtype}`;
  }
  if (!Array.isArray(p.secondary)) return "secondary must be an array";
  for (const s of p.secondary) {
    if (!(BUSINESS_SUBTYPES as readonly string[]).includes(s.subtype)) {
      return `unknown secondary subtype: ${s.subtype}`;
    }
  }
  return null;
}

function validateToggles(
  toggles: Record<string, boolean>,
  allowed: readonly string[],
  label: string,
): string | null {
  for (const [k, v] of Object.entries(toggles)) {
    if (!allowed.includes(k)) return `${label}: unknown key '${k}'`;
    if (typeof v !== "boolean") return `${label}: '${k}' must be boolean`;
  }
  return null;
}

// -----------------------------------------------------------------------------
// Diff compute (Option B · explicit toggles only · recommended + untouched → no override)
// -----------------------------------------------------------------------------

/** Compute the override diff vs recommendations. For each toggled key:
 *   · wizard says true  + recommended → NO override
 *   · wizard says false + recommended → override: false
 *   · wizard says true  + not recommended → override: true
 *   · wizard says false + not recommended → NO override
 *  Returns an object (possibly empty) or null if the result would be empty. */
function diffOverrides<K extends string>(
  toggles: Partial<Record<K, boolean>>,
  recommended: readonly K[],
): Record<K, boolean> | null {
  const recSet = new Set(recommended);
  const out: Partial<Record<K, boolean>> = {};
  for (const [key, val] of Object.entries(toggles) as [K, boolean][]) {
    const isRecommended = recSet.has(key);
    if (val === true && isRecommended) continue;
    if (val === false && !isRecommended) continue;
    out[key] = val;
  }
  return Object.keys(out).length === 0 ? null : (out as Record<K, boolean>);
}

// -----------------------------------------------------------------------------
// Save activation
// -----------------------------------------------------------------------------

export async function saveBusinessActivationAction(
  input: SaveActivationInput,
): Promise<SaveActivationResult> {
  try {
    const session = await resolveNexAppSessionFromContext();
    if (!session) {
      return {
        ok: false,
        wrote: emptyWrote(),
        error: { code: "unauthenticated", message: "Sign in to activate." },
      };
    }

    // Phase 2 pragmatic path · if the owner has no nex_business row yet,
    // create a minimal shell on activation (display_name from the account,
    // auto-slug). A dedicated "name your shop" step can refine this later.
    const { data: existing, error: fetchErr } = await nexSupabaseAdmin
      .from("nex_business")
      .select("id")
      .eq("owner_account_id", session.account.id)
      .maybeSingle();
    if (fetchErr) {
      return {
        ok: false,
        wrote: emptyWrote(),
        error: { code: "db_read_failed", message: fetchErr.message },
      };
    }

    let business_id: string;
    if (existing?.id) {
      business_id = await assertCanActivateBusinessFor(session, existing.id);
    } else {
      // Create a minimal shell row on activation. Owner can edit the
      // display_name later via /manage/business.
      const businessService = await import("@/lib/nex-native/business-service");
      const displayName = session.account.display_name || "My Business";
      const baseSlug = (session.account.nex_handle || session.account.id)
        .toString()
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 48) || `b-${Date.now().toString(36)}`;
      const row = await businessService.createBusiness({
        owner_account_id: session.account.id,
        display_name: displayName,
        slug: baseSlug,
      });
      business_id = row.id;
    }

    // Validate shape
    const profileErr = validateProfile(input.profile);
    if (profileErr) {
      return { ok: false, wrote: emptyWrote(), error: { code: "invalid_profile", message: profileErr } };
    }
    const capErr = validateToggles(
      input.capability_wizard_toggle as Record<string, boolean>,
      AVAILABLE_CAPABILITIES,
      "capability_wizard_toggle",
    );
    if (capErr) {
      return { ok: false, wrote: emptyWrote(), error: { code: "invalid_capability_toggles", message: capErr } };
    }
    const contentErr = validateToggles(
      input.content_wizard_toggle as Record<string, boolean>,
      AVAILABLE_CONTENT_TYPES,
      "content_wizard_toggle",
    );
    if (contentErr) {
      return { ok: false, wrote: emptyWrote(), error: { code: "invalid_content_toggles", message: contentErr } };
    }
    if (input.cta_preference !== null && !VALID_CTA_INTENTS.has(input.cta_preference)) {
      return {
        ok: false,
        wrote: emptyWrote(),
        error: {
          code: "invalid_cta_preference",
          message: `unknown cta_preference: ${input.cta_preference}`,
        },
      };
    }

    // Compute override diffs
    const subtypes = subtypesOfProfile(input.profile);
    const recCapabilities = getRecommendedCapabilities(subtypes);
    const recContent = getRecommendedContentTypes(subtypes);
    const capOverrides = diffOverrides<CapabilityKey>(input.capability_wizard_toggle, recCapabilities);
    const contentOverrides = diffOverrides<ContentTypeKey>(input.content_wizard_toggle, recContent);

    // One atomic update · profile is non-null · owner overrides written as
    // minimal object or null · cta_preference written as string or null.
    const { error } = await nexSupabaseAdmin
      .from("nex_business")
      .update({
        profile: input.profile,
        capability_overrides: capOverrides,
        content_overrides: contentOverrides,
        cta_preference: input.cta_preference,
      })
      .eq("id", business_id);

    if (error) {
      return {
        ok: false,
        wrote: emptyWrote(),
        error: { code: "db_write_failed", message: error.message },
      };
    }

    revalidatePath("/nex-native/home");
    revalidatePath("/nex-native/settings");

    return {
      ok: true,
      business_id,
      wrote: {
        profile: true,
        capability_overrides: capOverrides,
        content_overrides: contentOverrides,
        cta_preference: input.cta_preference,
      },
    };
  } catch (e) {
    if (e instanceof BusinessAuthorizationError) {
      return {
        ok: false,
        wrote: emptyWrote(),
        error: { code: e.code, message: e.message },
      };
    }
    throw e;
  }
}

// -----------------------------------------------------------------------------
// Reclassify (post-activation profile change)
// -----------------------------------------------------------------------------

export interface ReclassifyResult {
  ok: boolean;
  error?: { code: string; message: string };
}

export async function reclassifyBusinessAction(
  new_profile: BusinessProfile,
): Promise<ReclassifyResult> {
  try {
    const session = await resolveNexAppSessionFromContext();
    if (!session) {
      return { ok: false, error: { code: "unauthenticated", message: "Sign in required." } };
    }
    const { data: ownerRow, error: fetchErr } = await nexSupabaseAdmin
      .from("nex_business")
      .select("id, profile")
      .eq("owner_account_id", session.account.id)
      .maybeSingle();
    if (fetchErr) {
      return { ok: false, error: { code: "db_read_failed", message: fetchErr.message } };
    }
    if (!ownerRow) {
      return { ok: false, error: { code: "business_not_found", message: "No business row." } };
    }
    if (ownerRow.profile === null) {
      return {
        ok: false,
        error: {
          code: "not_activated",
          message: "Activate Business NEX first via /business-setup.",
        },
      };
    }
    await assertCanWriteBusinessConfig(session, ownerRow.id);

    const profileErr = validateProfile(new_profile);
    if (profileErr) {
      return { ok: false, error: { code: "invalid_profile", message: profileErr } };
    }

    // Reclassify writes ONLY profile. Overrides survive. Content untouched.
    const { error } = await nexSupabaseAdmin
      .from("nex_business")
      .update({ profile: new_profile })
      .eq("id", ownerRow.id);
    if (error) {
      return { ok: false, error: { code: "db_write_failed", message: error.message } };
    }

    revalidatePath("/nex-native/home");
    revalidatePath("/nex-native/manage");

    return { ok: true };
  } catch (e) {
    if (e instanceof BusinessAuthorizationError) {
      return { ok: false, error: { code: e.code, message: e.message } };
    }
    throw e;
  }
}

function emptyWrote(): SaveActivationResult["wrote"] {
  return {
    profile: false,
    capability_overrides: null,
    content_overrides: null,
    cta_preference: null,
  };
}
