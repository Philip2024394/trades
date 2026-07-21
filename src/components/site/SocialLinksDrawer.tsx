"use client";

// SocialLinksDrawer — bottom-slide sheet where the trade enters their
// Instagram / Facebook / TikTok / Snapchat profile URLs. Opens
// automatically from the editor's Auto-post flow when the user picks
// a network they haven't linked yet.
//
// Saves to /api/site/editor/social/links which writes the same
// columns their canteen / tradesite already reads from — one edit
// updates both surfaces.

import { useEffect, useState } from "react";
import { Loader2, X, Save, Camera, MessageCircle, Music2, Ghost } from "lucide-react";

const BRAND_BLACK  = "#0A0A0A";
const BRAND_YELLOW = "#FFB300";
const CREAM        = "#FBF6EC";

export type SocialNetworkSlug = "instagram" | "facebook" | "tiktok" | "snapchat";

export type SocialLinks = Record<SocialNetworkSlug, string>;

const FIELDS: Array<{
  slug: SocialNetworkSlug;
  label: string;
  Icon:  typeof Camera;
  color: string;
  hint:  string;
}> = [
  { slug: "instagram", label: "Instagram", Icon: Camera,        color: "#E4405F", hint: "instagram.com/your-handle or @your-handle" },
  { slug: "facebook",  label: "Facebook",  Icon: MessageCircle, color: "#1877F2", hint: "facebook.com/your-page" },
  { slug: "tiktok",    label: "TikTok",    Icon: Music2,        color: "#010101", hint: "tiktok.com/@your-handle" },
  { slug: "snapchat",  label: "Snapchat",  Icon: Ghost,         color: "#FFFC00", hint: "snapchat.com/add/your-handle" }
];

export function SocialLinksDrawer({
  onClose,
  onSaved,
  focus,
  intro
}: {
  onClose: () => void;
  onSaved: (links: SocialLinks) => void;
  /** Optional — highlight one specific field on open (used when the
   *  user hits Auto-post → TikTok and hasn't set a TikTok URL). */
  focus?:  SocialNetworkSlug;
  /** One-line contextual hint at the top — e.g. "Add your TikTok
   *  URL so we can post to it." */
  intro?:  string;
}) {
  const [links,   setLinks]   = useState<SocialLinks>({ instagram: "", facebook: "", tiktok: "", snapchat: "" });
  const [busy,    setBusy]    = useState<"none" | "load" | "save">("load");
  const [error,   setError]   = useState<string | null>(null);
  const [saved,   setSaved]   = useState(false);

  // Load current values so partial edits don't blow away other URLs.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/site/editor/social/links");
        const data = await res.json().catch(() => ({} as { ok?: boolean; links?: SocialLinks; error?: string }));
        if (cancelled) return;
        if (res.ok && data.ok && data.links) {
          setLinks(data.links);
        } else {
          setError(data.error === "not_authenticated" ? "Sign in to save your links." : data.error ?? null);
        }
      } finally {
        if (!cancelled) setBusy("none");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Escape closes + scroll lock.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  async function save() {
    setBusy("save");
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/site/editor/social/links", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(links)
      });
      const data = await res.json().catch(() => ({} as { ok?: boolean; links?: SocialLinks; error?: string }));
      if (!res.ok || data.ok !== true || !data.links) {
        setError(data.error === "not_authenticated" ? "Sign in to save your links." : data.error ?? "Save failed.");
        return;
      }
      setLinks(data.links);
      setSaved(true);
      onSaved(data.links);
    } finally {
      setBusy("none");
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center overflow-y-auto"
      style={{ backgroundColor: "rgba(10,10,10,0.65)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Social links"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:mb-6 sm:rounded-3xl"
      >
        <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: "rgba(139,69,19,0.15)", backgroundColor: CREAM }}>
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-neutral-800">Your social links</div>
            <div className="text-[10px] text-neutral-500">Saved to your listing — also shown on your canteen page.</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-black/10"
          >
            <X size={15} strokeWidth={2.6}/>
          </button>
        </div>

        {intro && (
          <div className="border-b px-4 py-2 text-[11px] font-black uppercase tracking-wider" style={{ borderColor: "rgba(139,69,19,0.10)", backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}>
            {intro}
          </div>
        )}

        <div className="flex flex-col gap-3 p-4">
          {FIELDS.map(({ slug, label, Icon, color, hint }) => {
            const highlight = focus === slug;
            return (
              <label
                key={slug}
                className="flex items-center gap-2 rounded-lg border p-2"
                style={{
                  borderColor:     highlight ? BRAND_YELLOW : "rgba(139,69,19,0.15)",
                  boxShadow:       highlight ? "0 0 0 3px rgba(255,179,0,0.25)" : "none",
                  backgroundColor: "white"
                }}
              >
                <span
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
                  style={{ backgroundColor: color, color: slug === "snapchat" ? BRAND_BLACK : "white" }}
                >
                  <Icon size={14} strokeWidth={2.2}/>
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="text-[10px] font-black uppercase tracking-wider text-neutral-500">{label}</div>
                  <input
                    type="text"
                    inputMode="url"
                    value={links[slug]}
                    onChange={(e) => setLinks((prev) => ({ ...prev, [slug]: e.target.value }))}
                    placeholder={hint}
                    className="w-full bg-transparent text-[12.5px] text-neutral-900 focus:outline-none"
                  />
                </div>
              </label>
            );
          })}
        </div>

        {error && (
          <div className="mx-4 mb-3 rounded-md bg-red-50 px-2 py-1.5 text-[11px] font-black text-red-700">{error}</div>
        )}
        {saved && (
          <div className="mx-4 mb-3 rounded-md bg-emerald-50 px-2 py-1.5 text-[11px] font-black text-emerald-700">Saved. These now show on your tradesite too.</div>
        )}

        <div className="flex items-center justify-end gap-2 border-t px-4 py-3" style={{ borderColor: "rgba(139,69,19,0.15)", backgroundColor: CREAM }}>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-2 text-[10.5px] font-black uppercase tracking-wider text-neutral-600 hover:bg-black/5"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={busy !== "none"}
            className="inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-[11px] font-black uppercase tracking-wider disabled:opacity-60"
            style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK, boxShadow: "0 2px 6px rgba(255,179,0,0.3)" }}
          >
            {busy === "save" ? <Loader2 size={12} className="animate-spin"/> : <Save size={12}/>}
            Save links
          </button>
        </div>
      </div>
    </div>
  );
}
