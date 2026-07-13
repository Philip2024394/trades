// Step 4 — Show matched trades. User picks 1–5 to send brief to.
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  MapPin,
  ShieldCheck,
  Send,
  Loader2,
  AlertTriangle,
  Megaphone,
  ArrowRight
} from "lucide-react";
import { useDraft } from "../draftStore";
import { WizardShell } from "../WizardShell";

type Match = {
  id: string;
  slug: string;
  displayName: string;
  trade: string;
  city: string | null;
  postcodePrefix: string | null;
  avatarUrl: string | null;
  verified: boolean;
  isLocal: boolean;
};

type YardPost = {
  id: string;
  slug: string;
  title: string;
  body: string;
  region: string | null;
  tradeSlug: string;
  posterName: string;
  posterSlug: string;
  createdAt: string;
};

export default function StepMatches() {
  const router = useRouter();
  const { draft, patch, hydrated } = useDraft();
  const [matches, setMatches] = useState<Match[]>([]);
  const [yardPosts, setYardPosts] = useState<YardPost[]>([]);
  const [status, setStatus] = useState<
    "idle" | "loading" | "loaded" | "empty" | "error" | "submitting"
  >("idle");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!hydrated) return;
    if (!draft.postcode || !draft.projectType) {
      router.replace("/project/start");
      return;
    }
    let cancelled = false;
    setStatus("loading");
    const params = new URLSearchParams({
      postcode: draft.postcode,
      projectType: draft.projectType
    });
    fetch(`/api/project/matches?${params.toString()}`)
      .then((r) => r.json())
      .then(
        (data: {
          ok: boolean;
          matches?: Match[];
          yardPosts?: YardPost[];
        }) => {
          if (cancelled) return;
          if (!data.ok || !data.matches) {
            setStatus("error");
            return;
          }
          setMatches(data.matches);
          setYardPosts(data.yardPosts ?? []);
          setStatus(data.matches.length === 0 ? "empty" : "loaded");
          const initial = new Set(data.matches.slice(0, 3).map((m) => m.id));
          setSelected(initial);
        }
      )
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [hydrated, draft.postcode, draft.projectType, router]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 5) next.add(id);
      return next;
    });
  }

  async function submit() {
    if (selected.size === 0 || status === "submitting") return;
    setStatus("submitting");
    const payload = {
      ...draft,
      selectedTradeIds: Array.from(selected)
    };
    patch({ selectedTradeIds: Array.from(selected) });
    try {
      const res = await fetch("/api/project/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = (await res.json()) as {
        ok: boolean;
        projectId?: string;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setStatus("error");
        return;
      }
      router.push("/project/sent");
    } catch {
      setStatus("error");
    }
  }

  return (
    <WizardShell
      step="matches"
      backHref="/project/contact"
      title="Pick who to send your brief to."
      subtitle={
        matches.length > 0
          ? `${matches.length} trades matched. Pick up to 5.`
          : "Looking for trades that match your project…"
      }
    >
      {status === "loading" || status === "idle" ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-amber-400" aria-hidden />
        </div>
      ) : status === "empty" ? (
        <div className="rounded-2xl border border-[#1B1A17]/12 bg-[#1B1A17]/4 p-6 text-center">
          <AlertTriangle
            className="mx-auto h-8 w-8 text-amber-300"
            aria-hidden
          />
          <p className="mt-3 text-[15px] font-semibold text-[#1B1A17]">
            No trades matched yet in your postcode.
          </p>
          <p className="mt-1 text-[13px] text-[#1B1A17]/60">
            We&apos;re still growing in your area. Your brief will be held on
            file and matched as soon as a suitable trade joins.
          </p>
          <button
            type="button"
            onClick={submit}
            className="mt-5 inline-flex min-h-[48px] items-center gap-2 rounded-full bg-amber-400 px-5 text-[14px] font-bold text-neutral-900 hover:bg-amber-300"
          >
            Hold my brief on the Notebook
          </button>
        </div>
      ) : status === "error" ? (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-[14px] text-red-100">
          Something went wrong. Please try again in a moment.
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {matches.map((m) => {
              const on = selected.has(m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggle(m.id)}
                  aria-pressed={on}
                  className={`flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition ${
                    on
                      ? "border-amber-400 bg-amber-400/10"
                      : "border-[#1B1A17]/12 bg-[#1B1A17]/4 hover:border-[#1B1A17]/18"
                  }`}
                >
                  <div className="relative shrink-0">
                    {m.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={m.avatarUrl}
                        alt=""
                        className="h-12 w-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="grid h-12 w-12 place-items-center rounded-full bg-amber-400 text-[16px] font-black text-neutral-900">
                        {m.displayName
                          .split(" ")
                          .map((w) => w[0])
                          .slice(0, 2)
                          .join("")}
                      </div>
                    )}
                    {on ? (
                      <CheckCircle2
                        className="absolute -right-1 -top-1 h-5 w-5 rounded-full bg-[#FBF6EC] text-amber-400"
                        aria-hidden
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="truncate text-[15px] font-bold text-[#1B1A17]">
                        {m.displayName}
                      </span>
                      {m.verified ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
                          <ShieldCheck className="h-3 w-3" aria-hidden />
                          Verified
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] text-[#1B1A17]/60">
                      <span className="capitalize">
                        {m.trade.replace(/-/g, " ")}
                      </span>
                      {m.city ? (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" aria-hidden />
                          {m.city}
                          {m.isLocal ? " · local" : ""}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {yardPosts.length > 0 && (
            <section className="mt-8 rounded-2xl border border-amber-400/40 bg-white p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                  style={{ background: "#FFB300" }}
                >
                  <Megaphone
                    className="h-4 w-4 text-neutral-900"
                    aria-hidden
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-black text-[#1B1A17]">
                    Live from The Yard
                  </p>
                  <p className="mt-0.5 text-[12px] leading-[1.45] text-[#1B1A17]/60">
                    Trades saying they&apos;re available right now for your
                    kind of job.
                  </p>
                </div>
              </div>
              <ul className="mt-4 space-y-2">
                {yardPosts.map((p) => (
                  <li key={p.id}>
                    <a
                      href={`/${p.posterSlug}`}
                      className="flex items-start gap-3 rounded-xl border border-[#1B1A17]/10 bg-[#FBF6EC] p-3 transition hover:border-amber-400 hover:bg-white"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-2">
                          <span className="truncate text-[13px] font-extrabold text-[#1B1A17]">
                            {p.title}
                          </span>
                          {p.region && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-[#1B1A17]/55">
                              <MapPin className="h-3 w-3" aria-hidden />
                              {p.region}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 line-clamp-2 text-[12px] leading-[1.45] text-[#1B1A17]/70">
                          {p.body}
                        </p>
                        <p className="mt-1 text-[11px] font-semibold text-[#1B1A17]/50">
                          {p.posterName} · {p.tradeSlug.replace(/-/g, " ")}
                        </p>
                      </div>
                      <ArrowRight
                        className="mt-1 h-4 w-4 shrink-0 text-amber-700"
                        aria-hidden
                      />
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="mt-8 flex flex-col items-start gap-3 border-t border-[#1B1A17]/12 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-[13px] text-[#1B1A17]/60">
              {selected.size} selected · You can pick up to 5.
            </div>
            <button
              type="button"
              onClick={submit}
              disabled={selected.size === 0 || status === "submitting"}
              className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-amber-400 px-6 text-[15px] font-bold text-neutral-900 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
            >
              {status === "submitting" ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Send className="h-4 w-4" aria-hidden />
              )}
              Send my brief
            </button>
          </div>
        </>
      )}
    </WizardShell>
  );
}
