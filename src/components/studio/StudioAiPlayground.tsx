"use client";

// StudioAiPlayground — live demo of the AI compose + mutate endpoints.
//
// UX flow (mirrors the intended production Studio flow):
//   1. Merchant signs in (magic-link URL params ?slug=&token=)
//   2. Picks a library (hero / services / product_grid / cta / faq / contact)
//   3. Types an intent: "A hero that says I'm 24/7 emergency plumbing"
//   4. Hits Compose → server picks section + fills params → preview here
//   5. Iterates with mutation prompts: "make it darker" / "add stats"
//   6. Copies the final params (or in Day 3b, saves to their page)

import { useEffect, useMemo, useState } from "react";
import { Sparkles, Loader2, Send, RefreshCw, Copy, Check } from "lucide-react";

const YELLOW = "#FFB300";
const CREAM = "#FBF6EC";
const CARD_BORDER = "#EDE4CE";

const LIBRARIES = [
  "hero",
  "services",
  "product_grid",
  "cta",
  "faq",
  "contact",
  "testimonials",
  "trust_bar",
  "gallery",
  "team",
  "statistics",
  "features"
] as const;

type ComposeResponse = {
  ok: boolean;
  proposal?: {
    sectionId: string;
    reasoning: string;
    params: Record<string, unknown>;
  };
  usage?: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheCreationTokens: number;
  };
  catalogEntry?: {
    id: string;
    name: string;
    library: string;
    description: string;
    fields: Array<{ key: string; label: string; role?: string; kind: string; maxLength?: number }>;
  };
  error?: string;
};

type MutateResponse = {
  ok: boolean;
  patch: Record<string, unknown>;
  note: string | null;
  rejected: string[];
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheCreationTokens: number;
  } | null;
  error?: string;
};

type UsageStats = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
};

type HistoryEntry = {
  kind: "compose" | "mutate";
  intent: string;
  usage: UsageStats | null | undefined;
  time: string;
};

