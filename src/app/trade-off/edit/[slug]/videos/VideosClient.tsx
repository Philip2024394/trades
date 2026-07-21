"use client";

// VideosClient — trade video library UI for /trade-off/edit/[slug]/videos.
//
// v0.5 flow:
//   • Trade pastes a video URL (Cloudflare Stream / Supabase Storage
//     / any public MP4) + fills title, description, class, category.
//   • POST /api/videos/create validates + optionally spends washers
//     + creates DB row.
//   • List below shows all existing videos with view + save + quote
//     counts (business metrics — never likes).

import { useRef, useState } from "react";
import Link from "next/link";
import {
  Video, Upload, Loader2, CircleCheck, AlertTriangle,
  Clock, Eye, Bookmark, FileText, PoundSterling, ExternalLink, Zap
} from "lucide-react";
import { SeoSiteHeader } from "@/components/seo/SeoSiteHeader";

type VideoRow = {
  id:               string;
  title:            string;
  description:      string | null;
  video_url:        string;
  thumbnail_url:    string | null;
  duration_seconds: number | null;
  video_class:      "feed" | "portfolio" | "kb";
  category_slug:    string | null;
  status:           string;
  view_count:       number;
  save_count:       number;
  quote_attach_count: number;
  created_at:       string;
  expires_at:       string | null;
  published_at:     string | null;
};

type Props = {
  merchantSlug:   string;
  videos:         VideoRow[];
  permanentCount: number;
  washerBalance:  number;
  categories:     Array<{ slug: string; display_name: string }>;
};

const FREE_PERMANENT_SLOTS  = 3;
const WASHER_COST_PERMANENT = 10;
const WASHER_COST_FEED      = 5;

