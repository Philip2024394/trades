// Lead detail — contact + render timeline + status controls.
//
// Status transitions:
//   new → viewed → contacted → quoted → won / lost / ignored
//
// Setting "quoted" unlocks HD downloads for the homeowner (front-end
// gates on lead.status).

"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Mail,
  MessageCircle,
  Phone,
  MapPin,
  Loader2,
  CheckCircle2,
  XCircle,
  FileText,
  Sparkles
} from "lucide-react";
import { SurfaceCard } from "@/platform/ui";

type Homeowner = {
  id: string;
  full_name: string;
  email: string;
  whatsapp_e164: string;
  home_phone: string | null;
  postcode: string;
  created_at: string;
};

type Lead = {
  id: string;
  status: string;
  render_count: number;
  bom_summary: unknown;
  first_render_at: string | null;
  last_render_at: string | null;
  merchant_notified_at: string | null;
  merchant_first_viewed_at: string | null;
  merchant_replied_at: string | null;
} | null;

type Render = {
  id: string;
  leaf_slug: string;
  source_photo_url: string;
  render_url: string | null;
  render_url_hd: string | null;
  status: string;
  was_cache_hit: boolean;
  created_at: string;
  completed_at: string | null;
  prompt_json: Record<string, unknown>;
};

const STATUS_STEPS: Array<{ key: string; label: string }> = [
  { key: "new", label: "New" },
  { key: "viewed", label: "Viewed" },
  { key: "contacted", label: "Contacted" },
  { key: "quoted", label: "Quoted (HD unlocked)" },
  { key: "won", label: "Won" },
  { key: "lost", label: "Lost" }
];

