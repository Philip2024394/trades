// Shared helpers for the per-module editors.

"use client";

export type ModuleFetchResult<T> =
  | { ok: true; payload: T; version: string; updatedAt: string; scaffold?: boolean }
  | { ok: false; error: string };

export async function fetchModule<T>(slug: string, module: string): Promise<ModuleFetchResult<T>> {
  const res  = await fetch(`/api/authors/brains/${slug}/modules/${module}`, { cache: "no-store" });
  const json = await res.json();
  if (!res.ok || !json.ok) return { ok: false, error: json.detail ?? json.error ?? `HTTP ${res.status}` };
  return {
    ok:        true,
    payload:   json.payload as T,
    version:   json.version ?? "0.1.0",
    updatedAt: json.updated_at ?? "",
    scaffold:  json.scaffold ?? false
  };
}

export async function saveModule<T>(slug: string, module: string, payload: T, version = "0.1.0"): Promise<{ ok: true } | { ok: false; error: string }> {
  const res  = await fetch(`/api/authors/brains/${slug}/modules/${module}`, {
    method:  "PUT",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ payload, version })
  });
  const json = await res.json();
  if (!res.ok || !json.ok) return { ok: false, error: json.detail ?? json.error ?? `HTTP ${res.status}` };
  return { ok: true };
}

/** Standard input class — used across every editor for consistency. */
export const INPUT_CLASS =
  "mt-1 w-full rounded border border-[#0A0A0A]/20 bg-[#FBF6EC] px-2 py-1.5 text-sm";

export const BUTTON_PRIMARY =
  "rounded bg-[#166534] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50";

export const BUTTON_SECONDARY =
  "rounded border border-[#0A0A0A]/20 bg-white px-3 py-1.5 text-xs font-medium";

export function newId(prefix: string): string {
  return `${prefix}.${Math.random().toString(36).slice(2, 8)}`;
}
