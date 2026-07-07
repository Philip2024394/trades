// Admin UI for managing the AI Visualiser provider config. Only one
// row can be enabled at a time — the DB has a partial unique index.

"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, Loader2, Save, KeyRound } from "lucide-react";

type ProviderRow = {
  id: string;
  provider_id: string;
  display_name: string;
  model_id: string | null;
  enabled: boolean;
  cost_per_render_pence: number;
  last_tested_at: string | null;
  last_test_ok: boolean | null;
  last_test_error: string | null;
  has_key: boolean;
};

type KnownProvider = {
  id: string;
  label: string;
  defaultModel: string;
};

export function ProviderConfigPanel({
  providers,
  knownProviders
}: {
  providers: ProviderRow[];
  knownProviders: KnownProvider[];
}) {
  const [rows, setRows] = useState<ProviderRow[]>(providers);
  const [busy, setBusy] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<Record<string, string>>({});
  const [editingModel, setEditingModel] = useState<Record<string, string>>({});
  const [flash, setFlash] = useState<{ id: string; msg: string; ok: boolean } | null>(null);

  const knownById = new Map(knownProviders.map((p) => [p.id, p]));

  async function save(
    providerId: string,
    action: "upsert" | "enable" | "disable" | "test"
  ) {
    setBusy(providerId + ":" + action);
    setFlash(null);
    try {
      const key = editingKey[providerId];
      const model = editingModel[providerId];
      const res = await fetch("/api/admin/apps/ai-visualiser/providers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action,
          providerId,
          apiKey: key || undefined,
          modelId: model || undefined,
          displayName:
            knownById.get(providerId)?.label || providerId
        })
      });
      const data: {
        ok: boolean;
        error?: string;
        row?: ProviderRow;
        rows?: ProviderRow[];
      } = await res.json();
      if (!data.ok) {
        setFlash({
          id: providerId,
          msg: data.error || "Save failed.",
          ok: false
        });
        return;
      }
      if (data.rows) setRows(data.rows);
      setFlash({
        id: providerId,
        msg:
          action === "test"
            ? "Provider reachable."
            : action === "enable"
              ? "Enabled."
              : action === "disable"
                ? "Disabled."
                : "Saved.",
        ok: true
      });
      setEditingKey((s) => ({ ...s, [providerId]: "" }));
    } catch {
      setFlash({ id: providerId, msg: "Network error.", ok: false });
    } finally {
      setBusy(null);
    }
  }

  const merged = knownProviders.map((k) => {
    const row = rows.find((r) => r.provider_id === k.id);
    return {
      known: k,
      row: row || null
    };
  });

  return (
    <section>
      <h2 className="text-xl font-semibold">Provider configuration</h2>
      <p className="mt-1 text-[13px] text-neutral-600">
        Only one provider can be enabled at a time. The API key is
        stored write-only — you cannot read it back after saving.
      </p>
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {merged.map(({ known, row }) => {
          const enabled = row?.enabled ?? false;
          const hasKey = row?.has_key ?? false;
          const isBusy = busy?.startsWith(known.id + ":");
          const flashHere = flash?.id === known.id;

          return (
            <div
              key={known.id}
              className={`rounded-xl border p-4 shadow-sm ${
                enabled
                  ? "border-amber-300 bg-amber-50"
                  : "border-neutral-200 bg-white"
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <div>
                  <div className="text-[13px] font-semibold uppercase tracking-wide text-neutral-500">
                    {known.id}
                  </div>
                  <div className="text-[15px] font-semibold">
                    {known.label}
                  </div>
                </div>
                {enabled ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-neutral-900 px-2 py-0.5 text-[13px] font-semibold text-white">
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                    Live
                  </span>
                ) : (
                  <span className="text-[13px] text-neutral-500">Off</span>
                )}
              </div>

              <div className="mt-3 space-y-2 text-[13px]">
                <div className="flex items-center justify-between">
                  <span className="text-neutral-600">API key</span>
                  <span
                    className={`font-mono text-[13px] ${
                      hasKey ? "text-neutral-900" : "text-neutral-400"
                    }`}
                  >
                    {hasKey ? "•••• stored" : "not set"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-600">Model</span>
                  <span className="font-mono text-[13px] text-neutral-800">
                    {row?.model_id || known.defaultModel}
                  </span>
                </div>
                {row?.last_tested_at ? (
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-600">Last test</span>
                    <span
                      className={`inline-flex items-center gap-1 text-[13px] ${
                        row.last_test_ok ? "text-emerald-700" : "text-red-700"
                      }`}
                    >
                      {row.last_test_ok ? (
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                      ) : (
                        <XCircle className="h-3.5 w-3.5" aria-hidden />
                      )}
                      {new Date(row.last_tested_at).toLocaleString()}
                    </span>
                  </div>
                ) : null}
              </div>

              <div className="mt-3 space-y-2">
                <div>
                  <label className="block text-[13px] font-semibold text-neutral-700">
                    API key
                  </label>
                  <div className="mt-1 flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-neutral-400" aria-hidden />
                    <input
                      type="password"
                      value={editingKey[known.id] || ""}
                      onChange={(e) =>
                        setEditingKey((s) => ({
                          ...s,
                          [known.id]: e.target.value
                        }))
                      }
                      placeholder="Paste key to update"
                      className="min-h-[40px] flex-1 rounded-lg border border-neutral-200 bg-white px-3 font-mono text-[13px] text-neutral-900 outline-none focus:border-neutral-900"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-neutral-700">
                    Model id
                  </label>
                  <input
                    type="text"
                    value={editingModel[known.id] ?? row?.model_id ?? ""}
                    placeholder={known.defaultModel}
                    onChange={(e) =>
                      setEditingModel((s) => ({
                        ...s,
                        [known.id]: e.target.value
                      }))
                    }
                    className="mt-1 block min-h-[40px] w-full rounded-lg border border-neutral-200 bg-white px-3 font-mono text-[13px] text-neutral-900 outline-none focus:border-neutral-900"
                  />
                </div>
              </div>

              {flashHere ? (
                <p
                  className={`mt-2 text-[13px] ${
                    flash?.ok ? "text-emerald-700" : "text-red-700"
                  }`}
                >
                  {flash?.msg}
                </p>
              ) : null}

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => save(known.id, "upsert")}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-neutral-900 px-3 text-[13px] font-semibold text-white transition hover:bg-neutral-800 disabled:opacity-60"
                >
                  {busy === known.id + ":upsert" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  ) : (
                    <Save className="h-3.5 w-3.5" aria-hidden />
                  )}
                  Save
                </button>
                <button
                  type="button"
                  disabled={isBusy || !hasKey}
                  onClick={() => save(known.id, "test")}
                  className="min-h-[40px] rounded-lg border border-neutral-200 bg-white px-3 text-[13px] font-semibold text-neutral-800 transition hover:border-neutral-400 disabled:opacity-50"
                >
                  {busy === known.id + ":test" ? "Testing…" : "Test"}
                </button>
                {enabled ? (
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => save(known.id, "disable")}
                    className="min-h-[40px] rounded-lg border border-red-200 bg-white px-3 text-[13px] font-semibold text-red-700 transition hover:border-red-400 disabled:opacity-50"
                  >
                    Disable
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={isBusy || !hasKey}
                    onClick={() => save(known.id, "enable")}
                    className="min-h-[40px] rounded-lg border border-emerald-300 bg-white px-3 text-[13px] font-semibold text-emerald-800 transition hover:border-emerald-500 disabled:opacity-50"
                  >
                    Enable
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
