"use client";

// EditBannerButton — owner-only pill on the SiteBook hero. Opens a
// modal with two tabs: Upload (file input) and Library (grid of
// preset banners).
//
// On mock surfaces, selection fires a browser event that
// EditableHeroImage listens for to swap its src state — no API call.
// Real /sitebook will PATCH the homeowner's banner preference and
// upload to storage.

import { useEffect, useRef, useState } from "react";
import { Pencil, X, Upload, Check } from "lucide-react";
import { SITEBOOK_BANNERS, VIBE_LABEL, type BannerVibe, type SiteBookBanner } from "@/lib/homeowners/bannerLibrary";

const BRAND_YELLOW = "#FFB300";
const BRAND_GREEN  = "#166534";

type Tab = "library" | "upload";

export function EditBannerButton({
  currentBannerId,
  demoMode = false
}: {
  currentBannerId?: string;
  /** In demo mode (mock pages) selection dispatches a browser event
   *  and no API call is fired. */
  demoMode?: boolean;
}) {
  const [open,     setOpen]     = useState<boolean>(false);
  const [tab,      setTab]      = useState<Tab>("library");
  const [vibe,     setVibe]     = useState<BannerVibe | "all">("all");
  const [uploading,setUploading] = useState(false);
  const [uploadErr,setUploadErr] = useState<string | null>(null);
  const fileRef                  = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function pickBanner(banner: SiteBookBanner) {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("sitebook:hero-banner-change", {
        detail: { url: banner.url, id: banner.id }
      }));
    }
    setOpen(false);
    if (!demoMode) {
      // Real /sitebook — fire the persistence call
      void fetch("/api/homeowner/settings/banner", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ bannerId: banner.id, url: banner.url })
      }).catch(() => { /* silent — event already updated UI */ });
    }
  }

  function onUploadClick() {
    setUploadErr(null);
    fileRef.current?.click();
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (demoMode) {
      // Preview only — read as data URL so it renders inline
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string" && typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("sitebook:hero-banner-change", {
            detail: { url: reader.result, id: "custom-upload" }
          }));
          setOpen(false);
        }
      };
      reader.readAsDataURL(file);
      return;
    }
    // Real upload path
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    void fetch("/api/homeowner/settings/banner/upload", { method: "POST", body: fd })
      .then((res) => res.json())
      .then((data) => {
        if (data?.ok && typeof data.url === "string") {
          window.dispatchEvent(new CustomEvent("sitebook:hero-banner-change", {
            detail: { url: data.url, id: "custom-upload" }
          }));
          setOpen(false);
        } else {
          setUploadErr(data?.error || "Upload failed");
        }
      })
      .catch(() => setUploadErr("Upload failed"))
      .finally(() => { setUploading(false); if (fileRef.current) fileRef.current.value = ""; });
  }

  const filtered = vibe === "all"
    ? SITEBOOK_BANNERS
    : SITEBOOK_BANNERS.filter((b) => b.vibe === vibe);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-full border border-white/30 bg-black/40 px-2.5 py-1 text-[9.5px] font-black uppercase tracking-wider text-white backdrop-blur-md transition hover:bg-black/60"
        title="Only you can see this — edit the hero banner"
      >
        <Pencil size={11} strokeWidth={2.5}/>
        Edit banner
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: BRAND_YELLOW }}>
                  Edit banner
                </p>
                <h2 className="text-[16px] font-black text-neutral-900">Pick a hero image for your SiteBook</h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100"
                aria-label="Close"
              >
                <X size={16}/>
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-neutral-100 px-4 pt-3">
              <TabButton active={tab === "library"} onClick={() => setTab("library")}>Library</TabButton>
              <TabButton active={tab === "upload"}  onClick={() => setTab("upload")}>Upload your own</TabButton>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto bg-neutral-50 p-4">
              {tab === "library" ? (
                <>
                  {/* Vibe filter chips */}
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    <VibeChip active={vibe === "all"} onClick={() => setVibe("all")}>All</VibeChip>
                    {(Object.keys(VIBE_LABEL) as BannerVibe[]).map((v) => (
                      <VibeChip key={v} active={vibe === v} onClick={() => setVibe(v)}>
                        {VIBE_LABEL[v]}
                      </VibeChip>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {filtered.map((b) => {
                      const isCurrent = b.id === currentBannerId;
                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => pickBanner(b)}
                          className="group relative aspect-[3/1] overflow-hidden rounded-xl border-2 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                          style={{ borderColor: isCurrent ? BRAND_GREEN : "rgba(0,0,0,0.08)" }}
                          title={b.label}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={b.thumbUrl}
                            alt={b.label}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                          <span
                            className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/75 to-transparent px-2 pb-1.5 pt-6 text-left text-[10.5px] font-black text-white"
                          >
                            {b.label}
                          </span>
                          {isCurrent && (
                            <span
                              className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full text-white shadow"
                              style={{ backgroundColor: BRAND_GREEN }}
                            >
                              <Check size={12} strokeWidth={3}/>
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div>
                  <button
                    type="button"
                    onClick={onUploadClick}
                    disabled={uploading}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed bg-white px-4 py-10 text-[12.5px] font-black uppercase tracking-wider text-neutral-800 transition hover:bg-neutral-50 disabled:opacity-50"
                    style={{ borderColor: "rgba(0,0,0,0.15)" }}
                  >
                    <Upload size={16} strokeWidth={2.5}/>
                    {uploading ? "Uploading…" : "Choose an image to upload"}
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile}/>
                  <p className="mt-3 text-center text-[11px] leading-snug text-neutral-600">
                    Landscape JPEG / PNG / WebP. Best at <span className="font-black">1920 × 720</span> or wider — anything smaller will look soft on desktop.
                  </p>
                  {uploadErr && (
                    <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-center text-[11.5px] font-bold text-red-800">
                      {uploadErr}
                    </p>
                  )}
                  {demoMode && (
                    <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-center text-[11px] text-amber-900">
                      Preview mode — your image will show locally but won&rsquo;t save to the real app.
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="border-t border-neutral-100 bg-white px-4 py-2 text-center text-[10.5px] text-neutral-500">
              Only you can see this control &mdash; visitors and trades don&rsquo;t.
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function TabButton({
  active, onClick, children
}: {
  active:   boolean;
  onClick:  () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-8 items-center rounded-t-md px-3 text-[11px] font-black uppercase tracking-wider transition"
      style={{
        backgroundColor: active ? "#F9F5EA" : "transparent",
        color:           active ? "#0A0A0A" : "#94908A",
        borderBottom:    active ? `2px solid ${BRAND_YELLOW}` : "2px solid transparent"
      }}
    >
      {children}
    </button>
  );
}

function VibeChip({
  active, onClick, children
}: {
  active:   boolean;
  onClick:  () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-6 items-center rounded-full px-2 text-[10px] font-black uppercase tracking-wider transition"
      style={{
        backgroundColor: active ? "#0A0A0A" : "white",
        color:           active ? "white" : "#525252",
        border:          active ? "1px solid #0A0A0A" : "1px solid rgba(0,0,0,0.12)"
      }}
    >
      {children}
    </button>
  );
}
