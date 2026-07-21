"use client";

// ImageLibraryDrawer — the bottom-drawer image gallery for the Site
// Editor. Half-height slide-up sheet with source tabs, search,
// frame-fit filter, and per-tile icons showing which frames the image
// fits. Picking an image auto-switches the canvas frame to the image's
// best-fit destination (bestFitFrame from frames.ts).
//
// Rendered from EditorClient when the user taps the "Library" tool
// button. Fires onPick with the full LibraryImage; the editor takes
// care of frame-switch + base-image load.

import { useCallback, useEffect, useRef, useState } from "react";
import { Search, X, Loader2, HardHat, Upload as UploadIcon, ChevronDown } from "lucide-react";
import { NETWORK_ICON_URL } from "@/lib/siteEditor/frames";

const BRAND_BLACK  = "#0A0A0A";
const BRAND_YELLOW = "#FFB300";
const CREAM        = "#FBF6EC";

export type LibraryImage = {
  id:             string;
  url:            string;
  subject:        string;
  source:         "site" | "uploads" | "canteen" | "yard";
  natural_aspect: number | null;
  fits_frames:    string[];
};

const SOURCE_CHIPS: Array<{ slug: LibraryImage["source"]; label: string }> = [
  { slug: "site",    label: "The Site"    },
  { slug: "uploads", label: "My uploads"  },
  { slug: "canteen", label: "My Canteen"  },
  { slug: "yard",    label: "My Yard"     }
];

/** Map a frame slug back to a compact icon descriptor for the tile
 *  fit-pips. Social networks use their brand PNG icons hosted in the
 *  social-media bucket; canteen/yard uses the lucide HardHat. */
type IconPip = { kind: "img"; url: string } | { kind: "lucide"; Icon: typeof HardHat };
function frameSlugToPip(slug: string): IconPip | null {
  if (slug.startsWith("ig-"))   return NETWORK_ICON_URL.instagram ? { kind: "img", url: NETWORK_ICON_URL.instagram } : null;
  if (slug.startsWith("fb-"))   return NETWORK_ICON_URL.facebook  ? { kind: "img", url: NETWORK_ICON_URL.facebook  } : null;
  if (slug.startsWith("tt-"))   return NETWORK_ICON_URL.tiktok    ? { kind: "img", url: NETWORK_ICON_URL.tiktok    } : null;
  if (slug.startsWith("snap-")) return NETWORK_ICON_URL.snapchat  ? { kind: "img", url: NETWORK_ICON_URL.snapchat  } : null;
  if (slug === "canteen-post")  return { kind: "lucide", Icon: HardHat };
  return null;
}

/** Group fits_frames down to unique network pips so a tile that fits
 *  IG-feed + IG-story + IG-reel doesn't show three IG icons. */
function uniqueNetworkPips(fits: string[]): IconPip[] {
  const seen = new Set<string>();
  const out: IconPip[] = [];
  for (const slug of fits) {
    const pip = frameSlugToPip(slug);
    if (!pip) continue;
    const key = pip.kind === "img" ? pip.url : "hardhat";
    if (!seen.has(key)) { seen.add(key); out.push(pip); }
  }
  return out;
}

