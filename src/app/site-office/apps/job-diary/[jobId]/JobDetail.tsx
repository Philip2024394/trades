// Job detail — mobile-first entries feed + composer + sign-off.

"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Flag,
  Loader2,
  MessageSquare,
  MapPin,
  Send,
  ShieldCheck,
  ImagePlus
} from "lucide-react";
import { SurfaceCard } from "@/platform/ui";

type Entry = {
  id: string;
  kind: string;
  headline: string;
  body: string | null;
  mediaUrls: string[];
  occurredAt: string;
  homeownerVisible: boolean;
};

const KIND_META: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>; tint: string }
> = {
  check_in: { label: "Check-in", icon: MapPin, tint: "bg-blue-100 text-blue-800" },
  photo: { label: "Photo", icon: Camera, tint: "bg-neutral-100 text-neutral-800" },
  note: { label: "Note", icon: MessageSquare, tint: "bg-neutral-100 text-neutral-800" },
  milestone: { label: "Milestone", icon: Flag, tint: "bg-amber-100 text-amber-900" },
  snag: { label: "Snag", icon: Flag, tint: "bg-red-100 text-red-800" },
  material_arrived: { label: "Material", icon: ImagePlus, tint: "bg-emerald-100 text-emerald-800" },
  delay: { label: "Delay", icon: Flag, tint: "bg-amber-100 text-amber-900" }
};