export function LeadDetailPanel({
  merchantId,
  homeowner,
  lead,
  renders
}: {
  merchantId: string;
  homeowner: Homeowner;
  lead: Lead;
  renders: Render[];
}) {
  const [status, setStatus] = useState<string>(lead?.status || "new");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const waDigits = homeowner.whatsapp_e164.replace(/\D/g, "");

  async function setLeadStatus(next: string) {
    setBusy(true);
    setError(null);
    const previous = status;
    setStatus(next);
    try {
      const res = await fetch("/api/apps/ai-visualiser/leads/status", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          merchantId,
          homeownerId: homeowner.id,
          status: next
        })
      });
      const data: { ok: boolean; error?: string } = await res.json();
      if (!data.ok) {
        setError(data.error || "Update failed.");
        setStatus(previous);
      }
    } catch {
      setError("Network error.");
      setStatus(previous);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/site-office/apps/ai-visualiser"
          className="inline-flex items-center gap-1 text-[13px] font-semibold text-neutral-600 hover:text-neutral-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Back to inbox
        </Link>
      </div>

      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold md:text-3xl">
          {homeowner.full_name}
        </h1>
        <p className="text-[13px] text-neutral-600">
          Registered {new Date(homeowner.created_at).toLocaleString()} · {renders.length} render
          {renders.length === 1 ? "" : "s"}
        </p>
      </header>

      {/* CONTACT */}
      <SurfaceCard variant="primary" padding="md">
        <div className="text-[13px] font-semibold uppercase tracking-wide text-neutral-500">
          Contact
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <a
            href={`mailto:${homeowner.email}`}
            className="flex items-center gap-2 text-[14px] font-semibold text-neutral-900 hover:underline"
          >
            <Mail className="h-4 w-4" aria-hidden />
            {homeowner.email}
          </a>
          {waDigits ? (
            <a
              href={`https://wa.me/${waDigits}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 text-[14px] font-semibold text-emerald-700 hover:underline"
            >
              <MessageCircle className="h-4 w-4" aria-hidden />
              {homeowner.whatsapp_e164}
            </a>
          ) : null}
          {homeowner.home_phone ? (
            <a
              href={`tel:${homeowner.home_phone}`}
              className="flex items-center gap-2 text-[14px] font-semibold text-neutral-900 hover:underline"
            >
              <Phone className="h-4 w-4" aria-hidden />
              {homeowner.home_phone}
            </a>
          ) : null}
          <div className="flex items-center gap-2 text-[14px] font-mono text-neutral-800">
            <MapPin className="h-4 w-4" aria-hidden />
            {homeowner.postcode}
          </div>
        </div>
      </SurfaceCard>

      {/* STATUS */}
      <SurfaceCard variant="primary" padding="md">
        <div className="text-[13px] font-semibold uppercase tracking-wide text-neutral-500">
          Status
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {STATUS_STEPS.map((s) => {
            const active = s.key === status;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => setLeadStatus(s.key)}
                disabled={busy}
                className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold transition ${
                  active
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-neutral-200 bg-white text-neutral-800 hover:border-neutral-400"
                }`}
              >
                {active ? (
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                ) : null}
                {s.label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setLeadStatus("ignored")}
            disabled={busy}
            className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold transition ${
              status === "ignored"
                ? "border-red-400 bg-red-50 text-red-800"
                : "border-neutral-200 bg-white text-neutral-500 hover:border-red-300 hover:text-red-800"
            }`}
          >
            <XCircle className="h-3.5 w-3.5" aria-hidden />
            Ignore
          </button>
        </div>
        {error ? (
          <p className="mt-2 text-[13px] text-red-600">{error}</p>
        ) : null}
        <p className="mt-3 text-[13px] text-neutral-500">
          Marking the lead as <b>Quoted</b> unlocks HD downloads of the
          renders for the homeowner.
        </p>
      </SurfaceCard>

      {/* RENDERS */}
      <section>
        <h2 className="mb-3 text-xl font-semibold">
          Designs ({renders.length})
        </h2>
        {renders.length === 0 ? (
          <SurfaceCard variant="secondary" padding="md">
            <div className="text-[13px] text-neutral-600">
              This customer registered but hasn't finished a render yet.
              Give them a nudge on WhatsApp.
            </div>
          </SurfaceCard>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {renders.map((r) => (
              <SurfaceCard
                key={r.id}
                variant="primary"
                padding="none"
                className="overflow-hidden"
              >
                <div className="grid grid-cols-2">
                  <img
                    src={r.source_photo_url}
                    alt="Original"
                    className="aspect-square w-full object-cover"
                  />
                  {r.render_url ? (
                    <img
                      src={r.render_url}
                      alt="Render"
                      className="aspect-square w-full object-cover"
                    />
                  ) : (
                    <div className="flex aspect-square items-center justify-center bg-neutral-100 text-[13px] text-neutral-500">
                      {r.status === "pending" ? (
                        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                      ) : (
                        r.status
                      )}
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <div className="flex items-center gap-1.5 text-[13px] font-semibold text-neutral-500">
                    <Sparkles className="h-3.5 w-3.5" aria-hidden />
                    {r.leaf_slug.replace(/_/g, " ")}
                    {r.was_cache_hit ? (
                      <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[13px]">
                        cached
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 text-[13px] text-neutral-700">
                    {formatPrompt(r.prompt_json)}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {r.render_url_hd || status === "quoted" || status === "won" ? (
                      <a
                        href={`/api/apps/ai-visualiser/hd/${r.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-neutral-900 px-3 text-[13px] font-semibold text-white hover:bg-neutral-800"
                      >
                        <FileText className="h-3.5 w-3.5" aria-hidden />
                        HD PDF pack
                      </a>
                    ) : (
                      <span className="text-[13px] text-neutral-500">
                        HD unlocks when you mark the lead as <b>Quoted</b>.
                      </span>
                    )}
                    <span className="text-[13px] text-neutral-500">
                      {new Date(r.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>
              </SurfaceCard>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function formatPrompt(p: Record<string, unknown>): string {
  const bits: string[] = [];
  if (typeof p.style === "string") bits.push(String(p.style));
  if (typeof p.material === "string") bits.push(String(p.material));
  if (typeof p.colour === "string") bits.push(String(p.colour));
  if (Array.isArray(p.hardware)) bits.push(p.hardware.join(" + "));
  return bits.join(" · ");
}
