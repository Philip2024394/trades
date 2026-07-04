"use client";

// Personal button library — read + delete UI.
//
// Cards render the saved button live (variantKey + persisted config +
// state/motion/shape overrides). Delete requires a confirm — a saved
// button might be referenced from multiple pages so we don't nuke
// silently.

import { useCallback, useEffect, useState } from "react";
import { buttonRegistry } from "@/platform/buttons";
import "@/platform/buttons";
import { fetchWithRetry } from "@/lib/studio/fetchWithRetry";
import type { BrandTokens, MerchantData } from "@/lib/studio/sectionTypes";

const YELLOW = "#FFB300";
const RED = "#DC2626";

type SavedButton = {
  id: string;
  name: string;
  role: string;
  variantKey: string;
  config: Record<string, unknown>;
  usageCount: number;
  scope: string;
  createdAt: string;
};

export function PersonalButtonsPanel({
  merchantTokens,
  merchantData
}: {
  merchantTokens: BrandTokens;
  merchantData: MerchantData;
}) {
  const [items, setItems] = useState<SavedButton[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/studio/saved-buttons");
      const json = (await res.json()) as
        | { ok: true; items: SavedButton[] }
        | { ok: false; error: string };
      if (!json.ok) throw new Error(json.error);
      setItems(json.items);
    } catch (err) {
      setError((err as Error).message ?? "network");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function deleteItem(id: string) {
    setPendingDelete(id);
    try {
      const res = await fetchWithRetry(`/api/studio/saved-buttons/${id}`, {
        method: "DELETE"
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!json.ok) throw new Error(json.error ?? "delete-failed");
      setItems((prev) => prev?.filter((i) => i.id !== id) ?? []);
    } catch (err) {
      setError((err as Error).message ?? "delete-failed");
    } finally {
      setPendingDelete(null);
    }
  }

  if (items === null) {
    return (
      <p className="p-8 text-center text-[13px] text-neutral-500">Loading…</p>
    );
  }

  if (error) {
    return (
      <p role="alert" className="p-8 text-center text-[13px] text-red-600">
        {error}
      </p>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mt-4 rounded-2xl border-2 border-dashed border-neutral-300 bg-neutral-50 p-16 text-center">
        <p className="text-[13px] font-bold text-neutral-600">
          You haven't saved any buttons yet.
        </p>
        <p className="mt-2 max-w-md text-[11px] text-neutral-500">
          Save any button from the Library as a personal component. It'll
          appear here, ready to drop on any page, with its label + link
          preserved.
        </p>
      </div>
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {items.map((it) => {
        const reg = buttonRegistry.get(it.variantKey);
        return (
          <li key={it.id}>
            <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
              <div
                className="flex min-h-[112px] items-center justify-center border-b border-neutral-100 p-6"
                style={{ background: "#FAFAFA" }}
              >
                {reg ? (
                  <reg.renderer
                    instanceId={`saved-${it.id}`}
                    config={it.config}
                    state="default"
                    tokens={merchantTokens}
                    role={reg.role}
                    size={reg.size}
                    shape={reg.shape}
                    motion={reg.motion}
                    data={merchantData}
                    mode="preview"
                  />
                ) : (
                  <p className="text-[11px] text-neutral-400">
                    Variant unavailable
                  </p>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-2 p-4">
                <p
                  className="text-[9px] font-extrabold uppercase tracking-widest"
                  style={{ color: YELLOW }}
                >
                  {it.role} · {it.scope}
                </p>
                <h3 className="text-[13px] font-extrabold text-neutral-900">
                  {it.name}
                </h3>
                <p className="truncate font-mono text-[10px] text-neutral-400">
                  {it.variantKey} · used {it.usageCount}×
                </p>
                <div className="mt-auto flex items-center justify-between pt-2">
                  <p className="text-[10px] text-neutral-500">
                    Saved{" "}
                    {new Date(it.createdAt).toLocaleDateString(undefined, {
                      day: "2-digit",
                      month: "short",
                      year: "numeric"
                    })}
                  </p>
                  <button
                    type="button"
                    onClick={() => deleteItem(it.id)}
                    disabled={pendingDelete === it.id}
                    className="inline-flex h-8 items-center rounded-md px-3 text-[10px] font-extrabold uppercase tracking-widest text-white transition disabled:cursor-not-allowed disabled:opacity-40"
                    style={{ background: RED }}
                  >
                    {pendingDelete === it.id ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </div>
            </article>
          </li>
        );
      })}
    </ul>
  );
}

/** Small helper any button toolbar can call to save the current
 *  instance. Returns { ok, id } — caller shows a toast. */
export async function saveButton(payload: {
  name: string;
  variantKey: string;
  role: string;
  config: Record<string, unknown>;
  states?: Record<string, unknown>;
  motion?: Record<string, unknown>;
  shape?: Record<string, unknown>;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const res = await fetchWithRetry("/api/studio/saved-buttons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const json = (await res.json()) as
      | { ok: true; item: { id: string } }
      | { ok: false; error: string };
    if (!json.ok) return { ok: false, error: json.error };
    return { ok: true, id: json.item.id };
  } catch (err) {
    return { ok: false, error: (err as Error).message ?? "network" };
  }
}
