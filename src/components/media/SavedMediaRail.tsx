"use client";

// SavedMediaRail — reusable saved-media container for SiteBook
// (homeowner) + Canteen (merchant) left columns. Same component,
// auto-detects auth, shows a toggle between Image + Video, per-item
// Unsave + Share-to-Yard actions, tombstone state when the source
// video has been removed by the owner.
//
// Behaviour:
//   • Loads saves for the current session user via /api/media/list-saves
//   • Renders empty state when nothing saved
//   • Renders sign-in prompt when not authed
//   • Toggle switches media_kind between 'video' + 'photo' (photo
//     side lands with the SiteBook photo-table alignment)
//   • Unsave: POSTs to /api/media/save (which toggles off)
//   • Share to Yard: POSTs to /api/media/[save_id]/share-to-yard
//     (merchant-only — homeowners can only unsave/save)

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bookmark, Image as ImageIcon, Video, Loader2, X, Zap, CircleCheck, AlertTriangle } from "lucide-react";
import { PLACEHOLDER_FRAME_URL } from "@/app/videos/config";

type SaveRow = {
  save_id:    string;
  media_kind: "video" | "photo";
  media_id:   string;
  pinned:     boolean;
  saved_at:   string;
  removed:    boolean;
  video: {
    id:               string;
    title:            string;
    thumbnail_url:    string | null;
    duration_seconds: number | null;
    merchant_slug:    string;
    status:           string;
    video_class:      string;
  } | null;
};

type Props = {
  /** Show only the merchant-relevant actions (Share to Yard) when
   *  we know the viewer is a merchant. When null, the component
   *  auto-decides based on the API response. */
  merchantHint?: boolean;
  className?:    string;
  compact?:      boolean;
};

