"use client";

// Payment provider settings — enable + configure each provider.
//
// One row per provider. Merchant flips the enable toggle, expands the
// row to enter credentials, hits Save. Credentials POST to
// /api/studio/payments and never come back down — the UI only knows
// which fields are populated ("credentialPresence"), not the values.

import { useCallback, useEffect, useState } from "react";
import { fetchWithRetry } from "@/lib/studio/fetchWithRetry";
import type { CredentialField } from "@/platform/buttons/payments/providers";

const YELLOW = "#FFB300";
const BLACK = "#0A0A0A";
const GREEN = "#10B981";
const RED = "#DC2626";
const AMBER = "#F59E0B";

type ProviderConfig = {
  providerId: string;
  name: string;
  region: string;
  docsUrl: string;
  variantKey: string;
  brandColour: string;
  enabled: boolean;
  hasCredentials: boolean;
  credentialPresence: Record<string, boolean>;
  lastTestedAt: string | null;
  lastTestOk: boolean | null;
  lastTestError: string | null;
  supportedCurrencies: string[];
  credentialFields: CredentialField[];
  webhookEndpointHint: string;
};

export function PaymentProviderSettings() {
  const [configs, setConfigs] = useState<ProviderConfig[] | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "enabled" | "recommended">("all");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<Record<string, "ok" | "err">>({});
  const [drafts, setDrafts] = useState<Record<string, Record<string, string>>>({});

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/studio/payments");
      const json = (await res.json()) as
        | { ok: true; configs: ProviderConfig[] }
        | { ok: false; error: string };
      if (!json.ok) throw new Error(json.error);
      setConfigs(json.configs);
    } catch (err) {
      setError((err as Error).message ?? "network");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveProvider(
    providerId: string,
    patch: Partial<ProviderConfig> & { credentials?: Record<string, string> }
  ) {
    setSaving(providerId);
    try {
      const res = await fetchWithRetry("/api/studio/payments", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId,
          enabled: patch.enabled,
          credentials: patch.credentials
        })
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!json.ok) throw new Error(json.error ?? "save-failed");
      setSaveState((prev) => ({ ...prev, [providerId]: "ok" }));
      window.setTimeout(() => {
        setSaveState((prev) => {
          const { [providerId]: _, ...rest } = prev;
          return rest;
        });
      }, 2200);
      await load();
    } catch {
      setSaveState((prev) => ({ ...prev, [providerId]: "err" }));
    } finally {
      setSaving(null);
    }
  }

  const visible = configs?.filter((c) => {
    if (filter === "enabled") return c.enabled;
    if (filter === "recommended") {
      return ["stripe", "paypal", "wise", "qris", "gopay", "bank_transfer", "cod"].includes(c.providerId);
    }
    return true;
  });

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 sm:py-14">
      <p
        className="text-[10px] font-extrabold uppercase tracking-widest"
        style={{ color: YELLOW }}
      >
        Payment methods
      </p>
      <h1 className="mt-2 text-3xl font-extrabold leading-tight text-neutral-900 sm:text-4xl">
        Connect once. Every payment button on your site works.
      </h1>
      <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-neutral-600">
        Enable the methods your customers use, drop the credentials your
        provider dashboard gave you, and every payment button on any
        page routes through the right processor automatically.
      </p>

      {/* Filter tabs */}
      <div className="mt-8 flex flex-wrap gap-2 border-b border-neutral-200 pb-2">
        {(["all", "recommended", "enabled"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className="rounded-full border px-3 py-1 text-[11px] font-extrabold uppercase tracking-widest transition"
            style={{
              background: filter === f ? BLACK : "transparent",
              color: filter === f ? "#FFFFFF" : "#525252",
              borderColor: filter === f ? BLACK : "#D4D4D4"
            }}
          >
            {f === "all" && `All (${configs?.length ?? 0})`}
            {f === "recommended" && "Recommended"}
            {f === "enabled" && `Enabled (${configs?.filter((c) => c.enabled).length ?? 0})`}
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="mt-6 rounded-lg bg-red-50 px-3 py-2 text-[12px] font-bold text-red-700">
          {error}
        </p>
      )}

      {configs === null ? (
        <p className="mt-8 text-[13px] text-neutral-500">Loading…</p>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {visible?.map((c) => {
            const isExpanded = expanded === c.providerId;
            const draft = drafts[c.providerId] ?? {};
            return (
              <li key={c.providerId}>
                <article
                  className="overflow-hidden rounded-2xl border bg-white shadow-sm"
                  style={{
                    borderColor: c.enabled ? c.brandColour : "#E5E5E5"
                  }}
                >
                  <div className="flex items-center gap-3 p-4">
                    <span
                      className="grid h-11 w-11 place-items-center rounded-xl text-[15px] font-extrabold"
                      style={{
                        background: c.enabled ? c.brandColour : "#F5F5F5",
                        color: c.enabled ? "#FFFFFF" : "#525252"
                      }}
                    >
                      {c.name.slice(0, 1)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-[14px] font-extrabold text-neutral-900">
                          {c.name}
                        </h3>
                        {c.enabled && c.hasCredentials && (
                          <span
                            className="rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-widest text-white"
                            style={{ background: GREEN }}
                          >
                            Live
                          </span>
                        )}
                        {c.enabled && !c.hasCredentials && (
                          <span
                            className="rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-widest text-white"
                            style={{ background: AMBER }}
                          >
                            Missing credentials
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-neutral-500">
                        {c.region} · {c.supportedCurrencies.slice(0, 5).join(" · ")}
                        {c.supportedCurrencies.length > 5 ? " …" : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setExpanded((prev) =>
                            prev === c.providerId ? null : c.providerId
                          )
                        }
                        className="inline-flex h-9 items-center rounded-lg border border-neutral-300 px-3 text-[11px] font-extrabold uppercase tracking-widest text-neutral-700 hover:bg-neutral-50"
                      >
                        {isExpanded ? "Close" : "Configure"}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          saveProvider(c.providerId, { enabled: !c.enabled })
                        }
                        aria-pressed={c.enabled}
                        disabled={saving === c.providerId}
                        className="relative inline-flex h-6 w-11 items-center rounded-full transition"
                        style={{
                          background: c.enabled ? c.brandColour : "#D4D4D4"
                        }}
                      >
                        <span
                          className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow"
                          style={{
                            left: c.enabled ? 20 : 2,
                            transition: "left 180ms cubic-bezier(0.4,0,0.2,1)"
                          }}
                        />
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div
                      className="grid gap-4 border-t border-neutral-100 bg-neutral-50 p-4"
                    >
                      <p className="text-[11px] leading-relaxed text-neutral-600">
                        Grab your keys from the{" "}
                        <a
                          href={c.docsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="font-bold underline"
                          style={{ color: c.brandColour }}
                        >
                          {c.name} docs
                        </a>
                        . Credentials stay on our servers and are never
                        sent back to your browser — you'll only see
                        whether each field is set.
                      </p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {c.credentialFields.map((f) => {
                          const populated = c.credentialPresence[f.key];
                          return (
                            <div key={f.key} className="flex flex-col gap-1">
                              <label
                                className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500"
                                htmlFor={`${c.providerId}-${f.key}`}
                              >
                                {f.label}
                                {f.required && (
                                  <span className="ml-1 text-red-500">*</span>
                                )}
                                {populated && (
                                  <span
                                    className="ml-2 rounded-full px-1.5 py-0.5 text-[9px] font-extrabold text-white"
                                    style={{ background: GREEN }}
                                  >
                                    Saved
                                  </span>
                                )}
                              </label>
                              <input
                                id={`${c.providerId}-${f.key}`}
                                type={f.kind === "password" ? "password" : f.kind === "url" ? "url" : "text"}
                                placeholder={f.placeholder}
                                value={draft[f.key] ?? ""}
                                onChange={(e) =>
                                  setDrafts((prev) => ({
                                    ...prev,
                                    [c.providerId]: {
                                      ...(prev[c.providerId] ?? {}),
                                      [f.key]: e.target.value
                                    }
                                  }))
                                }
                                className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-[13px] outline-none focus:border-neutral-900"
                              />
                            </div>
                          );
                        })}
                      </div>
                      <div className="text-[10px] text-neutral-500">
                        Webhook endpoint:{" "}
                        <code className="rounded bg-white px-1.5 py-0.5 text-[10px]">
                          {c.webhookEndpointHint}
                        </code>
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        {saveState[c.providerId] === "ok" && (
                          <span className="text-[10px] font-bold" style={{ color: GREEN }}>
                            Saved ✓
                          </span>
                        )}
                        {saveState[c.providerId] === "err" && (
                          <span className="text-[10px] font-bold" style={{ color: RED }}>
                            Save failed
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            saveProvider(c.providerId, {
                              credentials: draft
                            })
                          }
                          disabled={saving === c.providerId}
                          className="inline-flex h-10 items-center rounded-xl px-4 text-[12px] font-extrabold uppercase tracking-widest transition disabled:opacity-40"
                          style={{
                            background: c.brandColour,
                            color: "#FFFFFF"
                          }}
                        >
                          {saving === c.providerId ? "Saving…" : "Save credentials"}
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