export function VideosClient({ merchantSlug, videos, permanentCount, washerBalance, categories }: Props) {
  // Upload state
  const fileInputRef  = useRef<HTMLInputElement>(null);
  const [uploading,    setUploading]    = useState(false);
  const [uploadPct,    setUploadPct]    = useState(0);
  const [uploadError,  setUploadError]  = useState<string | null>(null);
  const [videoUrl,     setVideoUrl]     = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [title,          setTitle]          = useState("");
  const [description,    setDescription]    = useState("");
  const [videoClass,     setVideoClass]     = useState<"feed" | "portfolio" | "kb">("portfolio");
  const [categorySlug,   setCategorySlug]   = useState("");
  const [durationSeconds, setDurationSeconds] = useState("");
  const [consentAdmin,   setConsentAdmin]   = useState(false);
  const [submitting,     setSubmitting]     = useState(false);
  const [error,          setError]          = useState<string | null>(null);
  const [success,        setSuccess]        = useState(false);

  const willUseWashers =
    videoClass === "feed"
      ? WASHER_COST_FEED
      : (permanentCount >= FREE_PERMANENT_SLOTS ? WASHER_COST_PERMANENT : 0);
  const canAfford = willUseWashers === 0 || washerBalance >= willUseWashers;

  const valid =
    videoUrl.trim().length >= 8 &&
    title.trim().length >= 4 &&
    canAfford;

  async function pickAndUpload(file: File) {
    setUploading(true);
    setUploadPct(0);
    setUploadError(null);

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "mp4";
    // 1. Get a signed upload URL
    const signRes = await fetch("/api/videos/upload-url", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: "video", extension: ext })
    });
    const signJson = await signRes.json().catch(() => ({ ok: false }));
    if (!signJson.ok) {
      setUploading(false);
      setUploadError(signJson.error ?? "sign-failed");
      return;
    }

    // 2. Upload directly to Supabase Storage with progress tracking (XHR — fetch has no upload progress)
    await new Promise<void>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", signJson.signed_url);
      xhr.setRequestHeader("Content-Type", file.type || "video/mp4");
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setUploadPct(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          setVideoUrl(signJson.public_url);
        } else {
          setUploadError(`Upload failed: HTTP ${xhr.status}`);
        }
        resolve();
      };
      xhr.onerror = () => { setUploadError("Network error during upload"); resolve(); };
      xhr.send(file);
    });

    setUploading(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || submitting) return;
    setSubmitting(true);
    setError(null);
    setSuccess(false);

    const res = await fetch("/api/videos/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        video_url:            videoUrl,
        title,
        description:          description || undefined,
        thumbnail_url:        thumbnailUrl || undefined,
        video_class:          videoClass,
        category_slug:        categorySlug || undefined,
        duration_seconds:     durationSeconds ? Number(durationSeconds) : undefined,
        consent_admin_reuse:  consentAdmin
      })
    });
    const json = await res.json().catch(() => ({ ok: false, error: "bad-response" }));
    setSubmitting(false);
    if (!json.ok) {
      setError(json.error ?? "submit-failed");
      return;
    }
    setSuccess(true);
    // Refresh the page state
    setTimeout(() => window.location.reload(), 1500);
  }

  return (
    <main className="min-h-screen bg-[#FBF6EC]">
      <SeoSiteHeader/>
      <div className="mx-auto max-w-[1100px] px-4 py-8 md:px-6 md:py-12">
        <nav aria-label="Breadcrumbs" className="mb-4 flex flex-wrap items-center gap-1 text-[11px] text-neutral-500">
          <Link href="/" className="hover:text-neutral-900">Home</Link>
          <span aria-hidden>/</span>
          <Link href={`/trade-off/edit/${merchantSlug}`} className="hover:text-neutral-900">Edit profile</Link>
          <span aria-hidden>/</span>
          <span className="font-black text-neutral-900">Networkers TV — my library</span>
        </nav>

        {/* Header */}
        <header>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: "#0A0A0A" }}>
              <Video size={16} strokeWidth={2.6} className="text-white"/>
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: "#FFB300" }}>
              Networkers TV · My library
            </p>
          </div>
          <h1 className="mt-2 text-[28px] font-black leading-tight text-neutral-900 md:text-[36px]">
            Video library
          </h1>
          <p className="mt-2 text-[13px] text-neutral-600 md:text-[14px]">
            Built by the trade, trusted by homeowners. Every video is a business asset.
          </p>
        </header>

        {/* Quota panel */}
        <section className="mt-6 grid gap-3 md:grid-cols-3">
          <QuotaCard
            label="Permanent slots"
            value={`${permanentCount} / ${FREE_PERMANENT_SLOTS} free`}
            note={permanentCount >= FREE_PERMANENT_SLOTS ? `Additional: ${WASHER_COST_PERMANENT} washers each` : "Free tier"}
          />
          <QuotaCard
            label="Washer balance"
            value={String(washerBalance)}
            note={`Feed uploads: ${WASHER_COST_FEED} washers each`}
          />
          <QuotaCard
            label="Live videos"
            value={String(videos.filter((v) => v.status === "live").length)}
            note={`${videos.length} total (including drafts + processing)`}
          />
        </section>

        {/* Upload form */}
        <form
          onSubmit={submit}
          className="mt-8 rounded-2xl border-2 bg-white p-5 shadow-sm md:p-6"
          style={{ borderColor: "rgba(139,69,19,0.10)" }}
        >
          <div className="flex items-center gap-2">
            <Upload size={16} strokeWidth={2.6} className="text-neutral-700"/>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">Add a video</p>
          </div>
          <p className="mt-1 text-[11.5px] text-neutral-500">
            v0.5: paste a public video URL (Supabase Storage, Cloudflare Stream, direct MP4 link). Native upload arrives in the next release.
          </p>

          <div className="mt-4 grid gap-4">
            {/* Direct-from-device file picker → Supabase Storage upload */}
            <Field label="Upload video (MP4, MOV, WebM · max 200MB)">
              <div className="flex flex-col gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/mp4,video/quicktime,video/webm"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) pickAndUpload(f);
                  }}
                  disabled={uploading}
                  className="block w-full text-[12.5px] text-neutral-700 file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-900 file:px-4 file:py-2 file:text-[11.5px] file:font-black file:uppercase file:tracking-wider file:text-white hover:file:opacity-90"
                />
                {uploading && (
                  <div className="rounded-lg border bg-white p-3" style={{ borderColor: "rgba(139,69,19,0.20)" }}>
                    <div className="flex items-center justify-between text-[11px] font-black text-neutral-800">
                      <span className="inline-flex items-center gap-1"><Loader2 size={11} className="animate-spin"/> Uploading to Supabase Storage</span>
                      <span className="tabular-nums">{uploadPct}%</span>
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
                      <div className="h-full transition-all" style={{ width: `${uploadPct}%`, backgroundColor: "#FFB300" }}/>
                    </div>
                  </div>
                )}
                {uploadError && (
                  <div className="flex items-start gap-2 rounded-lg border-2 p-3" style={{ borderColor: "#EF4444", backgroundColor: "#FEF2F2" }}>
                    <AlertTriangle size={13} className="mt-0.5 shrink-0 text-red-700"/>
                    <p className="text-[11.5px] font-black text-red-900">{uploadError}</p>
                  </div>
                )}
              </div>
            </Field>
            <Field label="Or paste a video URL (Cloudflare Stream, existing CDN)">
              <input
                type="url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://..."
                className="h-11 w-full rounded-lg border bg-white px-3 text-[13px] text-neutral-900"
                style={{ borderColor: "rgba(139,69,19,0.20)" }}
              />
            </Field>
            <Field label="Thumbnail URL (optional)">
              <input
                type="url"
                value={thumbnailUrl}
                onChange={(e) => setThumbnailUrl(e.target.value)}
                placeholder="https://..."
                className="h-11 w-full rounded-lg border bg-white px-3 text-[13px] text-neutral-900"
                style={{ borderColor: "rgba(139,69,19,0.20)" }}
              />
            </Field>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Title" required>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder='e.g. "Kitchen extension — oak floor sanded + varnished"'
                  className="h-11 w-full rounded-lg border bg-white px-3 text-[13px] text-neutral-900"
                  style={{ borderColor: "rgba(139,69,19,0.20)" }}
                />
              </Field>
              <Field label="Duration (seconds, max 180)">
                <input
                  type="number"
                  min="1"
                  max="180"
                  value={durationSeconds}
                  onChange={(e) => setDurationSeconds(e.target.value)}
                  placeholder="e.g. 45"
                  className="h-11 w-full rounded-lg border bg-white px-3 text-[13px] tabular-nums text-neutral-900"
                  style={{ borderColor: "rgba(139,69,19,0.20)" }}
                />
              </Field>
            </div>

            <Field label="Description">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="What's in the video? Products used, city, notable challenges."
                className="w-full rounded-lg border bg-white px-3 py-2 text-[13px] text-neutral-900"
                style={{ borderColor: "rgba(139,69,19,0.20)" }}
              />
            </Field>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Video class">
                <div className="flex flex-wrap gap-1.5">
                  {(["feed", "portfolio", "kb"] as const).map((cls) => (
                    <button
                      key={cls}
                      type="button"
                      onClick={() => setVideoClass(cls)}
                      className="h-9 rounded-full px-3 text-[10.5px] font-black uppercase tracking-wider transition"
                      style={
                        videoClass === cls
                          ? { backgroundColor: "#0A0A0A", color: "#FFFFFF" }
                          : { backgroundColor: "#E5E7EB", color: "#4B5563" }
                      }
                    >
                      {cls === "feed" ? "Feed (30d)" : cls === "portfolio" ? "Portfolio" : "Knowledge Base"}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Category">
                <select
                  value={categorySlug}
                  onChange={(e) => setCategorySlug(e.target.value)}
                  className="h-11 w-full rounded-lg border bg-white px-3 text-[13px] font-black text-neutral-900"
                  style={{ borderColor: "rgba(139,69,19,0.20)" }}
                >
                  <option value="">— select —</option>
                  {categories.map((c) => (
                    <option key={c.slug} value={c.slug}>{c.display_name}</option>
                  ))}
                </select>
              </Field>
            </div>

            <label className="flex cursor-pointer items-start gap-2 rounded-lg border bg-white p-3 hover:bg-[#FBF6EC]" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
              <input
                type="checkbox"
                checked={consentAdmin}
                onChange={(e) => setConsentAdmin(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[#FFB300]"
              />
              <span className="text-[12px] text-neutral-700">
                <strong className="text-neutral-900">Consent to admin reuse.</strong> The Networkers editorial team may feature this video in the Knowledge Base or on Admin TV with full attribution to my trade profile. I confirm I own the rights + have any needed homeowner consent.
              </span>
            </label>
          </div>

          {/* Cost callout */}
          <div className="mt-5 flex items-center gap-2 rounded-lg border-2 p-3" style={{ borderColor: willUseWashers > 0 ? "#FFB300" : "#22C55E", backgroundColor: willUseWashers > 0 ? "#FFFDF6" : "#F0FDF4" }}>
            <PoundSterling size={14} strokeWidth={2.6} className={willUseWashers > 0 ? "text-[#B8860B]" : "text-green-700"}/>
            <p className="text-[12px] font-black text-neutral-900">
              {willUseWashers === 0
                ? "Free — within your 3 permanent slots."
                : `Will cost ${willUseWashers} washer${willUseWashers === 1 ? "" : "s"}. Balance after: ${washerBalance - willUseWashers}.`}
            </p>
            {!canAfford && (
              <span className="text-[11px] font-black text-red-800">Insufficient balance — top up.</span>
            )}
          </div>

          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border-2 p-3" style={{ borderColor: "#EF4444", backgroundColor: "#FEF2F2" }}>
              <AlertTriangle size={14} className="mt-0.5 shrink-0 text-red-700"/>
              <p className="text-[12px] font-black text-red-900">{error}</p>
            </div>
          )}
          {success && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border-2 p-3" style={{ borderColor: "#22C55E", backgroundColor: "#F0FDF4" }}>
              <CircleCheck size={14} className="mt-0.5 shrink-0 text-green-700"/>
              <p className="text-[12px] font-black text-green-900">Video created — refreshing library...</p>
            </div>
          )}

          <button
            type="submit"
            disabled={!valid || submitting}
            className="mt-5 inline-flex h-12 w-full items-center justify-center gap-1.5 rounded-lg text-[13px] font-black uppercase tracking-wider text-neutral-900 shadow-md transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
            style={{ backgroundColor: "#FFB300" }}
          >
            {submitting ? <><Loader2 size={14} className="animate-spin"/> Adding</> : <><Upload size={14} strokeWidth={2.6}/> Add video to library</>}
          </button>
        </form>

        {/* Library */}
        <section className="mt-10">
          <h2 className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
            My videos · {videos.length}
          </h2>
          {videos.length === 0 ? (
            <div className="mt-4 rounded-2xl border-2 border-dashed p-8 text-center" style={{ borderColor: "rgba(139,69,19,0.15)" }}>
              <p className="text-[13px] text-neutral-700">No videos yet — add your first above.</p>
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {videos.map((v) => (
                <li key={v.id} className="rounded-2xl border bg-white p-4 shadow-sm" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-black text-neutral-900">{v.title}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-[10.5px] font-black uppercase tracking-wider text-neutral-500">
                        <ClassBadge cls={v.video_class}/>
                        <StatusBadge status={v.status}/>
                        {v.category_slug && <span>· {v.category_slug}</span>}
                        {v.duration_seconds && (
                          <span className="inline-flex items-center gap-0.5">
                            <Clock size={10}/>{Math.floor(v.duration_seconds/60)}:{String(v.duration_seconds%60).padStart(2,"0")}
                          </span>
                        )}
                        {v.expires_at && v.video_class === "feed" && (
                          <span className="inline-flex items-center gap-0.5">
                            · Expires {new Date(v.expires_at).toLocaleDateString("en-GB")}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {v.status === "live" && v.video_class !== "feed" && (
                        <RepostButton videoId={v.id}/>
                      )}
                      {v.status === "live" && (
                        <Link
                          href={`/videos/${v.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-0.5 text-[10.5px] font-black uppercase tracking-wider text-neutral-600 hover:text-neutral-900"
                        >
                          View <ExternalLink size={10}/>
                        </Link>
                      )}
                    </div>
                  </div>
                  {v.description && (
                    <p className="mt-2 line-clamp-2 text-[12px] text-neutral-600">{v.description}</p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-[10.5px] font-black uppercase tracking-wider text-neutral-500">
                    <span className="inline-flex items-center gap-0.5"><Eye size={11}/>{v.view_count}</span>
                    <span className="inline-flex items-center gap-0.5"><Bookmark size={11}/>{v.save_count}</span>
                    <span className="inline-flex items-center gap-0.5"><FileText size={11}/>{v.quote_attach_count} quotes</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1 text-[10.5px] font-black uppercase tracking-wider text-neutral-500">
        {label}
        {required && <span className="text-red-600">*</span>}
      </span>
      {children}
    </label>
  );
}

function QuotaCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">{label}</p>
      <p className="mt-1 text-[20px] font-black tabular-nums text-neutral-900">{value}</p>
      <p className="mt-1 text-[11px] text-neutral-500">{note}</p>
    </div>
  );
}

function ClassBadge({ cls }: { cls: "feed" | "portfolio" | "kb" }) {
  const bg = cls === "feed" ? "#FEF3C7" : cls === "portfolio" ? "#0A0A0A" : "#DCFCE7";
  const fg = cls === "feed" ? "#92400E" : cls === "portfolio" ? "#FFFFFF" : "#166534";
  const label = cls === "feed" ? "Feed" : cls === "portfolio" ? "Portfolio" : "Knowledge Base";
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[9.5px] font-black uppercase tracking-wider" style={{ backgroundColor: bg, color: fg }}>
      {label}
    </span>
  );
}

function RepostButton({ videoId }: { videoId: string }) {
  const [busy,     setBusy]     = useState(false);
  const [reposted, setReposted] = useState(false);
  const [err,      setErr]      = useState<string | null>(null);

  async function go() {
    if (busy) return;
    setBusy(true); setErr(null);
    const res  = await fetch(`/api/videos/${videoId}/repost-to-feed`, { method: "POST" });
    const json = await res.json().catch(() => ({ ok: false, error: "bad-response" }));
    setBusy(false);
    if (!json.ok) { setErr(json.error || "repost-failed"); return; }
    setReposted(true);
    setTimeout(() => window.location.reload(), 1000);
  }

  if (reposted) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10.5px] font-black uppercase tracking-wider text-green-800">
        <CircleCheck size={10}/> Reposted
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={go}
      disabled={busy}
      className="inline-flex items-center gap-0.5 rounded-full border-2 bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-neutral-700 hover:-translate-y-0.5 transition disabled:opacity-50"
      style={{ borderColor: "rgba(139,69,19,0.20)" }}
      title="Create a 30-day Yard post from this library video (free)"
    >
      {busy ? <Loader2 size={10} className="animate-spin"/> : <Zap size={10} strokeWidth={2.6}/>}
      {err ?? "Post to Yard"}
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; fg: string; label: string }> = {
    draft:      { bg: "#F5F5F5", fg: "#525252", label: "Draft" },
    processing: { bg: "#FEF3C7", fg: "#92400E", label: "Processing" },
    live:       { bg: "#DCFCE7", fg: "#166534", label: "Live" },
    flagged:    { bg: "#FEE2E2", fg: "#B91C1C", label: "Flagged" }
  };
  const s = map[status] ?? { bg: "#F5F5F5", fg: "#525252", label: status };
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[9.5px] font-black uppercase tracking-wider" style={{ backgroundColor: s.bg, color: s.fg }}>
      {s.label}
    </span>
  );
}
