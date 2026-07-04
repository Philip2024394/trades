// Button-scoped AI helpers.
//
// Three merchant-facing verbs mapped to AI Gateway tasks:
//   improveCopy   — rewrite label into verb-first, ≤5 words
//   restyle       — return a style-family suggestion (Modern/Bold/Luxury/…)
//   suggestIcon   — pick an icon that matches the label's verb
//
// Every call posts to /api/ai/complete with the button's registration
// metadata + current config in `payload.buttonContext`. Providers can
// ONLY patch fields declared in editableFields — the response is
// validated client-side before commit.

import type { FrozenButtonRegistration } from "../types";

const AI_ENDPOINT = "/api/ai/complete";

// ─── Response envelopes ─────────────────────────────────────

export type AiPatchDiff = {
  /** Keys we're about to overwrite on the button's config. */
  patch: Record<string, unknown>;
  /** One-line summary the toolbar shows next to the confirm button. */
  rationale: string;
  /** True if the provider returned a valid patch. False → merchant sees
   *  the error banner and no commit. */
  ok: boolean;
  error?: string;
};

// ─── Public verbs ──────────────────────────────────────────

export async function improveCopy(args: {
  registration: FrozenButtonRegistration;
  config: Record<string, unknown>;
  brandName?: string;
  vertical?: string;
  merchantId?: string;
  brandId?: string;
}): Promise<AiPatchDiff> {
  return callAi({
    task: "button.improveCopy",
    prompt: args.registration.aiPrompts.improveCopy,
    payload: buttonContext(args),
    merchantId: args.merchantId,
    brandId: args.brandId
  });
}

export async function restyle(args: {
  registration: FrozenButtonRegistration;
  config: Record<string, unknown>;
  targetMood: string;
  merchantId?: string;
  brandId?: string;
}): Promise<AiPatchDiff> {
  return callAi({
    task: "button.restyle",
    prompt: args.registration.aiPrompts.restyle.replace(
      "{mood}",
      args.targetMood
    ),
    payload: {
      ...buttonContext(args),
      targetMood: args.targetMood
    },
    merchantId: args.merchantId,
    brandId: args.brandId
  });
}

export async function suggestIcon(args: {
  registration: FrozenButtonRegistration;
  config: Record<string, unknown>;
  merchantId?: string;
  brandId?: string;
}): Promise<AiPatchDiff> {
  return callAi({
    task: "button.suggestIcon",
    prompt: args.registration.aiPrompts.suggestIcon,
    payload: buttonContext(args),
    merchantId: args.merchantId,
    brandId: args.brandId
  });
}

// ─── Internals ─────────────────────────────────────────────

/** Serialise a button registration + current config into a compact
 *  payload the provider can ground on. Never sends private tokens or
 *  URLs beyond the merchant's own href. */
function buttonContext(args: {
  registration: FrozenButtonRegistration;
  config: Record<string, unknown>;
  brandName?: string;
  vertical?: string;
}) {
  return {
    buttonContext: {
      variantKey: args.registration.id,
      role: args.registration.role,
      category: args.registration.category,
      currentConfig: args.config,
      editableFieldKeys: args.registration.editableFields.map((f) => ({
        key: f.key,
        role: f.role ?? null,
        type: f.type.kind,
        aiPromptable: !!f.aiPromptable
      })),
      brandName: args.brandName ?? null,
      vertical: args.vertical ?? null
    }
  };
}

async function callAi(args: {
  task: string;
  prompt: string;
  payload: Record<string, unknown>;
  merchantId?: string;
  brandId?: string;
}): Promise<AiPatchDiff> {
  try {
    const res = await fetch(AI_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        task: args.task,
        prompt: args.prompt,
        payload: args.payload,
        context: {
          merchantId: args.merchantId,
          brandId: args.brandId
        }
      })
    });
    const json = (await res.json()) as
      | { ok: true; patch: Record<string, unknown>; rationale?: string }
      | { ok: false; error: { code: string; reason?: string } };
    if (!json.ok) {
      return {
        ok: false,
        patch: {},
        rationale: "",
        error: json.error?.code ?? "unknown"
      };
    }
    return {
      ok: true,
      patch: json.patch,
      rationale: json.rationale ?? "No rationale provided."
    };
  } catch (err) {
    return {
      ok: false,
      patch: {},
      rationale: "",
      error: (err as Error).message ?? "network"
    };
  }
}

// ─── Client-side patch validator ───────────────────────────

/** Reject any AI patch that touches keys not declared on the button's
 *  editableFields. Called BEFORE commit. Never allow the AI to invent
 *  fields — the manifest is the schema. */
export function validatePatchAgainstManifest(
  registration: FrozenButtonRegistration,
  patch: Record<string, unknown>
): { ok: true } | { ok: false; unknownKeys: string[] } {
  const allowed = new Set(registration.editableFields.map((f) => f.key));
  const unknown = Object.keys(patch).filter((k) => !allowed.has(k));
  if (unknown.length > 0) return { ok: false, unknownKeys: unknown };
  return { ok: true };
}