export function StudioAiPlayground() {
  const [auth, setAuth] = useState<{ slug: string; token: string } | null>(null);
  const [library, setLibrary] = useState<(typeof LIBRARIES)[number]>("hero");
  const [intent, setIntent] = useState(
    "A hero that says I'm 24/7 emergency plumbing in Manchester and my customers trust me"
  );
  const [composing, setComposing] = useState(false);
  const [mutating, setMutating] = useState(false);
  const [proposal, setProposal] = useState<ComposeResponse["proposal"] | null>(null);
  const [catalogEntry, setCatalogEntry] = useState<
    ComposeResponse["catalogEntry"] | null
  >(null);
  const [params, setParams] = useState<Record<string, unknown> | null>(null);
  const [mutatePrompt, setMutatePrompt] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [rejected, setRejected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [copiedJson, setCopiedJson] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const slug = sp.get("slug");
    const token = sp.get("token");
    if (slug && token) setAuth({ slug, token });
  }, []);

  const totalCost = useMemo(() => {
    // Sonnet 4.6 pricing (2024): $3/M input, $15/M output, cache read $0.30/M, cache creation $3.75/M.
    let usd = 0;
    for (const h of history) {
      const u = h.usage;
      if (!u) continue;
      usd += (u.inputTokens / 1_000_000) * 3;
      usd += (u.outputTokens / 1_000_000) * 15;
      usd += (u.cacheReadTokens / 1_000_000) * 0.3;
      usd += (u.cacheCreationTokens / 1_000_000) * 3.75;
    }
    return usd;
  }, [history]);

  async function compose() {
    if (!auth || !intent.trim() || composing) return;
    setComposing(true);
    setError(null);
    setNote(null);
    setRejected([]);
    try {
      const res = await fetch("/api/studio/ai/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: auth.slug,
          edit_token: auth.token,
          intent: intent.trim(),
          library
        })
      });
      const data = (await res.json()) as ComposeResponse;
      if (!res.ok || !data.ok || !data.proposal) {
        setError(data.error ?? `Compose failed (${res.status})`);
        return;
      }
      setProposal(data.proposal);
      setCatalogEntry(data.catalogEntry ?? null);
      setParams(data.proposal.params);
      setHistory((h) => [
        {
          kind: "compose",
          intent: intent.trim(),
          usage: data.usage,
          time: new Date().toLocaleTimeString()
        },
        ...h
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setComposing(false);
    }
  }

  async function mutate() {
    if (!auth || !proposal || !params || !mutatePrompt.trim() || mutating) return;
    setMutating(true);
    setError(null);
    setNote(null);
    setRejected([]);
    try {
      const res = await fetch("/api/studio/ai/mutate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: auth.slug,
          edit_token: auth.token,
          section_id: proposal.sectionId,
          current_params: params,
          prompt: mutatePrompt.trim()
        })
      });
      const data = (await res.json()) as MutateResponse;
      if (!res.ok || !data.ok) {
        setError(data.error ?? `Mutate failed (${res.status})`);
        return;
      }
      if (Object.keys(data.patch).length > 0) {
        setParams((p) => ({ ...(p ?? {}), ...data.patch }));
      }
      setNote(data.note);
      setRejected(data.rejected);
      setHistory((h) => [
        {
          kind: "mutate",
          intent: mutatePrompt.trim(),
          usage: data.usage,
          time: new Date().toLocaleTimeString()
        },
        ...h
      ]);
      setMutatePrompt("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setMutating(false);
    }
  }

  async function handleCopy() {
    if (!params) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(params, null, 2));
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 1200);
    } catch {
      // no-op
    }
  }

  function reset() {
    setProposal(null);
    setCatalogEntry(null);
    setParams(null);
    setNote(null);
    setRejected([]);
    setError(null);
    setMutatePrompt("");
  }

  return (
    <div className="min-h-screen" style={{ background: CREAM }}>
      <header
        className="border-b bg-white px-6 py-4"
        style={{ borderColor: CARD_BORDER }}
      >
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <span
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ background: YELLOW }}
          >
            <Sparkles size={16} className="text-neutral-900" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-[16px] font-black text-neutral-900">
              Studio AI Playground
            </h1>
            <p className="text-[12px] font-medium text-neutral-500">
              Live demo of the compose + mutate endpoints.
              {auth
                ? ` Signed in as ${auth.slug}.`
                : " Add ?slug=…&token=… to the URL to sign in."}
            </p>
          </div>
          {history.length > 0 && (
            <div className="hidden text-right sm:block">
              <p className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                Session cost
              </p>
              <p className="text-[14px] font-black text-neutral-900">
                ${totalCost.toFixed(4)}
              </p>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-6">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          {/* LEFT — compose / mutate inputs + JSON preview */}
          <section className="space-y-4">
            {/* Compose card */}
            <div
              className="rounded-2xl border bg-white p-4"
              style={{ borderColor: CARD_BORDER }}
            >
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-neutral-500">
                1. Compose — pick a section
              </p>

              <label className="mt-3 block">
                <span className="text-[12px] font-bold text-neutral-700">
                  Library
                </span>
                <select
                  value={library}
                  onChange={(e) =>
                    setLibrary(e.target.value as (typeof LIBRARIES)[number])
                  }
                  className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-[13px] font-medium text-neutral-800"
                  style={{ borderColor: CARD_BORDER }}
                >
                  {LIBRARIES.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>

              <label className="mt-3 block">
                <span className="text-[12px] font-bold text-neutral-700">
                  Intent
                </span>
                <textarea
                  value={intent}
                  onChange={(e) => setIntent(e.target.value)}
                  rows={3}
                  className="mt-1 w-full resize-none rounded-lg border bg-white p-3 text-[13.5px] leading-[1.5] text-neutral-900"
                  style={{ borderColor: CARD_BORDER }}
                  placeholder='e.g. "A hero that says I have been at this 20 years and my customers trust me"'
                />
              </label>

              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={compose}
                  disabled={composing || !auth || !intent.trim()}
                  className="inline-flex h-10 items-center gap-2 rounded-full px-5 text-[13px] font-black text-neutral-900 shadow-sm transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
                  style={{ background: YELLOW }}
                >
                  {composing ? (
                    <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                  ) : (
                    <Sparkles size={14} aria-hidden="true" />
                  )}
                  Compose
                </button>
                {proposal && (
                  <button
                    type="button"
                    onClick={reset}
                    className="inline-flex h-10 items-center gap-1.5 rounded-full border bg-white px-4 text-[12px] font-bold text-neutral-700 hover:bg-neutral-50"
                    style={{ borderColor: CARD_BORDER }}
                  >
                    <RefreshCw size={12} aria-hidden="true" />
                    Reset
                  </button>
                )}
              </div>
            </div>

            {/* Proposal card */}
            {proposal && catalogEntry && (
              <div
                className="rounded-2xl border bg-white p-4"
                style={{ borderColor: CARD_BORDER }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-neutral-500">
                      Picked section
                    </p>
                    <h2 className="mt-1 text-[16px] font-black text-neutral-900">
                      {catalogEntry.name}
                    </h2>
                    <p className="mt-1 text-[12px] font-medium text-neutral-500">
                      {catalogEntry.id} · library:{" "}
                      <span className="font-bold">{catalogEntry.library}</span>
                    </p>
                    <p className="mt-2 text-[12px] leading-[1.5] text-neutral-700">
                      {catalogEntry.description}
                    </p>
                    <p className="mt-2 text-[12px] italic text-neutral-600">
                      Why this: {proposal.reasoning}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Mutate card — only when there's a proposal */}
            {proposal && (
              <div
                className="rounded-2xl border bg-white p-4"
                style={{ borderColor: CARD_BORDER }}
              >
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-neutral-500">
                  2. Mutate — edit by prompt
                </p>
                <div className="mt-3 flex items-end gap-2">
                  <textarea
                    value={mutatePrompt}
                    onChange={(e) => setMutatePrompt(e.target.value)}
                    rows={2}
                    className="min-w-0 flex-1 resize-none rounded-xl border bg-white p-3 text-[13px] text-neutral-900"
                    style={{ borderColor: CARD_BORDER }}
                    placeholder="e.g. Make the headline shorter and sound more urgent"
                    onKeyDown={(e) => {
                      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") mutate();
                    }}
                  />
                  <button
                    type="button"
                    onClick={mutate}
                    disabled={mutating || !mutatePrompt.trim()}
                    className="inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-[12px] font-black text-neutral-900 shadow-sm transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
                    style={{ background: YELLOW }}
                  >
                    {mutating ? (
                      <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                    ) : (
                      <Send size={14} aria-hidden="true" />
                    )}
                    Mutate
                  </button>
                </div>
                {note && (
                  <div
                    className="mt-3 rounded-lg px-3 py-2 text-[12px] font-medium text-neutral-800"
                    style={{ background: `${YELLOW}22` }}
                  >
                    <span className="font-black">Note:</span> {note}
                  </div>
                )}
                {rejected.length > 0 && (
                  <div className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-[12px] font-medium text-red-800">
                    Couldn&apos;t apply: {rejected.join(", ")}
                  </div>
                )}
              </div>
            )}

            {/* JSON preview + copy */}
            {params && (
              <div
                className="rounded-2xl border bg-white p-4"
                style={{ borderColor: CARD_BORDER }}
              >
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-neutral-500">
                    3. Params (JSON)
                  </p>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full border bg-white px-3 text-[11px] font-bold text-neutral-700 hover:bg-neutral-50"
                    style={{ borderColor: CARD_BORDER }}
                  >
                    {copiedJson ? (
                      <Check size={12} aria-hidden="true" />
                    ) : (
                      <Copy size={12} aria-hidden="true" />
                    )}
                    {copiedJson ? "Copied" : "Copy"}
                  </button>
                </div>
                <pre
                  className="mt-3 max-h-[420px] overflow-auto rounded-lg p-3 text-[11px] leading-[1.6]"
                  style={{ background: "#0A0A0A", color: "#E5E5E5" }}
                >
                  {JSON.stringify(params, null, 2)}
                </pre>
              </div>
            )}
          </section>

          {/* RIGHT — history / cost tracker */}
          <aside className="space-y-4">
            <div
              className="rounded-2xl border bg-white p-4"
              style={{ borderColor: CARD_BORDER }}
            >
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-neutral-500">
                Session history
              </p>
              {history.length === 0 ? (
                <p className="mt-2 text-[12px] italic text-neutral-500">
                  No calls yet. Hit Compose to start.
                </p>
              ) : (
                <ul className="mt-3 space-y-2 text-[12px]">
                  {history.map((h, i) => (
                    <li
                      key={i}
                      className="rounded-lg border p-2"
                      style={{ borderColor: CARD_BORDER }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-black uppercase"
                          style={{
                            background:
                              h.kind === "compose" ? "#DBEAFE" : "#FEF3C7",
                            color: h.kind === "compose" ? "#1E40AF" : "#7A5300"
                          }}
                        >
                          {h.kind}
                        </span>
                        <span className="text-[10px] text-neutral-500">
                          {h.time}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-[12px] text-neutral-800">
                        {h.intent}
                      </p>
                      {h.usage && (
                        <p className="mt-1 text-[10px] font-medium text-neutral-500">
                          in {h.usage.inputTokens} / out{" "}
                          {h.usage.outputTokens} · cache read{" "}
                          <span className="font-bold text-green-700">
                            {h.usage.cacheReadTokens}
                          </span>
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {history.length > 0 && (
              <div
                className="rounded-2xl border bg-white p-4"
                style={{ borderColor: CARD_BORDER }}
              >
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-neutral-500">
                  Cost breakdown
                </p>
                <p className="mt-2 text-[24px] font-black text-neutral-900">
                  ${totalCost.toFixed(4)}
                </p>
                <p className="text-[11px] font-medium text-neutral-500">
                  This session, Sonnet 4.6 pricing.
                </p>
                <p className="mt-2 text-[11px] text-neutral-600">
                  At scale (1000 merchants × 4 sessions/mo): projected AI
                  cost ≈{" "}
                  <span className="font-black text-neutral-900">
                    ${(totalCost * 4000).toFixed(0)}/mo
                  </span>
                  .
                </p>
              </div>
            )}
          </aside>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-bold text-red-800">
            {error}
          </div>
        )}
      </main>
    </div>
  );
}

export default StudioAiPlayground;