export function JobDetail({
  job,
  entries: initialEntries,
  homeowner,
  signoff,
  quote
}: {
  job: {
    id: string;
    title: string;
    status: string;
    progress: number;
    actualStartDate: string | null;
    actualEndDate: string | null;
  };
  entries: Entry[];
  homeowner: { full_name: string; whatsapp_e164: string; postcode: string } | null;
  signoff: {
    id: string;
    warranties_registered_count: number;
    photos: string[];
    customer_signature_name: string | null;
    created_at: string;
  } | null;
  quote: { title: string; total_pence: number } | null;
}) {
  const [entries, setEntries] = useState<Entry[]>(initialEntries);
  const [kind, setKind] = useState<Entry["kind"]>("note");
  const [headline, setHeadline] = useState("");
  const [body, setBody] = useState("");
  const [homeownerVisible, setHomeownerVisible] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [pendingPhotoUrls, setPendingPhotoUrls] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signoffOpen, setSignoffOpen] = useState(false);
  const [signoffCustomer, setSignoffCustomer] = useState(
    homeowner?.full_name || ""
  );
  const [signoffNotes, setSignoffNotes] = useState("");
  const [signingOff, setSigningOff] = useState(false);

  const closed = job.status === "signed_off" || job.status === "closed";

  async function uploadPhoto(file: File) {
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/apps/job-diary/${job.id}/upload`, {
        method: "POST",
        body: form
      });
      const data: { ok: boolean; url?: string; error?: string } = await res.json();
      if (!data.ok || !data.url) {
        setError(data.error || "Upload failed.");
        return;
      }
      setPendingPhotoUrls((v) => [...v, data.url as string]);
    } finally {
      setUploading(false);
    }
  }

  async function submitEntry() {
    if (headline.trim().length < 2) {
      setError("Add a short headline.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/apps/job-diary/${job.id}/entries`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind,
          headline: headline.trim(),
          body: body || null,
          mediaUrls: pendingPhotoUrls,
          homeownerVisible
        })
      });
      const data: { ok: boolean; entryId?: string; error?: string } = await res.json();
      if (!data.ok || !data.entryId) {
        setError(data.error || "Could not add entry.");
        return;
      }
      setEntries((v) => [
        {
          id: data.entryId as string,
          kind,
          headline: headline.trim(),
          body: body || null,
          mediaUrls: pendingPhotoUrls,
          occurredAt: new Date().toISOString(),
          homeownerVisible
        },
        ...v
      ]);
      setHeadline("");
      setBody("");
      setPendingPhotoUrls([]);
      setKind("note");
    } finally {
      setSubmitting(false);
    }
  }

  async function signOff() {
    setSigningOff(true);
    setError(null);
    try {
      const res = await fetch(`/api/apps/job-diary/${job.id}/signoff`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          customerSignatureName: signoffCustomer || null,
          notes: signoffNotes || null,
          photos: pendingPhotoUrls
        })
      });
      const data: { ok: boolean; error?: string } = await res.json();
      if (!data.ok) {
        setError(data.error || "Sign-off failed.");
        return;
      }
      window.location.reload();
    } finally {
      setSigningOff(false);
    }
  }

  return (
    <>
      <div className="mb-4">
        <Link
          href="/site-office/apps/job-diary"
          className="inline-flex items-center gap-1 text-[13px] font-semibold text-neutral-600 hover:text-neutral-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          All jobs
        </Link>
      </div>

      <header className="mb-4">
        <div className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-neutral-500 capitalize">
          <ClipboardCheck className="h-3.5 w-3.5" aria-hidden />
          {job.status.replace(/_/g, " ")}
        </div>
        <h1 className="mt-1 text-2xl font-bold md:text-3xl">{job.title}</h1>
        {homeowner ? (
          <p className="mt-1 text-[13px] text-neutral-600">
            {homeowner.full_name} · {homeowner.postcode}
          </p>
        ) : null}
        {quote ? (
          <p className="text-[13px] text-neutral-500">
            Accepted quote · £{(quote.total_pence / 100).toFixed(2)}
          </p>
        ) : null}
      </header>

      {/* PROGRESS */}
      <SurfaceCard variant="primary" padding="md" className="mb-4">
        <div className="flex items-baseline justify-between">
          <div className="text-[13px] font-semibold uppercase tracking-wide text-neutral-500">
            Progress
          </div>
          <div className="text-[13px] font-semibold">{job.progress}%</div>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-neutral-100">
          <div
            className="h-full bg-emerald-500"
            style={{ width: `${job.progress}%` }}
          />
        </div>
        {job.actualStartDate ? (
          <p className="mt-2 text-[13px] text-neutral-500">
            Started {job.actualStartDate}
            {job.actualEndDate ? ` · finished ${job.actualEndDate}` : ""}
          </p>
        ) : null}
      </SurfaceCard>

      {/* SIGNED OFF STATE */}
      {closed && signoff ? (
        <SurfaceCard variant="success" padding="md" className="mb-4">
          <div className="flex items-center gap-2 text-[13px] font-semibold">
            <ShieldCheck className="h-4 w-4" aria-hidden />
            Signed off {new Date(signoff.created_at).toLocaleDateString()}
          </div>
          <p className="mt-1 text-[13px]">
            {signoff.warranties_registered_count} warrant
            {signoff.warranties_registered_count === 1 ? "y" : "ies"} registered
            {signoff.customer_signature_name
              ? ` · signed by ${signoff.customer_signature_name}`
              : ""}
            .
          </p>
        </SurfaceCard>
      ) : null}

      {/* ENTRY COMPOSER */}
      {!closed ? (
        <SurfaceCard variant="primary" padding="md" className="mb-4">
          <div className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-neutral-500">
            Add entry
          </div>
          <div className="mb-3 flex flex-wrap gap-2">
            {(
              ["check_in", "photo", "note", "milestone", "material_arrived", "snag", "delay"] as const
            ).map((k) => {
              const meta = KIND_META[k];
              const Icon = meta.icon;
              const active = kind === k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition ${
                    active
                      ? "border-neutral-900 bg-neutral-900 text-white"
                      : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                  {meta.label}
                </button>
              );
            })}
          </div>
          <input
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            placeholder="Short headline (e.g. Cabinets fitted)"
            className="mb-2 block min-h-[44px] w-full rounded-lg border border-neutral-200 bg-white px-3 text-[14px] outline-none focus:border-neutral-900"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={2}
            placeholder="Optional — more detail for the homeowner"
            className="mb-2 block w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-[14px] outline-none focus:border-neutral-900"
          />
          <div className="mb-2 flex items-center gap-2">
            <label className="inline-flex min-h-[36px] cursor-pointer items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 text-[13px] font-semibold text-neutral-800 hover:border-neutral-400">
              {uploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <Camera className="h-3.5 w-3.5" aria-hidden />
              )}
              Add photo
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadPhoto(f);
                }}
              />
            </label>
            <label className="inline-flex items-center gap-1 text-[13px] text-neutral-700">
              <input
                type="checkbox"
                checked={homeownerVisible}
                onChange={(e) => setHomeownerVisible(e.target.checked)}
              />
              Show homeowner
            </label>
          </div>
          {pendingPhotoUrls.length > 0 ? (
            <div className="mb-2 grid grid-cols-3 gap-1.5">
              {pendingPhotoUrls.map((u) => (
                <img
                  key={u}
                  src={u}
                  alt=""
                  className="aspect-square w-full rounded object-cover"
                />
              ))}
            </div>
          ) : null}
          {error ? <p className="mb-2 text-[13px] text-red-600">{error}</p> : null}
          <button
            type="button"
            onClick={submitEntry}
            disabled={submitting}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-neutral-900 px-4 text-[14px] font-semibold text-white hover:bg-neutral-800 disabled:opacity-60"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Send className="h-4 w-4" aria-hidden />
            )}
            Add to diary
          </button>
        </SurfaceCard>
      ) : null}

      {/* ENTRIES FEED */}
      <section className="mb-4">
        <h2 className="mb-2 text-xl font-semibold">Diary</h2>
        {entries.length === 0 ? (
          <SurfaceCard variant="secondary" padding="md">
            <p className="text-[13px] text-neutral-500">
              No entries yet. Add your first check-in above.
            </p>
          </SurfaceCard>
        ) : (
          <ol className="relative ml-4 border-l-2 border-neutral-200">
            {entries.map((e) => {
              const meta = KIND_META[e.kind] || KIND_META.note;
              const Icon = meta.icon;
              return (
                <li key={e.id} className="mb-4 ml-4">
                  <span className="absolute -left-[7px] mt-1 flex h-3 w-3 items-center justify-center rounded-full border-2 border-white bg-neutral-900" />
                  <div className="flex items-center gap-2 text-[13px] text-neutral-500">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[13px] font-semibold ${meta.tint}`}
                    >
                      <Icon className="h-3 w-3" aria-hidden />
                      {meta.label}
                    </span>
                    <span>{new Date(e.occurredAt).toLocaleString()}</span>
                    {!e.homeownerVisible ? (
                      <span className="text-[13px] text-neutral-400">
                        · private
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 text-[14px] font-semibold text-neutral-900">
                    {e.headline}
                  </div>
                  {e.body ? (
                    <p className="mt-0.5 text-[13px] text-neutral-700">{e.body}</p>
                  ) : null}
                  {e.mediaUrls.length > 0 ? (
                    <div className="mt-2 grid grid-cols-3 gap-1.5">
                      {e.mediaUrls.slice(0, 6).map((u) => (
                        <img
                          key={u}
                          src={u}
                          alt=""
                          className="aspect-square w-full rounded object-cover"
                        />
                      ))}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {/* SIGN-OFF */}
      {!closed ? (
        <SurfaceCard variant="dark" padding="md">
          <div className="text-[13px] font-semibold uppercase tracking-wide text-white/70">
            All done?
          </div>
          <h3 className="mt-1 text-lg font-bold text-white">
            Sign the job off
          </h3>
          <p className="mt-1 text-[13px] text-white/70">
            Auto-registers warranties on every material line, fires the
            review request, and closes the project.
          </p>
          {!signoffOpen ? (
            <button
              type="button"
              onClick={() => setSignoffOpen(true)}
              className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-emerald-500 px-4 text-[14px] font-bold text-white hover:bg-emerald-400"
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden />
              Start sign-off
            </button>
          ) : (
            <div className="mt-3 space-y-2">
              <div>
                <label className="text-[13px] font-semibold text-white/80">
                  Customer's name (signature)
                </label>
                <input
                  value={signoffCustomer}
                  onChange={(e) => setSignoffCustomer(e.target.value)}
                  className="mt-1 block min-h-[40px] w-full rounded-lg border border-white/20 bg-black/30 px-3 text-[14px] text-white placeholder:text-white/50"
                />
              </div>
              <div>
                <label className="text-[13px] font-semibold text-white/80">
                  Sign-off notes
                </label>
                <textarea
                  rows={3}
                  value={signoffNotes}
                  onChange={(e) => setSignoffNotes(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-[14px] text-white placeholder:text-white/50"
                />
              </div>
              <button
                type="button"
                onClick={signOff}
                disabled={signingOff}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-emerald-500 px-4 text-[14px] font-bold text-white hover:bg-emerald-400 disabled:opacity-60"
              >
                {signingOff ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <ShieldCheck className="h-4 w-4" aria-hidden />
                )}
                Sign off & register warranties
              </button>
            </div>
          )}
        </SurfaceCard>
      ) : null}
    </>
  );
}