export function ImageLibraryDrawer({
  onClose,
  onPick,
  currentFrameSlug
}: {
  onClose:          () => void;
  onPick:           (img: LibraryImage) => void;
  /** When set, filter the list to only images that fit this frame.
   *  The editor passes the currently-selected frame's slug so users
   *  don't have to think about compatibility. */
  currentFrameSlug: string | null;
}) {
  const [source,   setSource]   = useState<LibraryImage["source"]>("site");
  const [images,   setImages]   = useState<LibraryImage[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [hasMore,  setHasMore]  = useState(false);
  const [q,        setQ]        = useState("");
  const [filterFrame, setFilterFrame] = useState<boolean>(true);
  const [offset,   setOffset]   = useState(0);
  const [error,    setError]    = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const debounceRef = useRef<number | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async (append: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("source", source);
      params.set("limit",  "40");
      params.set("offset", String(append ? offset : 0));
      if (q.trim())                                params.set("q", q.trim());
      if (filterFrame && currentFrameSlug)         params.set("fits", currentFrameSlug);
      const res  = await fetch(`/api/site/editor/library?${params.toString()}`);
      const data = await res.json().catch(() => ({} as { images?: LibraryImage[]; hasMore?: boolean }));
      const next = (data.images ?? []);
      setImages(append ? [...images, ...next] : next);
      setHasMore(Boolean(data.hasMore));
      if (append) setOffset(offset + next.length);
      else        setOffset(next.length);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed.");
    } finally {
      setLoading(false);
    }
  }, [source, q, filterFrame, currentFrameSlug, offset, images]);

  // Reload on source / query / filter changes (debounced query).
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      setOffset(0);
      void load(false);
    }, 180);
    return () => { if (debounceRef.current) window.clearTimeout(debounceRef.current); };
    // Intentionally omit `load` from deps — load is defined with the
    // same state slice we're watching, causing an infinite loop
    // otherwise.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, q, filterFrame, currentFrameSlug]);

  // Escape closes + scroll lock while open.
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

  // "Upload to my images" — first-card action when the source is
  // My uploads. Reuses the overlays POST endpoint (category='custom')
  // which is the same table the library reads for the uploads source.
  const handleUpload = useCallback(async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const label = file.name.replace(/\.[^.]+$/, "").slice(0, 80) || "Upload";
      const ratio = await new Promise<number>((resolve) => {
        const img = new window.Image();
        img.onload  = () => resolve(img.naturalWidth / Math.max(1, img.naturalHeight));
        img.onerror = () => resolve(1);
        img.src = URL.createObjectURL(file);
      });
      const form = new FormData();
      form.append("file",         file);
      form.append("label",        label);
      form.append("category",     "custom");
      form.append("aspect_ratio", String(ratio));
      const res  = await fetch("/api/site/editor/overlays", { method: "POST", body: form });
      const data = await res.json().catch(() => ({} as { ok?: boolean; error?: string }));
      if (!res.ok || data.ok !== true) {
        setError(data.error === "not_authenticated" ? "Sign in to upload." : (data.error ?? "Upload failed."));
        return;
      }
      // Refresh the current source so the new upload appears in-place.
      setOffset(0);
      await load(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }, [load]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center"
      style={{ backgroundColor: "rgba(10,10,10,0.55)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Image library"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex h-[70vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl"
      >
        {/* Header — brand-yellow band per the design rules. The
            close button switches to black-on-yellow so it reads
            correctly against the new backdrop. */}
        <div className="flex flex-none items-center justify-between border-b px-4 py-2" style={{ borderColor: "rgba(0,0,0,0.10)", backgroundColor: BRAND_YELLOW }}>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: BRAND_BLACK }}>Image library</span>
            {currentFrameSlug && (
              <label className="flex cursor-pointer items-center gap-1 text-[10px] font-black uppercase tracking-wider" style={{ color: BRAND_BLACK }}>
                <input
                  type="checkbox"
                  checked={filterFrame}
                  onChange={(e) => setFilterFrame(e.target.checked)}
                  className="h-3 w-3 accent-black"
                />
                Fits current frame
              </label>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close library"
            className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-black/10"
            style={{ color: BRAND_BLACK }}
          >
            <X size={15} strokeWidth={2.6}/>
          </button>
        </div>

        {/* Source dropdown + search. Source is a native <select>
            (drop-down slider) rather than chip buttons so it reads
            as an input and doesn't compete visually with the tile
            grid below. */}
        <div className="flex flex-none flex-wrap items-center gap-2 border-b px-3 py-2" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
          <div className="relative">
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as LibraryImage["source"])}
              aria-label="Image source"
              className="h-9 appearance-none rounded-md border pl-3 pr-8 text-[11.5px] font-black uppercase tracking-wider focus:outline-none"
              style={{
                borderColor:     "rgba(139,69,19,0.20)",
                backgroundColor: "white",
                color:           BRAND_BLACK
              }}
            >
              {SOURCE_CHIPS.map((c) => (
                <option key={c.slug} value={c.slug}>{c.label}</option>
              ))}
            </select>
            <ChevronDown size={14} strokeWidth={2.4} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500"/>
          </div>
          <div className="ml-auto flex items-center gap-1 rounded-full border px-2" style={{ borderColor: "rgba(139,69,19,0.15)", backgroundColor: "white" }}>
            <Search size={12} className="text-neutral-500"/>
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search subject…"
              className="h-7 w-40 bg-transparent text-[12px] focus:outline-none"
            />
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-3">
          {error && (
            <div className="mb-2 rounded-md bg-red-50 px-2 py-1 text-[11px] font-black text-red-700">{error}</div>
          )}
          {images.length === 0 && !loading && (
            <div className="flex h-full items-center justify-center text-[12px] text-neutral-500">
              {q ? `No images match "${q}"` : "Nothing here yet."}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {/* Upload-first card — only for the My uploads source so
                merchants can add a new image in the same flow as
                picking one. Hidden on other sources to keep the tile
                grid pure browse. */}
            {source === "uploads" && (
              <>
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => uploadInputRef.current?.click()}
                  className="group relative flex flex-col overflow-hidden rounded-lg border-2 border-dashed transition hover:shadow-md disabled:opacity-60"
                  style={{ borderColor: "rgba(139,69,19,0.30)", backgroundColor: CREAM }}
                  title="Upload a new image to My uploads"
                >
                  <div className="flex h-32 w-full flex-col items-center justify-center gap-1 text-neutral-700">
                    {uploading ? <Loader2 size={22} className="animate-spin"/> : <UploadIcon size={22} strokeWidth={2}/>}
                    <span className="text-[10px] font-black uppercase tracking-wider">
                      {uploading ? "Uploading…" : "Upload to my images"}
                    </span>
                  </div>
                  <span className="border-t px-1.5 py-1 text-center text-[9px] uppercase tracking-wider text-neutral-500" style={{ borderColor: "rgba(139,69,19,0.08)" }}>
                    PNG · JPG · SVG · 8MB
                  </span>
                </button>
                <input
                  ref={uploadInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleUpload(f);
                    e.target.value = "";
                  }}
                />
              </>
            )}
            {images.map((img) => {
              const pips = uniqueNetworkPips(img.fits_frames);
              const isNetworkersOnly = pips.length === 1 && pips[0].kind === "lucide";
              return (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => { onPick(img); onClose(); }}
                  className="group relative flex flex-col overflow-hidden rounded-lg border bg-white transition hover:border-neutral-500 hover:shadow-md"
                  style={{ borderColor: "rgba(139,69,19,0.12)" }}
                  title={img.subject || undefined}
                >
                  <div className="relative h-32 w-full overflow-hidden bg-neutral-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.url}
                      alt={img.subject}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover transition group-hover:scale-105"
                    />
                    {/* Frame-fit pip row (top-right corner) */}
                    <div className="pointer-events-none absolute right-1 top-1 flex gap-0.5">
                      {isNetworkersOnly ? (
                        <div
                          className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[8.5px] font-black uppercase tracking-wider shadow-sm"
                          style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}
                        >
                          <HardHat size={9}/>
                          Canteen + Yard
                        </div>
                      ) : (
                        pips.map((pip, i) => pip.kind === "img" ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            key={i}
                            src={pip.url}
                            alt=""
                            className="h-5 w-5 rounded-full bg-white object-contain shadow"
                          />
                        ) : (
                          <div
                            key={i}
                            className="flex h-5 w-5 items-center justify-center rounded-full shadow"
                            style={{ backgroundColor: "rgba(0,0,0,0.7)", color: "white" }}
                          >
                            <pip.Icon size={11} strokeWidth={2.2}/>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                  {img.subject && (
                    <div className="line-clamp-2 border-t px-1.5 py-1 text-[10px] leading-tight text-neutral-700" style={{ borderColor: "rgba(139,69,19,0.08)" }}>
                      {img.subject}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {hasMore && (
            <div className="mt-3 flex justify-center">
              <button
                type="button"
                onClick={() => void load(true)}
                disabled={loading}
                className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[10.5px] font-black uppercase tracking-wider text-neutral-900 disabled:opacity-60"
                style={{ backgroundColor: BRAND_YELLOW }}
              >
                {loading ? <Loader2 size={11} className="animate-spin"/> : null}
                Load more
              </button>
            </div>
          )}
          {loading && images.length === 0 && (
            <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-4">
              <div className="relative">
                <Loader2 size={48} strokeWidth={2.2} className="animate-spin" style={{ color: BRAND_YELLOW }}/>
                <div
                  className="absolute inset-0 rounded-full"
                  style={{ boxShadow: `0 0 20px ${BRAND_YELLOW}55` }}
                />
              </div>
              <div className="flex flex-col items-center gap-1">
                <span
                  className="animate-pulse text-[13px] font-black uppercase tracking-[0.28em]"
                  style={{ color: BRAND_BLACK }}
                >
                  Loading
                </span>
                <span className="text-[10px] font-medium uppercase tracking-wider text-neutral-500">
                  Fetching your image library
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