export function SavedMediaRail({ className, compact = true }: Props) {
  const [kind,   setKind]   = useState<"video" | "photo">("video");
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [saves,  setSaves]  = useState<SaveRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/media/list-saves?kind=${kind}&limit=24`);
    const json = await res.json().catch(() => ({ ok: false }));
    if (json.ok) {
      setAuthed(json.authed);
      setSaves(json.saves ?? []);
    }
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [kind]);

  return (
    <section
      aria-label="Saved media"
      className={`rounded-2xl border-2 bg-white p-4 shadow-sm ${className ?? ""}`}
      style={{ borderColor: "rgba(139,69,19,0.10)" }}
    >
      {/* Header + Image | Video toggle */}
      <div className="flex items-center justify-between">
        <p className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
          <Bookmark size={12} strokeWidth={2.6} className="text-[#FFB300]"/>
          Saved
        </p>
        <div className="flex items-center gap-0.5 rounded-full bg-neutral-100 p-0.5">
          <ToggleBtn active={kind === "image" as unknown as boolean || kind === "photo"} onClick={() => setKind("photo")} Icon={ImageIcon} label="Image"/>
          <ToggleBtn active={kind === "video"} onClick={() => setKind("video")}                              Icon={Video}     label="Video"/>
        </div>
      </div>

      {/* Body */}
      <div className="mt-3">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-neutral-500">
            <Loader2 size={14} className="animate-spin"/>
          </div>
        ) : authed === false ? (
          <div className="rounded-lg border border-dashed p-4 text-center" style={{ borderColor: "rgba(139,69,19,0.15)" }}>
            <p className="text-[11.5px] text-neutral-600">Sign in to save {kind}s from Networkers TV.</p>
            <Link
              href="/home/sign-in"
              className="mt-2 inline-flex h-8 items-center rounded-lg px-3 text-[10.5px] font-black uppercase tracking-wider text-neutral-900"
              style={{ backgroundColor: "#FFB300" }}
            >
              Sign in
            </Link>
          </div>
        ) : saves.length === 0 ? (
          <div className="rounded-lg border border-dashed p-4 text-center" style={{ borderColor: "rgba(139,69,19,0.15)" }}>
            <p className="text-[11.5px] text-neutral-600">
              No saved {kind}s yet.
              {kind === "video" && (
                <>
                  <br/>
                  <Link href="/videos" className="mt-1 inline-block font-black text-neutral-900 hover:underline">
                    Browse Networkers TV →
                  </Link>
                </>
              )}
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {saves.map((s) => (
              <SaveItem key={s.save_id} save={s} compact={compact} onChanged={load}/>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function ToggleBtn({ active, onClick, Icon, label }: { active: boolean; onClick: () => void; Icon: typeof Bookmark; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[9.5px] font-black uppercase tracking-wider transition"
      style={
        active
          ? { backgroundColor: "#0A0A0A", color: "#FFFFFF" }
          : { backgroundColor: "transparent", color: "#525252" }
      }
    >
      <Icon size={10} strokeWidth={2.6}/>
      {label}
    </button>
  );
}

function SaveItem({ save, compact, onChanged }: { save: SaveRow; compact: boolean; onChanged: () => void }) {
  const [busy, setBusy] = useState<"unsave" | "share" | null>(null);
  const [msg,  setMsg]  = useState<string | null>(null);

  async function unsave() {
    if (busy) return;
    setBusy("unsave");
    await fetch("/api/media/save", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ media_kind: save.media_kind, media_id: save.media_id })
    });
    setBusy(null);
    onChanged();
  }

  async function shareToYard() {
    if (busy) return;
    setBusy("share");
    const res = await fetch(`/api/media/${save.save_id}/share-to-yard`, { method: "POST" });
    const json = await res.json().catch(() => ({ ok: false }));
    setBusy(null);
    if (json.ok) {
      setMsg("Shared to Yard");
      setTimeout(() => setMsg(null), 2000);
    } else {
      setMsg(json.error === "auth-required-merchant" ? "Only trades can share to Yard" : (json.error ?? "share-failed"));
      setTimeout(() => setMsg(null), 3000);
    }
  }

  // Tombstone — owner removed the source video
  if (save.removed) {
    return (
      <li className="flex items-center gap-2 rounded-lg border p-2" style={{ borderColor: "rgba(220,38,38,0.20)", backgroundColor: "#FEF2F2" }}>
        <div className="flex h-9 w-14 shrink-0 items-center justify-center rounded" style={{ backgroundColor: "#1F2937" }}>
          <AlertTriangle size={12} className="text-red-400"/>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10.5px] font-black uppercase tracking-wider text-red-800">Owner removed this video</p>
          {save.video?.title && <p className="mt-0.5 line-clamp-1 text-[10px] italic text-neutral-500">{save.video.title}</p>}
        </div>
        <button
          type="button"
          onClick={unsave}
          disabled={busy === "unsave"}
          aria-label="Remove from saved"
          className="rounded p-1 text-neutral-400 hover:bg-white hover:text-neutral-900"
        >
          {busy === "unsave" ? <Loader2 size={11} className="animate-spin"/> : <X size={11}/>}
        </button>
      </li>
    );
  }

  const v = save.video;
  if (!v) return null;

  return (
    <li className="group rounded-lg border p-2 hover:bg-neutral-50" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
      <div className="flex items-start gap-2">
        <Link href={`/videos/${v.id}`} className="block h-9 w-14 shrink-0 overflow-hidden rounded" style={{ backgroundColor: "#0A0A0A" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={v.thumbnail_url ?? PLACEHOLDER_FRAME_URL} alt="" className="h-full w-full object-cover"/>
        </Link>
        <div className="min-w-0 flex-1">
          <Link href={`/videos/${v.id}`} className="line-clamp-2 text-[11px] font-black leading-tight text-neutral-900 hover:underline">
            {v.title}
          </Link>
          <p className="mt-0.5 line-clamp-1 text-[9.5px] font-black uppercase tracking-wider text-neutral-500">
            {v.merchant_slug.replace(/-/g, " ")}
            {v.duration_seconds && ` · ${Math.floor(v.duration_seconds/60)}:${String(v.duration_seconds%60).padStart(2,"0")}`}
          </p>
        </div>
      </div>

      {msg && (
        <p className="mt-1.5 text-[10px] font-black text-neutral-700">{msg}</p>
      )}

      {!compact && (
        <div className="mt-2 flex items-center gap-1">
          <button
            type="button"
            onClick={shareToYard}
            disabled={busy === "share"}
            className="inline-flex h-7 items-center gap-1 rounded-full border-2 bg-white px-2 text-[9.5px] font-black uppercase tracking-wider text-neutral-700 hover:-translate-y-0.5 transition disabled:opacity-50"
            style={{ borderColor: "rgba(139,69,19,0.20)" }}
            title="Post this video to your Yard feed (30-day post)"
          >
            {busy === "share" ? <Loader2 size={10} className="animate-spin"/> : <Zap size={10} strokeWidth={2.6}/>}
            Yard
          </button>
          <button
            type="button"
            onClick={unsave}
            disabled={busy === "unsave"}
            className="inline-flex h-7 items-center gap-1 rounded-full border-2 bg-white px-2 text-[9.5px] font-black uppercase tracking-wider text-neutral-700 hover:-translate-y-0.5 transition disabled:opacity-50"
            style={{ borderColor: "rgba(139,69,19,0.20)" }}
          >
            {busy === "unsave" ? <Loader2 size={10} className="animate-spin"/> : <X size={10} strokeWidth={2.6}/>}
            Remove
          </button>
        </div>
      )}
      {compact && (
        <div className="mt-1.5 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={shareToYard}
            disabled={busy === "share"}
            className="inline-flex h-6 items-center gap-1 rounded px-2 text-[9px] font-black uppercase tracking-wider text-neutral-600 hover:bg-white hover:text-neutral-900 disabled:opacity-50"
            title="Post to Yard (trades only)"
          >
            {busy === "share" ? <Loader2 size={9} className="animate-spin"/> : <Zap size={9} strokeWidth={2.6}/>} Yard
          </button>
          <button
            type="button"
            onClick={unsave}
            disabled={busy === "unsave"}
            className="inline-flex h-6 items-center gap-1 rounded px-2 text-[9px] font-black uppercase tracking-wider text-neutral-600 hover:bg-white hover:text-neutral-900 disabled:opacity-50"
          >
            {busy === "unsave" ? <Loader2 size={9} className="animate-spin"/> : <X size={9} strokeWidth={2.6}/>} Remove
          </button>
        </div>
      )}
    </li>
  );
}
