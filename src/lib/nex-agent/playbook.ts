// src/lib/nex-agent/playbook.ts
//
// Playbook engine · records a sequence of founder actions in the workstation,
// serialises to JSON, replays them later. Enables macros for common workflows
// like "reset preview · pick mobile Pixel 8 · zoom 150% · switch to /login route".
//
// Actions are declarative · never bypass the security layer · every replay
// step is idempotent + subject to the same rate-limits + honeypots.

export type PlaybookAction =
  | { kind: "set-viewport"; value: "mobile" | "tablet" | "desktop" | "fluid" }
  | { kind: "set-zoom"; value: number }
  | { kind: "set-preview-url"; value: string }
  | { kind: "set-phone-model"; value: string }
  | { kind: "set-bezel-visible"; value: boolean }
  | { kind: "set-bezel-color"; value: string }
  | { kind: "set-custom-bezel-hex"; value: string }
  | { kind: "set-tab"; value: "history" | "code" }
  | { kind: "reload-preview" }
  | { kind: "prompt-submit"; prompt: string }
  | { kind: "delay-ms"; value: number };

export interface Playbook {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly createdAt: string;
  readonly createdBy: string;
  readonly actions: readonly PlaybookAction[];
}

const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9 _-]{1,60}$/;
const URL_RE = /^\/[A-Za-z0-9\/_:.?=&%-]{0,180}$/;

export type ValidationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: string };

export function validatePlaybook(p: Playbook): ValidationResult {
  if (!p.id) return { ok: false, reason: "id_required" };
  if (!NAME_RE.test(p.name)) return { ok: false, reason: "name_invalid · A-Z 0-9 space _ - only · 2-61 chars" };
  if (!Array.isArray(p.actions) || p.actions.length === 0) return { ok: false, reason: "actions_empty" };
  if (p.actions.length > 100) return { ok: false, reason: "actions_too_many · max 100" };
  for (const a of p.actions) {
    const r = validateAction(a);
    if (!r.ok) return r;
  }
  return { ok: true };
}

export function validateAction(a: PlaybookAction): ValidationResult {
  switch (a.kind) {
    case "set-viewport":
      if (!["mobile", "tablet", "desktop", "fluid"].includes(a.value)) return { ok: false, reason: "viewport_invalid" };
      return { ok: true };
    case "set-zoom":
      if (typeof a.value !== "number" || a.value < 0.25 || a.value > 3) return { ok: false, reason: "zoom_out_of_range · [0.25, 3]" };
      return { ok: true };
    case "set-preview-url":
      if (!URL_RE.test(a.value)) return { ok: false, reason: "url_invalid" };
      return { ok: true };
    case "set-phone-model":
      if (!/^[a-z0-9-]{2,40}$/.test(a.value)) return { ok: false, reason: "phone_model_invalid" };
      return { ok: true };
    case "set-bezel-visible":
      if (typeof a.value !== "boolean") return { ok: false, reason: "bezel_visible_invalid" };
      return { ok: true };
    case "set-bezel-color":
      if (!/^[a-z0-9-]{2,40}$/.test(a.value)) return { ok: false, reason: "bezel_color_invalid" };
      return { ok: true };
    case "set-custom-bezel-hex":
      if (!/^#[0-9a-fA-F]{6}$/.test(a.value)) return { ok: false, reason: "custom_bezel_hex_invalid" };
      return { ok: true };
    case "set-tab":
      if (!["history", "code"].includes(a.value)) return { ok: false, reason: "tab_invalid" };
      return { ok: true };
    case "reload-preview":
      return { ok: true };
    case "prompt-submit":
      if (typeof a.prompt !== "string" || a.prompt.trim().length < 1) return { ok: false, reason: "prompt_empty" };
      if (a.prompt.length > 8000) return { ok: false, reason: "prompt_too_long" };
      return { ok: true };
    case "delay-ms":
      if (typeof a.value !== "number" || a.value < 0 || a.value > 60000) return { ok: false, reason: "delay_out_of_range · [0, 60000]" };
      return { ok: true };
    default:
      return { ok: false, reason: "kind_unknown" };
  }
}
