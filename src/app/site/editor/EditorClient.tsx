"use client";

// EditorClient — the Konva canvas + toolrail for The Site Editor.
//
// Layout (desktop):
//   ┌───────────────────────────────────────────────┐
//   │ Frame picker (network chips → aspect chips)   │
//   ├───────────────┬───────────────────────────────┤
//   │ Left toolrail │  Best size hint               │
//   │  • Upload      │  ┌───────────────────────┐   │
//   │  • Text        │  │                       │   │
//   │  • Overlays    │  │      Konva stage      │   │
//   │  • Banners     │  │      (dashed frame)   │   │
//   │  • Shapes      │  │                       │   │
//   │  • 3D          │  └───────────────────────┘   │
//   │  • AI caption  │                              │
//   ├───────────────┴───────────────────────────────┤
//   │ Bottom action bar — Save · Download · Share · │
//   │ Share to Social (Auto-post)                    │
//   └───────────────────────────────────────────────┘
//
// The Konva pieces are dynamically imported so this file doesn't
// bloat the initial JS payload — Konva is ~200KB gzipped.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Download, Loader2, Save, Send, Sparkles, Type, Image as ImageIcon, Square, Circle, Triangle, ArrowRight as ArrowIcon, Star, Trash2, Layers, RotateCw, MoveUp, MoveDown, Upload as UploadIcon, Camera, MessageCircle, Music2, Ghost, HardHat, Video as VideoIcon, Play, Pause, Undo2, Redo2, Copy, ChevronDown, X, LayoutTemplate, Wallet, Plus, Crown } from "lucide-react";
import { EDITOR_FRAMES, NETWORK_META, NETWORK_ICON_URL, EMPTY_FRAME_BG_URL, bestFitFrame, type EditorFrame, type NetworkSlug } from "@/lib/siteEditor/frames";
import { ImageLibraryDrawer, type LibraryImage } from "@/components/site/ImageLibraryDrawer";
import { SocialLinksDrawer, type SocialLinks, type SocialNetworkSlug } from "@/components/site/SocialLinksDrawer";
import type { CarouselSlide, EditorLayer, EditorState, TextLayer, ShapeLayer, OverlayLayer, BannerLayer, ImageLayer, ObjectLayer } from "@/lib/siteEditor/types";
import { newEmptyState, newEmptySlide, newEmptyBaseSlot, activeSlide, withActiveSlide, migrateLegacyState, type BaseImageSlot } from "@/lib/siteEditor/types";
import { SlideNavigator, CAROUSEL_MAX_SLIDES } from "./SlideNavigator";
import { OVERLAY_GROUPS, EDITOR_BADGES, type Overlay } from "@/lib/siteEditor/overlays";
import { useHistoryState } from "@/lib/siteEditor/useHistoryState";
import { FONT_CATALOGUE } from "@/lib/siteEditor/fonts";
import { BANNER_LIBRARY, type Banner } from "@/lib/siteEditor/banners";
import { SHAPE_LIBRARY, SHAPE_CATEGORIES, stylePreset, type ShapeCategory } from "@/lib/siteEditor/shapes";
import { SHOWCASE_TEMPLATES } from "@/lib/siteEditor/showcaseTemplates";
import { resolveTemplateLayers, type TemplateContent } from "@/lib/siteEditor/frameLayout";

const BRAND_BLACK  = "#0A0A0A";
const BRAND_YELLOW = "#FFB300";
const CREAM        = "#FBF6EC";
const CANVAS_MAX_PX = 720;   // desktop cap; mobile uses viewport-derived sizing

// Module-level template cache. Fetched ONCE per page load (kicked
// off from the editor mount), reused for every drawer open in the
// same session. Eliminates the spinner flash on subsequent opens.
// Declared here at the top of the file — before any function that
// closes over it — so it exists in every closure scope.
type CachedTemplate = {
  id:                 string;
  slug:               string;
  label:              string;
  category:           string;
  frame_slug:         string;
  state:              unknown;
  thumbnail_url:      string | null;
  sibling_group_slug?: string | null;
  preview?:           Record<string, unknown>;
  content?:           Record<string, unknown>;
  imageUrl?:          string;
  isCrown?:           boolean;
  tradeSlugs?:        string[];
  phoneSlot?:         Record<string, unknown>;
};

let templatesCache: CachedTemplate[] | null = null;
let templatesPromise: Promise<CachedTemplate[]> | null = null;

async function ensureTemplatesCache(): Promise<CachedTemplate[]> {
  if (templatesCache) return templatesCache;
  if (templatesPromise) return templatesPromise;
  templatesPromise = (async () => {
    try {
      const res  = await fetch("/api/site/editor/templates");
      const data = await res.json().catch(() => ({ templates: [] }));
      const dbTemplates = (data.templates as CachedTemplate[] | undefined) ?? [];
      const dbSlugs = new Set(dbTemplates.map((t) => t.slug));
      const merged = [
        ...(SHOWCASE_TEMPLATES as unknown as CachedTemplate[]).filter((t) => !dbSlugs.has(t.slug)),
        ...dbTemplates
      ];
      templatesCache = merged;
      return merged;
    } catch {
      templatesCache = [...(SHOWCASE_TEMPLATES as unknown as CachedTemplate[])];
      return templatesCache;
    } finally {
      templatesPromise = null;
    }
  })();
  return templatesPromise;
}

/** Viewport hook — returns responsive canvas dimensions + a mobile
 *  flag. Runs client-side; SSR falls back to desktop max so the
 *  first paint doesn't jump. Recomputes on resize + orientation
 *  change so rotating the phone re-fits the canvas.
 *
 *  Mobile-specific budget:
 *    - short side max = viewport width - 24px padding
 *    - long side max  = 55% of viewport height (leaves room for
 *      frame picker, mode toggle, caption + fixed action bar)
 *    - never exceeds CANVAS_MAX_PX on any device (desktop cap) */
function useEditorViewport(frameAspect: number): { canvasW: number; canvasH: number; isMobile: boolean; vw: number } {
  // SSR + first hydration render ALWAYS assume desktop dimensions so
  // the server and client emit identical HTML — otherwise React
  // throws a hydration mismatch on mobile devices ("server sent
  // desktop layout, client wants mobile"). The real viewport is
  // read AFTER mount inside the effect below, triggering a second
  // render with the true isMobile flag.
  const [vw, setVw] = useState<number>(1280);
  const [vh, setVh] = useState<number>(900);
  useEffect(() => {
    const onResize = () => {
      setVw(window.innerWidth);
      setVh(window.innerHeight);
    };
    onResize();                          // set real viewport on mount
    window.addEventListener("resize",            onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize",            onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);

  const isMobile = vw < 768;                                    // tailwind md breakpoint
  // Short side available in the layout:
  //   mobile: viewport width - 32px  (outer .p-3 = 24px + 8px safety
  //           margin so the canvas wrapper never overflows the flex
  //           column into which it's stacked)
  //   desktop: capped at CANVAS_MAX_PX
  const shortSideBudget = isMobile
    ? Math.max(240, vw - 32)                                    // never go below 240 (tiny devices)
    : CANVAS_MAX_PX;
  // Long-side ceiling — on mobile we cap by height so the canvas
  // doesn't push the tool rail + action bar below the fold. Both
  // the fixed tool rail (56px) + action bar (56px) + safe area
  // reserve ~140px, so budget 55% of viewport height.
  const longSideCeiling = isMobile ? Math.max(320, vh * 0.55) : CANVAS_MAX_PX;

  let canvasW: number, canvasH: number;
  if (frameAspect >= 1) {
    // Landscape or square — width dominates.
    canvasW = Math.min(shortSideBudget, longSideCeiling * frameAspect);
    canvasH = canvasW / frameAspect;
  } else {
    // Portrait — height dominates.
    canvasH = Math.min(shortSideBudget / frameAspect, longSideCeiling);
    canvasW = canvasH * frameAspect;
  }
  return {
    canvasW: Math.round(canvasW),
    canvasH: Math.round(canvasH),
    isMobile,
    vw
  };
}

// Konva is client-only. Single dynamic import for the WHOLE canvas
// (per-component dynamic() imports produced a broken scene tree —
// KImage tried to mount before its parent Layer had finished
// loading, so the base image never showed after upload).
const EditorCanvasDynamic = dynamic(
  () => import("./EditorCanvas").then((m) => m.EditorCanvas),
  { ssr: false, loading: () => <div className="flex h-full w-full items-center justify-center text-[11px] text-neutral-400">Loading canvas…</div> }
);

type Tool = "upload" | "video" | "library" | "text" | "overlays" | "banners" | "shapes" | "objects" | "templates";

const VIDEO_ACCEPT = "video/mp4,video/quicktime,video/mov";

/** Load an <img> element from any URL — used by Konva.Image which
 *  wants an HTMLImageElement, not a URL. Also captures natural
 *  dimensions so we can centre-fit the base image on load.
 *  crossOrigin is set only for cross-origin http(s) sources — data:
 *  URLs from FileReader don't need it and setting it can cause
 *  spurious re-fetches that fail on some Chromium builds. */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    if (/^https?:/i.test(src)) {
      img.crossOrigin = "anonymous";
    }
    img.onload  = () => resolve(img);
    img.onerror = (err) => {
      console.error("[editor] loadImage failed", src.slice(0, 60), err);
      reject(err);
    };
    img.src = src;
  });
}

/** Fit the base image inside the frame — cover behaviour so no
 *  dead space. Returns { scale, offsetX, offsetY } that centres the
 *  image on the frame and covers every pixel. */
function coverFit(imgW: number, imgH: number, frameW: number, frameH: number) {
  const scaleX = frameW / imgW;
  const scaleY = frameH / imgH;
  const scale  = Math.max(scaleX, scaleY);
  const displayW = imgW * scale;
  const displayH = imgH * scale;
  return {
    scale,
    offsetX: (frameW - displayW) / 2,
    offsetY: (frameH - displayH) / 2
  };
}

export function EditorClient({
  paid,
  initialImage,
  initialDraft,
  merchantSlug,
  adminAuthoring,
  adminTemplateSeed
}: {
  paid:          boolean;
  initialImage:  { id: string; url: string; alt: string } | null;
  initialDraft:  { id: string; state: unknown } | null;
  /** Signed-in merchant's slug — powers the AI panel's washer
   *  balance fetch + the "Top up" link. Anonymous callers get
   *  null and the AI panel is disabled with a Sign-in hint. */
  merchantSlug:  string | null;
  /** Admin template authoring mode — true only when an admin opens
   *  the editor via /site/editor?admin_template=... . Toggles the
   *  Save-as-template panel + suppresses autosave/draft persistence
   *  so template drafting doesn't clobber the merchant's own drafts. */
  adminAuthoring: boolean;
  /** If the admin opened an existing template for editing, this
   *  carries its metadata + state so the editor pre-fills. Null
   *  when adminTemplate=new (fresh authoring). */
  adminTemplateSeed: { slug: string; state: unknown; frame_slug: string; label: string; category: string; sibling_group_slug: string | null } | null;
}) {
  // -------------------------------------------------------------- state
  // Restore the merchant's most-recent draft on mount when the page
  // wasn't opened from a deep-linked ?image_id. Legacy top-level
  // shapes are migrated in-place. If restoration produces an invalid
  // shape (garbage row) migrateLegacyState returns a safe empty
  // single-slide state.
  const initialState = (() => {
    // Admin authoring — pre-fill with the requested template's state
    // (existing template) or a fresh empty canvas (adminTemplate=new).
    if (adminAuthoring && adminTemplateSeed) {
      return migrateLegacyState(adminTemplateSeed.state);
    }
    if (initialDraft) {
      const migrated = migrateLegacyState(initialDraft.state);
      return migrated;
    }
    const s = newEmptyState(EDITOR_FRAMES[0].slug);
    if (initialImage) {
      // Seed the first slide (single-slide compositions ARE just a
      // one-item carousel) with the incoming Site image.
      s.slides[0].base.sourceImageId = initialImage.id;
      s.slides[0].base.url           = initialImage.url;
    }
    return s;
  })();
  // Pick the frame catalogue entry that matches the hydrated state
  // so the UI's frame chip + canvas aspect align with the restored
  // draft. Falls back to the first frame if the slug is unknown.
  const initialFrame = EDITOR_FRAMES.find((f) => f.slug === initialState.frameSlug) ?? EDITOR_FRAMES[0];
  const [frame, setFrame] = useState<EditorFrame>(initialFrame);
  // Editor state is wrapped in a history stack so Ctrl+Z / Ctrl+Y
  // undo + redo any layer / base / frame change.
  const {
    state,
    setState,
    undo,
    redo,
    canUndo,
    canRedo
  } = useHistoryState<EditorState>(initialState);
  // Always-up-to-date view of the active slide's base/layers/mode/
  // secondaryBase. Every render path + effect reads through this so
  // nothing else in EditorClient needs to know slides exist.
  // Declared here (not below the tool helpers) so useEffect blocks
  // in the middle of the file can depend on it without TDZ errors.
  const activeS = useMemo(() => activeSlide(state), [state]);
  const [selectedTool, setSelectedTool] = useState<Tool>("upload");
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [busy, setBusy] = useState<"none" | "export" | "save" | "share" | "ai">("none");
  const [status, setStatus] = useState<string | null>(null);
  /** Temporarily suppress the safe-zone dim overlay so it doesn't
   *  bake into the flatten during export. doExport flips this true
   *  before toDataURL and back false in finally. */
  const [suppressSafeZone, setSuppressSafeZone] = useState<boolean>(false);
  const [caption, setCaption] = useState<string>("");
  // AI panel state — merchants describe what the post is about; the
  // subject seeds a short label (also fed to the caption prompt) and
  // the goal describes what outcome they want. Both are inputs to
  // the AI caption request. On success the returned caption fills
  // the `caption` state.
  const [aiSubject, setAiSubject] = useState<string>(initialImage?.alt ?? "");
  const [washerBalance, setWasherBalance] = useState<number | null>(null);
  const [shareMenuOpen, setShareMenuOpen] = useState(false);

  // Ctrl+Z / Cmd+Z = undo · Ctrl+Y / Ctrl+Shift+Z / Cmd+Shift+Z = redo.
  // Skipped while a focussed <input>/<textarea>/contenteditable owns
  // the caret so the browser's own text-undo still works there.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inField = !!target && (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        (target as HTMLElement).isContentEditable
      );
      if (inField) return;
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      else if ((k === "z" && e.shiftKey) || k === "y") { e.preventDefault(); redo(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);
  const [libraryOpen, setLibraryOpen] = useState<null | "overlays" | "banners" | "images" | "shapes" | "templates" | "backdrops">(null);
  const [socialDrawer, setSocialDrawer] = useState<null | { focus?: SocialNetworkSlug; intro?: string }>(null);
  const [socialLinks, setSocialLinks] = useState<SocialLinks | null>(null);
  // "Change" sheet — the top-left canvas button opens a slide-up
  // panel where the merchant switches between Single and Before/After
  // style. Replaces the old inline toggle under the canvas.
  const [changeSheetOpen, setChangeSheetOpen] = useState(false);

  /** Adopt a picked library image as the base layer. If the image
   *  doesn't cleanly fit the current frame we auto-switch to the
   *  image's best-fit frame so the composition looks right without
   *  the user having to think about ratios. */
  // Seed from the hydrated draft so the first autosave UPDATEs the
  // same row instead of inserting a fresh duplicate. Nulls out on a
  // clean bootstrap (no draft) so the first save INSERTs.
  const [draftId, setDraftId] = useState<string | null>(initialDraft?.id ?? null);
  const [baseImg, setBaseImg] = useState<HTMLImageElement | null>(null);
  const [secondaryImg, setSecondaryImg] = useState<HTMLImageElement | null>(null);
  const [layerImgs, setLayerImgs] = useState<Record<string, HTMLImageElement>>({});
  // Video playback state — used when base.kind === "video".
  const [videoEl, setVideoEl]         = useState<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying]     = useState(false);
  const [videoTime, setVideoTime]     = useState(0);
  // Which base slot the file picker + library pick will target when
  // the user is in beforeAfter mode. In single mode always "base".
  const [activeSlot, setActiveSlot] = useState<"base" | "secondary">("base");

  const handleLibraryPick = useCallback((img: LibraryImage) => {
    const currentFits = img.fits_frames.includes(frame.slug);
    // Only auto-switch the frame when adopting for the primary slot;
    // secondary slot inherits the primary's frame so before/after stay
    // aligned.
    const shouldSwitchFrame = activeSlot === "base" && !currentFits && img.natural_aspect;
    if (shouldSwitchFrame && img.natural_aspect) {
      const best = bestFitFrame(img.natural_aspect);
      setFrame(best);
    }
    const slot: BaseImageSlot = {
      sourceImageId: img.source === "site" ? img.id : null,
      url:           img.url,
      offsetX:       0,
      offsetY:       0,
      scale:         1
    };
    setState((prev) => {
      // frameSlug lives at the top of EditorState — patch it there;
      // base/secondaryBase belong to the ACTIVE slide, so route
      // those through withActiveSlide. Doing both in one setState
      // keeps the frame swap + base swap atomic (single history
      // entry for undo).
      const withFrame = shouldSwitchFrame && img.natural_aspect
        ? { ...prev, frameSlug: bestFitFrame(img.natural_aspect).slug }
        : prev;
      return withActiveSlide(withFrame, (s) => activeSlot === "base"
        ? { ...s, base: slot }
        : { ...s, secondaryBase: slot });
    });
  }, [frame.slug, activeSlot, setState]);
  const stageRef = useRef<{
    toDataURL: (config?: { pixelRatio?: number; mimeType?: string; quality?: number }) => string;
  } | null>(null);
  // Two file inputs — one accepting only images, one only video —
  // so the browser's native picker filters correctly for the media
  // type the user has explicitly chosen. Prevents users accidentally
  // uploading a 4GB video via the "image" flow.
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  // Explicit media choice for this session — controls which picker
  // opens from the top "Today's edit" chooser + the tool-rail Upload
  // button. Defaults to "image" so first-time users get the familiar
  // photo flow without extra clicks.
  const [mediaChoice, setMediaChoice] = useState<"image" | "video">("image");
  const openImagePicker = useCallback(() => {
    setMediaChoice("image");
    window.setTimeout(() => imageInputRef.current?.click(), 0);
  }, []);
  const openVideoPicker = useCallback(() => {
    setMediaChoice("video");
    window.setTimeout(() => videoInputRef.current?.click(), 0);
  }, []);
  const openFilePicker = useCallback(() => {
    // Legacy caller — routes to whichever picker matches the current
    // media choice. New code should call openImagePicker /
    // openVideoPicker directly.
    if (mediaChoice === "video") openVideoPicker();
    else                          openImagePicker();
  }, [mediaChoice, openImagePicker, openVideoPicker]);

  // Responsive canvas — viewport-derived on mobile, capped at
  // CANVAS_MAX_PX on desktop, always aligned to the current frame's
  // aspect ratio. Recomputes on window resize + orientation change.
  const { canvasW: hookW, canvasH: hookH, isMobile } = useEditorViewport(frame.aspectW / frame.aspectH);
  // Also measure the actual container width via ResizeObserver so the
  // canvas NEVER overflows its column regardless of viewport padding,
  // sidebars or zoom. containerWidth clamps the hook's output.
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  useEffect(() => {
    const el = canvasContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      if (w > 0) setContainerWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const canvas = useMemo(() => {
    const aspect = frame.aspectW / frame.aspectH;
    // If the container is narrower than the hook's short side (mobile
    // + landscape orientations, tight tablets), scale everything down
    // so the canvas fits without overflowing.
    let w = hookW;
    let h = hookH;
    if (containerWidth > 0 && w > containerWidth) {
      w = containerWidth;
      h = w / aspect;
    }
    return { w: Math.round(w), h: Math.round(h) };
  }, [hookW, hookH, containerWidth, frame.aspectW, frame.aspectH]);

  // Refs that mirror image-load state so the export loop can
  // deterministically wait for the canvas to be ready before
  // capturing a slide. Reading state directly would race React's
  // commit cycle; refs update synchronously alongside setBaseImg.
  const baseImgLoadedUrlRef = useRef<string | null>(null);
  const secondaryImgLoadedUrlRef = useRef<string | null>(null);
  const layerImgsRef        = useRef<Record<string, HTMLImageElement>>({});
  /** Semantic content of the last-applied showcase template. When
   *  set, `changeFrame` re-resolves the layer stack for the new
   *  frame using the template's TemplateContent — so text stays
   *  inside the safe zone across every frame swap. Cleared as
   *  soon as the merchant edits any layer manually so their edits
   *  aren't overwritten on a subsequent frame swap. */
  const templateContentRef = useRef<TemplateContent | null>(null);

  // Warm the template + image library caches on editor mount so the
  // drawers open instantly the first time the merchant taps them.
  // Fire-and-forget — no need to await.
  useEffect(() => {
    void ensureTemplatesCache();
  }, []);

  // Load the base image whenever its URL changes.
  useEffect(() => {
    if (!activeS.base.url) { setBaseImg(null); baseImgLoadedUrlRef.current = null; return; }
    let cancelled = false;
    const targetUrl = activeS.base.url;
    loadImage(targetUrl).then((img) => {
      if (cancelled) return;
      setBaseImg(img);
      baseImgLoadedUrlRef.current = targetUrl;
      // On first load, cover-fit the image to the current frame.
      // Skip when scaleX/scaleY has been manually set (via the
      // W/H scale bars) so the merchant's resize sticks.
      setState((prev) => withActiveSlide(prev, (s) => {
        if (s.base.offsetX !== 0 || s.base.offsetY !== 0 || s.base.scale !== 1) return s;
        if (s.base.scaleX !== undefined || s.base.scaleY !== undefined) return s;
        const fit = coverFit(img.naturalWidth, img.naturalHeight, canvas.w, canvas.h);
        return { ...s, base: { ...s.base, ...fit } };
      }));
    }).catch(() => { /* fallback: canvas just shows empty */ });
    return () => { cancelled = true; };
  }, [activeS.base.url, canvas.w, canvas.h]);

  // Re-resolve template layers whenever the display canvas
  // dimensions change (frame swap, viewport resize). Only fires
  // when a showcase template is tracked (templateContentRef set).
  // Ensures text sits inside the safe zone at the right display
  // size for whatever frame + viewport the merchant is on.
  useEffect(() => {
    const trackedContent = templateContentRef.current;
    if (!trackedContent) return;
    if (!canvas.w || !frame.pixelW) return;
    const displayScale = canvas.w / frame.pixelW;
    const resolved = resolveTemplateLayers(trackedContent, frame.slug, displayScale);
    setState((prev) => withActiveSlide(prev, (s) => ({
      ...s,
      layers: resolved as unknown as EditorLayer[]
    })));
  }, [canvas.w, canvas.h, frame.slug, frame.pixelW]);

  // Re-fit base image when the frame ratio changes so the image
  // continues to cover the new dashed box.
  useEffect(() => {
    if (!baseImg) return;
    setState((prev) => withActiveSlide(prev, (s) => ({
      ...s,
      base: { ...s.base, ...coverFit(baseImg.naturalWidth, baseImg.naturalHeight, canvas.w, canvas.h) }
    })));
  }, [baseImg, canvas.w, canvas.h]);

  // Load secondaryBase (right-half image) when its URL changes.
  // Only kicks in when the editor is in beforeAfter mode.
  useEffect(() => {
    const url = activeS.secondaryBase?.url ?? null;
    if (!url) { setSecondaryImg(null); secondaryImgLoadedUrlRef.current = null; return; }
    let cancelled = false;
    loadImage(url).then((img) => {
      if (cancelled) return;
      setSecondaryImg(img);
      secondaryImgLoadedUrlRef.current = url;
      setState((prev) => withActiveSlide(prev, (s) => {
        const cur = s.secondaryBase;
        if (!cur || (cur.offsetX !== 0 || cur.offsetY !== 0 || cur.scale !== 1)) return s;
        // Right half is width/2 pixels wide, so cover-fit against
        // that. Then shift x so the image lands INSIDE the right half.
        const fit = coverFit(img.naturalWidth, img.naturalHeight, canvas.w / 2, canvas.h);
        return {
          ...s,
          secondaryBase: { ...cur, ...fit, offsetX: fit.offsetX + canvas.w / 2 }
        };
      }));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [activeS.secondaryBase?.url, canvas.w, canvas.h]);

  // Load a hidden HTMLVideoElement when the base is a video. Konva
  // uses this element as the KImage texture; overlays composite on
  // top. Muted + playsInline is required so mobile browsers allow
  // in-page playback without going fullscreen.
  useEffect(() => {
    if (activeS.base.kind !== "video" || !activeS.base.url) {
      setVideoEl(null);
      setIsPlaying(false);
      setVideoTime(0);
      return;
    }
    const el = document.createElement("video");
    el.src           = activeS.base.url;
    el.muted         = true;
    el.playsInline   = true;
    el.crossOrigin   = "anonymous";
    el.loop          = true;
    el.preload       = "auto";
    let ready = false;
    el.onloadedmetadata = () => {
      ready = true;
      setVideoEl(el);
      // Initialise trim range to full duration if unset.
      setState((prev) => withActiveSlide(prev, (s) => {
        if (s.base.trimFrom !== undefined && s.base.trimTo !== undefined) return s;
        return { ...s, base: { ...s.base, trimFrom: 0, trimTo: el.duration } };
      }));
    };
    el.ontimeupdate = () => {
      const t = el.currentTime;
      setVideoTime(t);
      // Enforce trim boundaries — jump back to trimFrom when we hit trimTo.
      const trimTo = activeS.base.trimTo;
      if (typeof trimTo === "number" && t >= trimTo - 0.05) {
        el.currentTime = activeS.base.trimFrom ?? 0;
      }
    };
    el.onplay  = () => setIsPlaying(true);
    el.onpause = () => setIsPlaying(false);
    return () => {
      try { el.pause(); } catch { /* ignore */ }
      el.src = "";
      // Only clear videoEl if we actually set it — avoids clobbering a
      // fresh load on rapid src changes.
      if (ready) setVideoEl((cur) => (cur === el ? null : cur));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeS.base.url, activeS.base.kind]);

  // Video controls — play/pause + seek. Wrapped so nothing else in
  // the file needs to know about the videoEl ref.
  const togglePlay = useCallback(() => {
    if (!videoEl) return;
    if (isPlaying) { videoEl.pause(); }
    else           { void videoEl.play(); }
  }, [videoEl, isPlaying]);
  const seekTo = useCallback((sec: number) => {
    if (!videoEl) return;
    const from = activeS.base.trimFrom ?? 0;
    const to   = activeS.base.trimTo ?? (activeS.base.videoDurationS ?? sec);
    videoEl.currentTime = Math.max(from, Math.min(to, sec));
  }, [videoEl, activeS.base.trimFrom, activeS.base.trimTo, activeS.base.videoDurationS]);

  // Load image elements for any image/overlay/banner layers.
  useEffect(() => {
    const needed: Array<{ id: string; url: string }> = [];
    for (const layer of activeS.layers) {
      if ("url" in layer && layer.url && !layerImgs[layer.id]) {
        needed.push({ id: layer.id, url: layer.url });
      }
    }
    if (needed.length === 0) return;
    let cancelled = false;
    Promise.all(needed.map(async (n) => ({ id: n.id, img: await loadImage(n.url).catch(() => null) })))
      .then((results) => {
        if (cancelled) return;
        setLayerImgs((prev) => {
          const next = { ...prev };
          for (const r of results) {
            if (r.img) next[r.id] = r.img;
          }
          // Mirror into a ref so waitForSlideReady (used by the
          // multi-slide export loop) can read the live map without
          // waiting for React to commit.
          layerImgsRef.current = next;
          return next;
        });
      });
    return () => { cancelled = true; };
  }, [activeS.layers, layerImgs]);

  // -------------------------------------------------------------- helpers
  const patchState = useCallback((mut: (s: EditorState) => EditorState) => {
    setState((prev) => mut(prev));
  }, []);
  /** Update the CURRENTLY-ACTIVE slide. Every write that used to
   *  target base/layers/mode/secondaryBase at the top of state now
   *  goes through here so slide navigation is transparent. */
  const patchSlide = useCallback((mut: (slide: CarouselSlide) => CarouselSlide) => {
    setState((prev) => withActiveSlide(prev, mut));
  }, []);

  // ---- Slide navigation (carousel) --------------------------------
  const selectSlide = useCallback((index: number) => {
    setState((prev) => {
      if (index < 0 || index >= prev.slides.length) return prev;
      if (index === prev.activeSlideIndex) return prev;
      return { ...prev, activeSlideIndex: index };
    });
    // Switching slides drops the current selection — the previous
    // layer id belongs to the OLD slide and would highlight nothing.
    setSelectedLayerId(null);
  }, []);
  const addSlide = useCallback(() => {
    setState((prev) => {
      if (prev.slides.length >= CAROUSEL_MAX_SLIDES) return prev;
      const nextSlides = [...prev.slides, newEmptySlide()];
      return { ...prev, slides: nextSlides, activeSlideIndex: nextSlides.length - 1 };
    });
    setSelectedLayerId(null);
  }, []);
  const removeSlide = useCallback((index: number) => {
    setState((prev) => {
      if (prev.slides.length <= 1) return prev;
      if (index < 0 || index >= prev.slides.length) return prev;
      const nextSlides = prev.slides.slice(0, index).concat(prev.slides.slice(index + 1));
      const nextActive = Math.min(prev.activeSlideIndex, nextSlides.length - 1);
      return { ...prev, slides: nextSlides, activeSlideIndex: nextActive };
    });
    setSelectedLayerId(null);
  }, []);

  const addLayer = useCallback((layer: EditorLayer) => {
    patchSlide((s) => ({ ...s, layers: [...s.layers, layer] }));
    setSelectedLayerId(layer.id);
  }, [patchSlide]);
  const updateLayer = useCallback((id: string, patch: Partial<EditorLayer>) => {
    // Any manual layer edit means the merchant has taken over from
    // the template. Clear the tracked content so a subsequent frame
    // swap uses the proportional-rescale path and preserves their
    // edits instead of re-resolving back to the template baseline.
    templateContentRef.current = null;
    patchSlide((s) => ({
      ...s,
      layers: s.layers.map((l) => l.id === id ? ({ ...l, ...patch } as EditorLayer) : l)
    }));
  }, [patchSlide]);
  const removeLayer = useCallback((id: string) => {
    patchSlide((s) => ({ ...s, layers: s.layers.filter((l) => l.id !== id) }));
    setSelectedLayerId((cur) => cur === id ? null : cur);
  }, [patchSlide]);
  const bumpZ = useCallback((id: string, dir: 1 | -1) => {
    patchSlide((s) => ({
      ...s,
      layers: s.layers.map((l) => l.id === id ? { ...l, z: l.z + dir } : l)
    }));
  }, [patchSlide]);
  /** Duplicate a layer with a small +20px offset so the copy is
   *  visually distinct from the original. Puts the new layer on top
   *  (max z + 1) and selects it so drag-to-place is instant. */
  const duplicateLayer = useCallback((id: string) => {
    // Compute the new id ONCE outside patchSlide so we can select it
    // deterministically after the state commit.
    const newId = `dup-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    patchSlide((s) => {
      const src = s.layers.find((l) => l.id === id);
      if (!src) return s;
      const maxZ = s.layers.reduce((m, l) => Math.max(m, l.z), 0);
      const copy: EditorLayer = {
        ...src,
        id: newId,
        x:  src.x + 20,
        y:  src.y + 20,
        z:  maxZ + 1
      };
      return { ...s, layers: [...s.layers, copy] };
    });
    setSelectedLayerId(newId);
  }, [patchSlide]);

  const changeFrame = useCallback((next: EditorFrame) => {
    // The re-resolve happens in a follow-up useEffect that fires
    // after canvas.w / canvas.h update for the new frame (React
    // re-runs useEditorViewport → new canvas dims → resolver reruns
    // with the right displayScale). Here we just do the proportional
    // rescale so the interim frame has something sensible on it.

    // Rescale every layer proportionally so text + shapes + overlays
    // reposition and resize when the frame swaps. Not as precise as
    // the resolver path, but preserves user intent for non-template
    // compositions.
    const prev = frame;
    const sx  = next.pixelW / prev.pixelW;
    const sy  = next.pixelH / prev.pixelH;
    // Font + uniform-dimension size scaling uses the smaller axis so
    // text stays readable when going wider (e.g. square → landscape)
    // and doesn't overflow when going taller.
    const sk  = Math.min(sx, sy);

    const rescaleLayer = (layer: EditorLayer): EditorLayer => {
      const base = {
        ...layer,
        x: Math.round(layer.x * sx),
        y: Math.round(layer.y * sy)
      };
      switch (layer.kind) {
        case "text":
          return {
            ...(base as TextLayer),
            width:    Math.max(40, Math.round(layer.width    * sx)),
            fontSize: Math.max(12, Math.round(layer.fontSize * sk))
          };
        case "image":
        case "overlay":
        case "banner":
        case "shape":
        case "object3d":
          return {
            ...(base as ImageLayer | OverlayLayer | BannerLayer | ShapeLayer | ObjectLayer),
            width:  Math.max(8, Math.round(layer.width  * sx)),
            height: Math.max(8, Math.round(layer.height * sy))
          };
        default:
          return base as EditorLayer;
      }
    };

    setFrame(next);
    patchState((s) => {
      const rescaledSlides = s.slides.map((slide) => ({
        ...slide,
        layers: slide.layers.map(rescaleLayer)
      }));

      // If we're switching to a frame that DOESN'T support carousels
      // and we currently have multi-slide state, collapse down to the
      // active slide so the user's current edit survives + the extra
      // slides don't silently persist in a hidden state.
      if (!next.supportsCarousel && rescaledSlides.length > 1) {
        return {
          ...s,
          frameSlug: next.slug,
          slides: [rescaledSlides[s.activeSlideIndex] ?? rescaledSlides[0]],
          activeSlideIndex: 0
        };
      }
      return { ...s, frameSlug: next.slug, slides: rescaledSlides };
    });
  }, [patchState, frame]);

  const selectedLayer = activeS.layers.find((l) => l.id === selectedLayerId) ?? null;

  // -------------------------------------------------------------- tools
  const handleUploadBase = useCallback((file: File) => {
    const isVideo = /^video\//i.test(file.type);
    if (isVideo) {
      // Video path — send to server so we can server-verify duration
      // + size, upload to storage, and return a public URL the
      // <video> element can stream from.
      setBusy("share");
      setStatus("Uploading video…");
      (async () => {
        try {
          const form = new FormData();
          form.append("file", file);
          const res = await fetch("/api/site/editor/video/upload", { method: "POST", body: form });
          const data = await res.json().catch(() => ({} as {
            ok?: boolean; input_url?: string; input_storage?: string; input_duration_s?: number;
            input_width?: number; input_height?: number; input_bytes?: number;
            error?: string; limit_s?: number; actual_s?: number;
          }));
          if (!res.ok || data.ok !== true || !data.input_url) {
            if (data.error === "too_long") {
              setStatus(`Video is ${data.actual_s}s — max ${data.limit_s}s. Trim and try again.`);
            } else if (data.error === "too_large") {
              setStatus("Video is over 100MB — please shorten or compress.");
            } else if (data.error === "not_authenticated") {
              setStatus("Sign in to upload video.");
            } else {
              setStatus(data.error ?? "Video upload failed.");
            }
            return;
          }
          const slot: BaseImageSlot = {
            sourceImageId:  null,
            url:            data.input_url,
            offsetX:        0,
            offsetY:        0,
            scale:          1,
            kind:           "video",
            videoDurationS: data.input_duration_s,
            videoStorage:   data.input_storage,
            videoWidth:     data.input_width,
            videoHeight:    data.input_height,
            videoBytes:     data.input_bytes
          };
          patchSlide((s) => activeSlot === "base"
            ? { ...s, base: slot }
            : { ...s, secondaryBase: slot });
          setStatus(`Video ready · ${data.input_duration_s}s · ${(data.input_bytes ? data.input_bytes / (1024 * 1024) : 0).toFixed(1)}MB`);
        } catch (e) {
          setStatus(e instanceof Error ? e.message : "Upload failed.");
        } finally {
          setBusy("none");
        }
      })();
      return;
    }

    // Image path — same client-side data-URL flow as before.
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result ?? "");
      if (!url) return;
      const slot: BaseImageSlot = { sourceImageId: null, url, offsetX: 0, offsetY: 0, scale: 1, kind: "image" };
      patchSlide((s) => activeSlot === "base"
        ? { ...s, base: slot }
        : { ...s, secondaryBase: slot });
    };
    reader.readAsDataURL(file);
  }, [patchSlide, activeSlot]);

  const addText = useCallback(() => {
    const layer: TextLayer = {
      id:         `text-${Date.now()}`,
      kind:       "text",
      z:          activeS.layers.length,
      x:          Math.round(canvas.w / 2 - 120),
      y:          Math.round(canvas.h / 2 - 20),
      rotation:   0,
      opacity:    1,
      text:       "Your text",
      fontSize:   36,
      fontWeight: 700,
      fontFamily: "system",           // slug from FONT_CATALOGUE (see fonts.ts)
      color:      "#FFFFFF",
      align:      "center",
      width:      240,
      variant:    "body",
      effects:    {
        // Default shadow — makes fresh text readable on any photo.
        shadow: { color: "rgba(0,0,0,0.6)", blur: 4, offsetX: 0, offsetY: 2 }
      }
    };
    addLayer(layer);
    setSelectedTool("text");
  }, [addLayer, canvas.h, canvas.w, activeS.layers.length]);

  const addOverlay = useCallback((o: Overlay) => {
    // Sensible initial size — badge sits at ~28% of canvas width and
    // preserves the source aspect ratio (wide/portrait/square).
    const ratio  = typeof o.aspectRatio === "number" && o.aspectRatio > 0 ? o.aspectRatio : 1;
    const width  = Math.round(canvas.w * 0.28);
    const height = Math.round(width / ratio);
    const layer: OverlayLayer = {
      id:        `overlay-${Date.now()}`,
      kind:      "overlay",
      overlayId: o.id,
      url:       o.url,
      z:         activeS.layers.length,
      x:         Math.round((canvas.w - width)  / 2),
      y:         Math.round((canvas.h - height) / 2),
      rotation:  0,
      opacity:   1,
      width,
      height
    };
    addLayer(layer);
  }, [addLayer, canvas.h, canvas.w, activeS.layers.length]);

  const addBanner = useCallback((b: Banner) => {
    const isTall = b.shape === "tall-strip";
    const layer: BannerLayer = {
      id:       `banner-${Date.now()}`,
      kind:     "banner",
      bannerId: b.id,
      url:      b.svg,
      z:        activeS.layers.length,
      x:        Math.round(canvas.w / 2 - (isTall ? 40 : 100)),
      y:        Math.round(canvas.h / 2 - (isTall ? 120 : 100)),
      rotation: 0,
      opacity:  1,
      width:    isTall ? 80  : 200,
      height:   isTall ? 240 : 200
    };
    addLayer(layer);
  }, [addLayer, canvas.h, canvas.w, activeS.layers.length]);

  const addShape = useCallback((shape: ShapeLayer["shape"], preset?: { fill: string | null; stroke: string | null; strokeWidth: number }) => {
    const style = preset ?? { fill: BRAND_YELLOW, stroke: null, strokeWidth: 0 };
    const layer: ShapeLayer = {
      id:          `shape-${Date.now()}`,
      kind:        "shape",
      shape,
      z:           activeS.layers.length,
      x:           Math.round(canvas.w / 2 - 60),
      y:           Math.round(canvas.h / 2 - 60),
      rotation:    0,
      opacity:     1,
      width:       120,
      height:      120,
      fill:        style.fill,
      stroke:      style.stroke,
      strokeWidth: style.strokeWidth
    };
    addLayer(layer);
    setSelectedTool("shapes");
  }, [addLayer, canvas.h, canvas.w, activeS.layers.length]);

  // -------------------------------------------------------------- save / export
  const saveDraft = useCallback(async (isAutosave: boolean) => {
    setBusy("save");
    setStatus(null);
    try {
      const res = await fetch("/api/site/editor/draft", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id:              draftId,
          frame_slug:      frame.slug,
          state,
          source_image_id: activeS.base.sourceImageId,
          is_autosave:     isAutosave
        })
      });
      const data = await res.json().catch(() => ({} as { ok?: boolean; id?: string; error?: string }));
      if (!res.ok || data.ok !== true) {
        setStatus(data.error === "not_authenticated"
          ? "Sign in to save drafts."
          : "Save failed — try again.");
      } else {
        if (data.id) setDraftId(data.id);
        setStatus(isAutosave ? null : "Saved.");
      }
    } finally {
      setBusy("none");
    }
  }, [draftId, frame.slug, state]);

  // Autosave heartbeat — throttled to every 6s to avoid hammering
  // the DB on rapid edits. Skipped on empty canvases AND while an
  // admin is authoring a template (template drafts have their own
  // Save-as-template button and shouldn't overwrite the merchant's
  // personal draft row).
  useEffect(() => {
    if (adminAuthoring) return;
    if (!activeS.base.url && activeS.layers.length === 0) return;
    const t = window.setTimeout(() => { void saveDraft(true); }, 6000);
    return () => window.clearTimeout(t);
  }, [state, saveDraft, adminAuthoring, activeS.base.url, activeS.layers.length]);

  // Fetch washer balance on mount + after every AI spend so the
  // panel's chip is always accurate. Anonymous callers (no merchant
  // slug) get balance=null and the AI panel shows a Sign-in nudge.
  useEffect(() => {
    if (!merchantSlug) { setWasherBalance(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const res  = await fetch("/api/washers/balance");
        const data = await res.json().catch(() => ({ balance: 0 } as { balance?: number }));
        if (!cancelled) setWasherBalance(typeof data.balance === "number" ? data.balance : 0);
      } catch {
        if (!cancelled) setWasherBalance(0);
      }
    })();
    return () => { cancelled = true; };
  }, [merchantSlug]);

  const runAiCaption = useCallback(async () => {
    if (busy !== "none") return;
    // Blocked-state hint — merchant hit AI with zero washers. We
    // never call the API; instead we write the top-up nudge INTO
    // the caption field so the message is unmissable.
    if (washerBalance !== null && washerBalance <= 0) {
      setCaption("Select the button above container on right to add washers to continue use AI.");
      setStatus("Out of washers — top up to use AI.");
      return;
    }
    setBusy("ai");
    setStatus(null);
    try {
      const network = frame.slug.startsWith("ig-") ? "instagram"
                    : frame.slug.startsWith("fb-") ? "facebook"
                    : frame.slug.startsWith("tt-") ? "tiktok"
                    : "snapchat";
      // Prompt = subject (topic) + goal (the current caption / prompt
      // text the merchant typed). Both fields land in the "subject"
      // parameter joined together so the API keeps its single-input
      // contract while the UI splits them for clarity.
      const promptSubject = [aiSubject.trim(), caption.trim()].filter(Boolean).join(" — ").slice(0, 400);
      const res = await fetch("/api/site/editor/ai-caption", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject:    promptSubject,
          network,
          frame_slug: frame.slug,
          image_id:   activeS.base.sourceImageId
        })
      });
      const data = await res.json().catch(() => ({} as { ok?: boolean; caption?: string; error?: string; balance?: number; message?: string }));
      if (!res.ok || !data.ok || !data.caption) {
        if (data.error === "insufficient-balance") {
          setWasherBalance(0);
          setCaption("Select the button above container on right to add washers to continue use AI.");
          setStatus(`Not enough washers (${data.balance ?? 0} left) — top up to use AI.`);
        } else {
          setStatus(data.message ?? data.error ?? "AI failed — try again.");
        }
        return;
      }
      setCaption(data.caption);
      if (typeof data.balance === "number") setWasherBalance(data.balance);
      setStatus("AI caption ready (1 washer). Edit it before you post.");
    } finally {
      setBusy("none");
    }
  }, [busy, frame.slug, activeS.base.sourceImageId, aiSubject, caption, washerBalance]);

  const doExport = useCallback(async () => {
    if (!stageRef.current) return;
    setBusy("export");
    setStatus(null);
    try {
      // Video branch — offload composition to the ffmpeg worker.
      // The client posts the editor state; the server queues a job
      // and we poll status until the composed MP4 is ready.
      if (activeS.base.kind === "video" && activeS.base.url && activeS.base.videoStorage) {
        setStatus("Queuing video composition…");
        const createRes = await fetch("/api/site/editor/video/compose", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            input_url:        activeS.base.url,
            input_storage:    activeS.base.videoStorage,
            input_duration_s: activeS.base.videoDurationS ?? 0,
            input_width:      activeS.base.videoWidth,
            input_height:     activeS.base.videoHeight,
            input_bytes:      activeS.base.videoBytes,
            frame_slug:       frame.slug,
            // Video compose targets ONE slide — send a legacy-shaped
            // snapshot of the active slide so the ffmpeg worker keeps
            // reading base/mode/layers at the top level without a
            // carousel-aware rewrite.
            overlays:         {
              version:       1,
              frameSlug:     frame.slug,
              base:          activeS.base,
              secondaryBase: activeS.secondaryBase,
              mode:          activeS.mode,
              layers:        activeS.layers,
              // Send the ACTUAL preview canvas size so the worker
              // scales overlay coords accurately for mobile clients
              // (was hard-coded to 720 short-side before).
              previewWidth:  canvas.w,
              previewHeight: canvas.h
            }
          })
        });
        const createData = await createRes.json().catch(() => ({} as { ok?: boolean; job_id?: string; error?: string }));
        if (!createRes.ok || createData.ok !== true || !createData.job_id) {
          setStatus(createData.error ?? "Compose failed.");
          return;
        }
        const jobId = createData.job_id;
        setStatus("Composing video (may take up to a minute)…");
        // Poll every 3s for up to 3 minutes.
        const start = Date.now();
        while (Date.now() - start < 180_000) {
          await new Promise((r) => setTimeout(r, 3000));
          const st = await fetch(`/api/site/editor/video/${encodeURIComponent(jobId)}`);
          const j  = await st.json().catch(() => ({} as { status?: string; output_url?: string; error?: string }));
          if (j.status === "done" && j.output_url) {
            const a = document.createElement("a");
            a.href = j.output_url;
            a.download = `the-site-${frame.slug}.mp4`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setStatus(paid ? "Video ready (clean)." : "Video ready (watermarked — upgrade to remove).");
            return;
          }
          if (j.status === "failed") {
            setStatus(`Video compose failed: ${j.error ?? "unknown"}`);
            return;
          }
        }
        setStatus("Video compose timed out — check back in a minute.");
        return;
      }

      // Image branch — flatten client canvas → server watermark.
      // Upsample to the frame's export size so the download is not
      // limited by the on-screen 720px preview.
      const pixelRatio = Math.max(1, frame.pixelW / canvas.w);
      const totalSlides = state.slides.length;
      const originalActive = state.activeSlideIndex;

      // Multi-slide (carousel) export — iterate each slide, switch
      // active, wait for the stage to repaint (rAF x2 covers the
      // React commit + Konva draw), flatten, POST, download. Single
      // slide keeps the original one-shot flow.
      const captureCurrent = async (index: number): Promise<void> => {
        const dataUrl = stageRef.current!.toDataURL({ pixelRatio, mimeType: "image/png" });
        const suffix  = totalSlides > 1 ? `-slide-${index + 1}` : "";
        const res = await fetch("/api/site/editor/export", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            data_url: dataUrl,
            filename: `the-site-${frame.slug}${suffix}`
          })
        });
        if (!res.ok) throw new Error(`Export failed (${res.status})`);
        const blob = await res.blob();
        const objUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = objUrl;
        a.download = `the-site-${frame.slug}${suffix}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(objUrl);
      };

      const waitTwoFrames = () =>
        new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

      // Hide the safe-zone dim overlay before we flatten so the
      // exported PNG doesn't carry the chrome guide. Restored in
      // the outer finally block below.
      setSuppressSafeZone(true);
      await waitTwoFrames();

      // Wait until the base + secondary + every layer image of the
      // TARGET slide has actually loaded (refs mirror the live image
      // cache). Prevents the export loop from snapshotting a stale
      // canvas that still shows the previous slide's imagery.
      const waitForSlideReady = async (slide: CarouselSlide, timeoutMs = 5000): Promise<void> => {
        const baseUrl        = slide.base.url ?? null;
        const secondaryUrl   = slide.secondaryBase?.url ?? null;
        const expectedLayers = slide.layers.filter((l) => "url" in l && (l as { url: string }).url);
        const start = performance.now();
        while (performance.now() - start < timeoutMs) {
          const baseOk      = !baseUrl      || baseImgLoadedUrlRef.current      === baseUrl;
          const secondaryOk = !secondaryUrl || secondaryImgLoadedUrlRef.current === secondaryUrl;
          const layersOk    = expectedLayers.every((l) => !!layerImgsRef.current[l.id]);
          if (baseOk && secondaryOk && layersOk) return;
          await new Promise<void>((r) => requestAnimationFrame(() => r()));
        }
        // Fall through on timeout — better to emit a possibly-partial
        // slide than to block the whole export.
      };

      try {
        if (totalSlides === 1) {
          await waitForSlideReady(state.slides[originalActive]);
          await waitTwoFrames();
          await captureCurrent(originalActive);
        } else {
          setStatus(`Exporting ${totalSlides} slides…`);
          for (let i = 0; i < totalSlides; i++) {
            setState((prev) => ({ ...prev, activeSlideIndex: i }));
            await waitForSlideReady(state.slides[i]);
            await waitTwoFrames();
            await captureCurrent(i);
          }
          // Restore the slide the merchant was editing before export.
          setState((prev) => ({ ...prev, activeSlideIndex: originalActive }));
        }
        setStatus(paid
          ? (totalSlides > 1 ? `${totalSlides} slides exported (clean).` : "Exported (clean).")
          : (totalSlides > 1 ? `${totalSlides} slides exported (watermarked — upgrade to remove).` : "Exported (watermarked — upgrade to remove)."));
      } catch (err) {
        setStatus(err instanceof Error ? err.message : "Export failed.");
        setState((prev) => ({ ...prev, activeSlideIndex: originalActive }));
      }
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setBusy("none");
      // Restore the safe-zone guide now that flatten is done.
      setSuppressSafeZone(false);
    }
  }, [canvas.w, frame.pixelW, frame.slug, paid, state]);

  const flattenDataUrl = useCallback((): string | null => {
    if (!stageRef.current) return null;
    const pixelRatio = Math.max(1, frame.pixelW / canvas.w);
    return stageRef.current.toDataURL({ pixelRatio, mimeType: "image/png" });
  }, [canvas.w, frame.pixelW]);

  const autoPost = useCallback(async (network: SocialNetworkSlug) => {
    if (busy !== "none") return;
    setBusy("share");
    setStatus(null);
    try {
      // Step 1: make sure we know the trade's saved links. Fetch once
      // per session, then reuse from state.
      let links = socialLinks;
      if (!links) {
        const res  = await fetch("/api/site/editor/social/links");
        const data = await res.json().catch(() => ({} as { ok?: boolean; links?: SocialLinks; error?: string }));
        if (res.status === 401 || data.error === "not_authenticated") {
          setStatus("Sign in to save your social links.");
          return;
        }
        if (res.ok && data.ok && data.links) {
          links = data.links;
          setSocialLinks(links);
        }
      }

      // Step 2: if the requested network hasn't been linked yet,
      // open the SocialLinksDrawer focused on that field so the
      // trade adds it in one place. The drawer's onSaved callback
      // resumes the flow on the next click.
      const targetUrl = links?.[network] ?? "";
      if (!targetUrl.trim()) {
        setShareMenuOpen(false);
        setSocialDrawer({
          focus: network,
          intro: `Add your ${network[0].toUpperCase() + network.slice(1)} URL so we can open it ready to post.`
        });
        setStatus(null);
        return;
      }

      // Step 3: flatten canvas per slide → download each PNG so the
      // merchant has every slide in their downloads folder ready to
      // drop into the network's carousel picker. Uses the same
      // active-slide switching + slide-ready waiter as the main
      // export path so multi-slide compositions come out consistent.
      const totalSlides    = state.slides.length;
      const originalActive = state.activeSlideIndex;
      const waitTwoFrames  = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

      // Hide the safe-zone dim so it doesn't bake into the auto-post
      // flatten. Restored in the finally block.
      setSuppressSafeZone(true);
      await waitTwoFrames();
      const waitReady = async (slide: CarouselSlide, timeoutMs = 5000): Promise<void> => {
        const baseUrl        = slide.base.url ?? null;
        const secondaryUrl   = slide.secondaryBase?.url ?? null;
        const expectedLayers = slide.layers.filter((l) => "url" in l && (l as { url: string }).url);
        const start = performance.now();
        while (performance.now() - start < timeoutMs) {
          const baseOk      = !baseUrl      || baseImgLoadedUrlRef.current      === baseUrl;
          const secondaryOk = !secondaryUrl || secondaryImgLoadedUrlRef.current === secondaryUrl;
          const layersOk    = expectedLayers.every((l) => !!layerImgsRef.current[l.id]);
          if (baseOk && secondaryOk && layersOk) return;
          await new Promise<void>((r) => requestAnimationFrame(() => r()));
        }
      };
      const captureSlide = async (index: number): Promise<void> => {
        const dataUrl = flattenDataUrl();
        if (!dataUrl) throw new Error("Canvas not ready.");
        const suffix = totalSlides > 1 ? `-slide-${index + 1}` : "";
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = `the-site-${frame.slug}${suffix}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      };
      if (totalSlides === 1) {
        await waitReady(state.slides[originalActive]);
        await waitTwoFrames();
        await captureSlide(originalActive);
      } else {
        setStatus(`Preparing ${totalSlides} slides for ${network}…`);
        for (let i = 0; i < totalSlides; i++) {
          setState((prev) => ({ ...prev, activeSlideIndex: i }));
          await waitReady(state.slides[i]);
          await waitTwoFrames();
          await captureSlide(i);
        }
        setState((prev) => ({ ...prev, activeSlideIndex: originalActive }));
      }

      // Step 4: copy caption to clipboard so the trade can paste it
      // straight into their new post.
      if (caption && navigator.clipboard) {
        try { await navigator.clipboard.writeText(caption); } catch { /* silent */ }
      }

      // Step 5: open the trade's profile URL in a new tab. On mobile
      // this deep-links into the app; on desktop it opens the web
      // profile. Either way the trade lands ready to compose a post
      // with the image already saved + caption on clipboard.
      const openUrl = /^https?:/i.test(targetUrl)
        ? targetUrl
        : (network === "instagram" ? `https://instagram.com/${targetUrl.replace(/^@/, "")}`
        : network === "facebook"  ? `https://facebook.com/${targetUrl.replace(/^@/, "")}`
        : network === "tiktok"    ? `https://tiktok.com/@${targetUrl.replace(/^@/, "")}`
        :                            `https://snapchat.com/add/${targetUrl.replace(/^@/, "")}`);
      window.open(openUrl, "_blank", "noopener,noreferrer");
      setShareMenuOpen(false);
      const slidesLabel = state.slides.length > 1 ? `${state.slides.length} slides` : "Image";
      setStatus(`${slidesLabel} downloaded${caption ? " · caption copied" : ""} · opened ${network} ready to post`);
    } finally {
      setBusy("none");
      setSuppressSafeZone(false);
    }
  }, [busy, caption, flattenDataUrl, frame.slug, socialLinks, state]);

  const shareToCanteen = useCallback(async () => {
    if (busy !== "none") return;
    setBusy("share");
    try {
      // Video branch — need to compose the MP4 first via the ffmpeg
      // worker, then share the resulting public URL to the canteen.
      // Whole flow can take 30–90s, so we surface progress hints.
      if (activeS.base.kind === "video" && activeS.base.url && activeS.base.videoStorage) {
        setStatus("Composing video for your Canteen (may take up to a minute)…");
        const createRes = await fetch("/api/site/editor/video/compose", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            input_url:        activeS.base.url,
            input_storage:    activeS.base.videoStorage,
            input_duration_s: activeS.base.videoDurationS ?? 0,
            input_width:      activeS.base.videoWidth,
            input_height:     activeS.base.videoHeight,
            input_bytes:      activeS.base.videoBytes,
            frame_slug:       frame.slug,
            // Video compose targets ONE slide — send a legacy-shaped
            // snapshot of the active slide so the ffmpeg worker keeps
            // reading base/mode/layers at the top level without a
            // carousel-aware rewrite.
            overlays:         {
              version:       1,
              frameSlug:     frame.slug,
              base:          activeS.base,
              secondaryBase: activeS.secondaryBase,
              mode:          activeS.mode,
              layers:        activeS.layers,
              // Send the ACTUAL preview canvas size so the worker
              // scales overlay coords accurately for mobile clients
              // (was hard-coded to 720 short-side before).
              previewWidth:  canvas.w,
              previewHeight: canvas.h
            }
          })
        });
        const createData = await createRes.json().catch(() => ({} as { ok?: boolean; job_id?: string; error?: string }));
        if (!createRes.ok || createData.ok !== true || !createData.job_id) {
          setStatus(createData.error ?? "Compose failed.");
          return;
        }
        const jobId = createData.job_id;
        // Poll for completion.
        const start = Date.now();
        let composedUrl: string | null = null;
        while (Date.now() - start < 180_000) {
          await new Promise((r) => setTimeout(r, 3000));
          const st = await fetch(`/api/site/editor/video/${encodeURIComponent(jobId)}`);
          const j  = await st.json().catch(() => ({} as { status?: string; output_url?: string; error?: string }));
          if (j.status === "done" && j.output_url) { composedUrl = j.output_url; break; }
          if (j.status === "failed") {
            setStatus(`Compose failed: ${j.error ?? "unknown"}`);
            return;
          }
        }
        if (!composedUrl) {
          setStatus("Compose timed out — try Share again in a moment.");
          return;
        }
        // Post the composed MP4 URL to the canteen. Paid gate is
        // enforced server-side.
        const shareRes = await fetch("/api/site/share", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            video_url: composedUrl,
            caption,
            kind:      "showcase"
          })
        });
        const shareData = await shareRes.json().catch(() => ({} as { ok?: boolean; canteen_slug?: string; error?: string; detail?: string }));
        if (!shareRes.ok || shareData.ok !== true) {
          if (shareData.error === "video_requires_paid") {
            setStatus(shareData.detail ?? "Video posts are a paid-tier feature.");
          } else {
            setStatus(shareData.error ?? "Share failed.");
          }
          return;
        }
        setStatus(`Posted video to your Canteen (${shareData.canteen_slug ?? ""}).`);
        return;
      }

      // Image branch — carousel-aware. Every slide with a
      // sourceImageId contributes one photo to the canteen post;
      // upload-only slides (data-URL bases) are skipped because we
      // can't prove the merchant is entitled to redistribute an
      // uncredited upload through the canteen surface.
      const carouselIds = state.slides
        .map((s) => s.base.sourceImageId)
        .filter((v): v is string => typeof v === "string" && v.length > 0);
      if (carouselIds.length === 0) {
        setStatus("Pick a Site image first (Share-to-Canteen requires a licensed image source).");
        return;
      }
      if (carouselIds.length < state.slides.length) {
        // Warn the merchant that some slides won't make it — better
        // than silently dropping them. They can still confirm the
        // Site-image-only slides went through.
        setStatus(`${state.slides.length - carouselIds.length} upload-only slide(s) skipped — posting ${carouselIds.length} Site image(s)…`);
      }
      const res = await fetch("/api/site/share", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Send the array even for a single slide so the server takes
          // the same code path either way.
          image_ids: carouselIds,
          caption,
          kind:      "showcase"
        })
      });
      const data = await res.json().catch(() => ({} as { ok?: boolean; canteen_slug?: string; error?: string }));
      if (!res.ok || data.ok !== true) {
        setStatus(data.error ?? "Share failed.");
        return;
      }
      setStatus(carouselIds.length > 1
        ? `Posted ${carouselIds.length}-slide carousel to your Canteen (${data.canteen_slug ?? ""}).`
        : `Posted to your Canteen (${data.canteen_slug ?? ""}).`);
    } finally {
      setBusy("none");
    }
  }, [busy, caption, frame.slug, state]);

  // -------------------------------------------------------------- render
  return (
    <>
    <div
      className="mx-auto flex max-w-6xl flex-col gap-3 p-3 sm:p-4"
      style={{
        // Reserve space at the bottom on mobile for the fixed tool rail +
        // action bar so the scroll area doesn't hide behind them.
        // Uses env(safe-area-inset-bottom) so iOS home-indicator space
        // stays respected.
        // Just the fixed action bar remains at the screen bottom; the
        // tool buttons now sit inline under the canvas. So we only
        // need ~56px + safe-area of bottom padding.
        paddingBottom: isMobile ? "calc(72px + env(safe-area-inset-bottom, 0px))" : undefined
      }}
    >
      {/* Frame picker — media choice now lives inside the Change
          bottom-sheet, not here. */}
      <FramePicker current={frame} onChange={changeFrame}/>

      <div className={isMobile
        ? "flex flex-col gap-3"
        : "grid grid-cols-[64px_1fr] gap-3 lg:grid-cols-[64px_1fr_280px]"}>
        {/* Two hidden file inputs — one image-only, one video-only —
            so the native OS picker filters correctly for the media
            type the user has chosen. Both call the same
            handleUploadBase which detects the type from the file. */}
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          aria-hidden
          tabIndex={-1}
          style={{ position: "absolute", opacity: 0, pointerEvents: "none", width: 1, height: 1, overflow: "hidden" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleUploadBase(f);
            e.target.value = "";
          }}
        />
        <input
          ref={videoInputRef}
          type="file"
          accept={VIDEO_ACCEPT}
          aria-hidden
          tabIndex={-1}
          style={{ position: "absolute", opacity: 0, pointerEvents: "none", width: 1, height: 1, overflow: "hidden" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleUploadBase(f);
            e.target.value = "";
          }}
        />

        {/* Desktop tool rail — vertical column on the left. On mobile
            the fixed bottom rail below the shell replaces this. */}
        {!isMobile && (
          <Toolrail
            current={selectedTool}
            onSelect={(t) => {
              setSelectedTool(t);
              if      (t === "overlays")  setLibraryOpen("overlays");
              else if (t === "banners")   setLibraryOpen("banners");
              else if (t === "library")   setLibraryOpen("images");
              else if (t === "shapes")    setLibraryOpen("shapes");
              else if (t === "templates") setLibraryOpen("templates");
              else                        setLibraryOpen(null);
            }}
            onAddText={addText}
            onOpenFilePicker={openFilePicker}
          />
        )}

        {/* Canvas */}
        <div ref={canvasContainerRef} className="flex min-w-0 flex-col items-center gap-2">
          {/* Canvas row — vertical scale bar on the left + canvas
              (with width slider below it) on the right. On mobile
              we skip the vertical bar to keep the canvas full width. */}
          <div className="flex items-start gap-2">
            {activeS.mode === "single" && activeS.base.url && baseImg && !isMobile && (
              <div className="flex flex-col items-center gap-1 rounded-md bg-white/90 px-1 py-2 shadow-sm" style={{ height: canvas.h }}>
                <span className="text-[9px] font-black uppercase tracking-wider text-neutral-500">H</span>
                <input
                  type="range"
                  min="0.1"
                  max="5"
                  step="0.01"
                  value={activeS.base.scaleY ?? activeS.base.scale}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    patchSlide((s) => ({ ...s, base: { ...s.base, scaleY: v } }));
                  }}
                  onDoubleClick={() => patchSlide((s) => {
                    const next = { ...s.base };
                    delete next.scaleY;
                    return { ...s, base: next };
                  })}
                  className="flex-1 cursor-pointer accent-yellow-500"
                  style={{
                    writingMode: "vertical-lr" as unknown as "horizontal-tb",
                    direction: "rtl",
                    width: 16
                  }}
                  title="Drag to resize height · Double-click to reset"
                />
                <span className="text-[10px] font-black tabular-nums text-neutral-700">
                  {Math.round(((activeS.base.scaleY ?? activeS.base.scale) * 100))}%
                </span>
              </div>
            )}
            <div className="flex flex-col gap-2">
          <div
            className="relative rounded-xl shadow-lg"
            style={{ width: canvas.w, height: canvas.h, backgroundColor: "#111" }}
          >
            <EditorCanvasDynamic
              ref={stageRef as unknown as React.Ref<never>}
              width={canvas.w}
              height={canvas.h}
              paid={paid}
              baseImg={baseImg}
              baseVideo={videoEl}
              videoPlaying={isPlaying}
              videoTime={videoTime}
              base={activeS.base}
              secondaryImg={secondaryImg}
              secondaryBase={activeS.secondaryBase}
              mode={activeS.mode}
              activeSlot={activeSlot}
              layers={activeS.layers}
              selectedLayerId={selectedLayerId}
              layerImgs={layerImgs}
              onBaseDragEnd={(x, y) => patchSlide((s) => ({ ...s, base: { ...s.base, offsetX: x, offsetY: y } }))}
              onSecondaryDragEnd={(x, y) => patchSlide((s) => s.secondaryBase
                ? { ...s, secondaryBase: { ...s.secondaryBase, offsetX: x, offsetY: y } }
                : s
              )}
              onLayerSelect={setSelectedLayerId}
              onLayerDragEnd={(id, x, y) => updateLayer(id, { x, y })}
              onLayerTransformEnd={(id, patch) => updateLayer(id, patch as Partial<EditorLayer>)}
              showSafeZone={!suppressSafeZone}
            />

            {/* Empty-frame background — on-brand construction scene
                shown as a soft backdrop behind the canvas when no base
                image is set. Sits BEHIND the Konva stage in the DOM
                so Konva layers still receive clicks. pointer-events
                are off so the image never intercepts drags. */}
            {activeS.mode === "single" && !activeS.base.url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={EMPTY_FRAME_BG_URL}
                alt=""
                aria-hidden
                className="pointer-events-none absolute inset-0 h-full w-full rounded-xl object-cover opacity-90"
              />
            )}
            {/* Before/After empty backgrounds — clipped to left/right
                half so each empty slot shows the same construction bg
                as single mode. Object-cover ensures the image fills
                the half without stretching; overflow-hidden clips the
                bleed. */}
            {activeS.mode === "beforeAfter" && !activeS.base.url && (
              <div className="pointer-events-none absolute inset-y-0 left-0 w-1/2 overflow-hidden rounded-l-xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={EMPTY_FRAME_BG_URL}
                  alt=""
                  aria-hidden
                  className="h-full w-full object-cover opacity-90"
                />
              </div>
            )}
            {activeS.mode === "beforeAfter" && !activeS.secondaryBase?.url && (
              <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 overflow-hidden rounded-r-xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={EMPTY_FRAME_BG_URL}
                  alt=""
                  aria-hidden
                  className="h-full w-full object-cover opacity-90"
                />
              </div>
            )}

            {/* Empty-state upload prompt — a compact tinted-glass card
                centered over the construction-worker background. Only
                the card is clickable (the rest of the canvas stays
                click-through) so once a badge is placed nothing steals
                its interaction. */}
            {activeS.mode === "single" && !activeS.base.url && activeS.layers.length === 0 && (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center pt-10">
                <button
                  type="button"
                  onClick={openFilePicker}
                  className="pointer-events-auto flex flex-col items-center justify-center gap-2 rounded-2xl px-6 py-5 text-center text-white transition hover:brightness-110"
                  style={{
                    backgroundColor: "rgba(10,10,10,0.55)",
                    backdropFilter:  "blur(10px)",
                    WebkitBackdropFilter: "blur(10px)",
                    border:          "1px solid rgba(255,179,0,0.35)",
                    boxShadow:       "0 8px 24px rgba(0,0,0,0.35)"
                  }}
                  aria-label="Upload an image"
                >
                  <span
                    className="flex h-12 w-12 items-center justify-center rounded-full"
                    style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}
                  >
                    <UploadIcon size={22} strokeWidth={2.4}/>
                  </span>
                  <p className="text-[12px] font-black uppercase tracking-[0.14em]">Tap to upload image</p>
                  <p className="text-[10px] font-black uppercase tracking-wider text-neutral-300">or pick one from The Site</p>
                </button>
              </div>
            )}
            {activeS.mode === "beforeAfter" && !activeS.base.url && activeS.layers.length === 0 && (
              <div className="pointer-events-none absolute inset-y-0 left-0 z-10 flex w-1/2 items-center justify-center pt-10">
                <button
                  type="button"
                  onClick={() => { setActiveSlot("base"); openFilePicker(); }}
                  className="pointer-events-auto flex flex-col items-center justify-center gap-2 rounded-2xl px-5 py-4 text-center text-white transition hover:brightness-110"
                  style={{
                    backgroundColor: "rgba(10,10,10,0.55)",
                    backdropFilter:  "blur(10px)",
                    WebkitBackdropFilter: "blur(10px)",
                    border:          "1px solid rgba(255,179,0,0.35)",
                    boxShadow:       "0 6px 18px rgba(0,0,0,0.35)"
                  }}
                  aria-label="Upload BEFORE image"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}>
                    <UploadIcon size={18} strokeWidth={2.4}/>
                  </span>
                  <p className="text-[11px] font-black uppercase tracking-[0.12em]">Tap for BEFORE</p>
                </button>
              </div>
            )}
            {activeS.mode === "beforeAfter" && !activeS.secondaryBase?.url && activeS.layers.length === 0 && (
              <div className="pointer-events-none absolute inset-y-0 right-0 z-10 flex w-1/2 items-center justify-center pt-10">
                <button
                  type="button"
                  onClick={() => { setActiveSlot("secondary"); openFilePicker(); }}
                  className="pointer-events-auto flex flex-col items-center justify-center gap-2 rounded-2xl px-5 py-4 text-center text-white transition hover:brightness-110"
                  style={{
                    backgroundColor: "rgba(10,10,10,0.55)",
                    backdropFilter:  "blur(10px)",
                    WebkitBackdropFilter: "blur(10px)",
                    border:          "1px solid rgba(255,179,0,0.35)",
                    boxShadow:       "0 6px 18px rgba(0,0,0,0.35)"
                  }}
                  aria-label="Upload AFTER image"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}>
                    <UploadIcon size={18} strokeWidth={2.4}/>
                  </span>
                  <p className="text-[11px] font-black uppercase tracking-[0.12em]">Tap for AFTER</p>
                </button>
              </div>
            )}

            {/* "Change" button — top-left of the canvas frame. Opens
                the slide-up sheet where the merchant switches the
                composition style + media. z-30 keeps it above the
                empty-state upload card (z-20) on mobile so a tap on
                Change never bubbles into the upload flow. stopProp +
                onPointerDown stops the tap firing on the underlying
                canvas even if pointer events would otherwise fall
                through. */}
            <button
              type="button"
              onPointerDown={(e) => { e.stopPropagation(); }}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setChangeSheetOpen((v) => !v);
              }}
              aria-label="Change style"
              title="Change style"
              className="absolute left-2 top-2 z-30 inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] transition hover:brightness-95"
              style={{
                backgroundColor: BRAND_YELLOW,
                color:           BRAND_BLACK,
                border:          `1.5px solid ${BRAND_BLACK}`,
                boxShadow:       "0 2px 6px rgba(0,0,0,0.35)"
              }}
            >
              <RotateCw size={11} strokeWidth={2.6}/>
              Change
            </button>

            {/* Undo / Redo — top-right of the canvas. Ctrl+Z / Ctrl+Y
                keyboard shortcuts also fire the same actions. Buttons
                dim when their stack is empty. */}
            <div className="absolute right-2 top-2 z-30 flex gap-1">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); undo(); }}
                onPointerDown={(e) => e.stopPropagation()}
                disabled={!canUndo}
                aria-label="Undo (Ctrl+Z)"
                title="Undo (Ctrl+Z)"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md transition disabled:opacity-40"
                style={{
                  backgroundColor: BRAND_YELLOW,
                  color:           BRAND_BLACK,
                  border:          `1.5px solid ${BRAND_BLACK}`,
                  boxShadow:       "0 2px 6px rgba(0,0,0,0.35)"
                }}
              >
                <Undo2 size={14} strokeWidth={2.6}/>
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); redo(); }}
                onPointerDown={(e) => e.stopPropagation()}
                disabled={!canRedo}
                aria-label="Redo (Ctrl+Y)"
                title="Redo (Ctrl+Y)"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md transition disabled:opacity-40"
                style={{
                  backgroundColor: BRAND_YELLOW,
                  color:           BRAND_BLACK,
                  border:          `1.5px solid ${BRAND_BLACK}`,
                  boxShadow:       "0 2px 6px rgba(0,0,0,0.35)"
                }}
              >
                <Redo2 size={14} strokeWidth={2.6}/>
              </button>
            </div>

            {/* Best-size chip — pinned bottom-right of the frame
                and live-updates as the user switches Feed / Story /
                Reel / Portrait / Canteen chips. Hides the moment an
                image is loaded (Single mode: base.url; Before/After
                mode: either side filled) so it never obscures the
                composition the trade is working on. */}
            {(activeS.mode === "single"
                ? !activeS.base.url
                : (!activeS.base.url && !activeS.secondaryBase?.url)) && (
              <div
                className="pointer-events-none absolute right-2 bottom-2 z-10 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-black uppercase tracking-[0.10em]"
                style={{
                  backgroundColor: "rgba(10,10,10,0.65)",
                  color:           BRAND_YELLOW,
                  backdropFilter:  "blur(6px)",
                  WebkitBackdropFilter: "blur(6px)",
                  boxShadow:       "0 2px 6px rgba(0,0,0,0.3)"
                }}
              >
                {frame.label} · {frame.pixelW} × {frame.pixelH}
              </div>
            )}
          </div>
          {/* Horizontal scale bar — width control. Sits BELOW the
              canvas, aligned to its width. Adjusts base.scaleX so
              the merchant can stretch / shrink the base image
              horizontally. Only rendered when a base image is set;
              hidden for empty slots + before/after mode. */}
          {activeS.mode === "single" && activeS.base.url && baseImg && (
            <div className="flex items-center gap-2 rounded-md bg-white/90 px-2 py-1 shadow-sm" style={{ width: canvas.w }}>
              <span className="w-8 text-[9px] font-black uppercase tracking-wider text-neutral-500">W</span>
              <input
                type="range"
                min="0.1"
                max="5"
                step="0.01"
                value={activeS.base.scaleX ?? activeS.base.scale}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  patchSlide((s) => ({ ...s, base: { ...s.base, scaleX: v } }));
                }}
                onDoubleClick={() => patchSlide((s) => {
                  const next = { ...s.base };
                  delete next.scaleX;
                  return { ...s, base: next };
                })}
                className="h-1 flex-1 cursor-pointer appearance-none rounded-full accent-yellow-500"
                style={{ backgroundColor: "rgba(139,69,19,0.15)" }}
                title="Drag to resize width · Double-click to reset"
              />
              <span className="w-10 text-right text-[10px] font-black tabular-nums text-neutral-700">
                {Math.round(((activeS.base.scaleX ?? activeS.base.scale) * 100))}%
              </span>
            </div>
          )}
          </div> {/* /flex flex-col gap-2 — canvas + width slider */}
          </div> {/* /flex items-start gap-2 — closes vertical-slider + canvas row */}

          {/* Video playback + trim controls — visible only when the
              base is a video. Layout: play/pause button on left, then
              a "time / duration" chip, then the trim scrubber taking
              the full remaining width. */}
          {activeS.base.kind === "video" && videoEl && (
            <VideoControls
              videoTime={videoTime}
              duration={activeS.base.videoDurationS ?? videoEl.duration ?? 0}
              trimFrom={activeS.base.trimFrom ?? 0}
              trimTo={activeS.base.trimTo ?? (activeS.base.videoDurationS ?? videoEl.duration ?? 0)}
              isPlaying={isPlaying}
              onTogglePlay={togglePlay}
              onSeek={seekTo}
              onTrim={(from, to) => patchSlide((s) => ({
                ...s,
                base: { ...s.base, trimFrom: from, trimTo: to }
              }))}
            />
          )}

          {/* Timeline strip — one row per layer with a colored bar
              showing when it's visible. Drag edges to change enter /
              exit times. Only rendered when video is loaded AND there
              are layers to time. */}
          {activeS.base.kind === "video" && videoEl && activeS.layers.length > 0 && (
            <LayerTimeline
              layers={activeS.layers}
              duration={activeS.base.videoDurationS ?? videoEl.duration ?? 0}
              trimFrom={activeS.base.trimFrom ?? 0}
              trimTo={activeS.base.trimTo ?? (activeS.base.videoDurationS ?? videoEl.duration ?? 0)}
              videoTime={videoTime}
              selectedLayerId={selectedLayerId}
              onSelect={setSelectedLayerId}
              onUpdateAnimation={(id, patch) => updateLayer(id, {
                animation: { ...(activeS.layers.find((l) => l.id === id)?.animation ?? { enterAtSec: 0, exitAtSec: activeS.base.videoDurationS ?? 60, fadeInSec: 0, fadeOutSec: 0 }), ...patch }
              })}
            />
          )}

          {/* Carousel slide strip — one numbered chip per slide,
              green when active. Only rendered for frame slugs that
              support carousels (Instagram feed + portrait) so we
              don't confuse Stories / Reels / Canteen users with a
              feature that has no destination in those networks. */}
          {frame.supportsCarousel && (
            <SlideNavigator
              slideCount={state.slides.length}
              activeSlideIndex={state.activeSlideIndex}
              onSelect={selectSlide}
              onAdd={addSlide}
              onRemove={removeSlide}
            />
          )}

          {/* Mobile inline tool rail — 3×2 grid directly under the
              canvas. Upload lives in the Change bottom-sheet now
              (Add Media section), so the tool rail is exactly six
              tools: Library / Text / Overlays / Banners / Shapes / AI. */}
          {isMobile && (
            <div className="grid w-full grid-cols-3 gap-1.5 py-1">
              <MobileToolBtn icon={<Layers size={16}/>}    label="Library"  active={selectedTool === "library"}  onClick={() => { setSelectedTool("library"); setLibraryOpen("images"); }}/>
              <MobileToolBtn icon={<Type size={16}/>}      label="Text"     active={selectedTool === "text"}     onClick={() => { setSelectedTool("text"); addText(); }}/>
              <MobileToolBtn icon={<Layers size={16}/>}    label="Overlays" active={selectedTool === "overlays"} onClick={() => { setSelectedTool("overlays"); setLibraryOpen("overlays"); }}/>
              <MobileToolBtn icon={<Square size={16}/>}    label="Banners"  active={selectedTool === "banners"}  onClick={() => { setSelectedTool("banners"); setLibraryOpen("banners"); }}/>
              <MobileToolBtn icon={<Circle size={16}/>}    label="Shapes"   active={selectedTool === "shapes"}   onClick={() => { setSelectedTool("shapes"); setLibraryOpen("shapes"); }}/>
              <MobileToolBtn icon={<LayoutTemplate size={16}/>}  label="Templates" active={selectedTool === "templates"} onClick={() => { setSelectedTool("templates"); setLibraryOpen("templates"); }}/>
            </div>
          )}

          {/* Status line */}
          <div className="min-h-4 text-[11px] text-neutral-600">
            {status}
          </div>
        </div>

        {/* Desktop-only right pane — properties for selected layer.
            On mobile a bottom-sheet takes over (rendered below). */}
        {!isMobile && (
          <PropertiesPanel
            layer={selectedLayer}
            onChange={(patch) => selectedLayer && updateLayer(selectedLayer.id, patch)}
            onDelete={() => selectedLayer && removeLayer(selectedLayer.id)}
            onDuplicate={() => selectedLayer && duplicateLayer(selectedLayer.id)}
            onBringForward={() => selectedLayer && bumpZ(selectedLayer.id, +1)}
            onSendBack={() => selectedLayer && bumpZ(selectedLayer.id, -1)}
            adminAuthoring={adminAuthoring}
          />
        )}
      </div>

      {/* Admin template authoring panel — only visible when
          adminAuthoring is true. Sits ABOVE the AI panel so it's
          the first thing an admin sees after opening the editor
          via /admin/site-editor/templates. */}
      {adminAuthoring && (
        <AdminTemplatePanel
          initialSlug={adminTemplateSeed?.slug ?? ""}
          initialLabel={adminTemplateSeed?.label ?? ""}
          initialCategory={adminTemplateSeed?.category ?? "promo"}
          initialSiblingGroup={adminTemplateSeed?.sibling_group_slug ?? ""}
          frameSlug={frame.slug}
          state={state}
          basePlaceholder={activeS.base.isPlaceholder ?? false}
          baseHasImage={!!activeS.base.url}
          onStatus={setStatus}
          onOpenBackdrops={() => setLibraryOpen("backdrops")}
          onMarkPlaceholder={() => {
            patchSlide((s) => ({ ...s, base: { ...s.base, url: null, sourceImageId: null, isPlaceholder: true } }));
            setStatus("Base marked as empty placeholder — merchants will see 'Tap to add your photo'.");
          }}
          onClearPlaceholder={() => {
            patchSlide((s) => ({ ...s, base: { ...s.base, isPlaceholder: false } }));
            setStatus("Placeholder flag cleared.");
          }}
          captureThumbnail={() => {
            // Flatten the current stage to a compact 800px-wide PNG
            // data URL — the /template-thumbnail endpoint resizes to
            // 400px so the extra headroom keeps the preview crisp on
            // retina displays. Returns null when the stage isn't
            // mounted yet (rare — happens if the admin hits Save
            // before Konva finishes hydrating).
            if (!stageRef.current) return null;
            const targetShort = 800;
            const ratio = Math.max(1, targetShort / canvas.w);
            return stageRef.current.toDataURL({ pixelRatio: ratio, mimeType: "image/png" });
          }}
        />
      )}

      {/* AI panel — replaces the old caption editor. Layout:
             [ Let AI Write Your Description        Washers·chip ]
             Subject                        (short one-line input)
             Goal / caption prompt          (multi-line textarea)
             [   AI · 1 washer   ]          (Generate button)
          Blocked state (balance === 0):
            - Chip becomes "Top up" pill linking to the merchant's
              washer top-up page
            - Tapping the Generate button fills the textarea with
              the top-up nudge string so the message is unmissable. */}
      <div className="overflow-hidden rounded-xl border" style={{ backgroundColor: "white", borderColor: "rgba(139,69,19,0.15)" }}>
        {/* Yellow container-strip header — matches every other drawer.
            Right-side pill = washer balance OR Top-up CTA. */}
        <div className="flex items-center justify-between px-3 py-1.5" style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}>
          <div className="text-[11px] font-black uppercase tracking-[0.16em]">
            Let AI Write Your Description
          </div>
          {washerBalance !== null && washerBalance <= 0 ? (
            <a
              href={merchantSlug ? `/trade-off/edit/${encodeURIComponent(merchantSlug)}/washers` : "/pricing"}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-7 items-center gap-1 rounded-full bg-black px-2.5 text-[10px] font-black uppercase tracking-wider text-yellow-400 hover:brightness-110"
            >
              <Plus size={11} strokeWidth={2.6}/>
              Top up washers
            </a>
          ) : (
            <div className="inline-flex h-7 items-center gap-1 rounded-full bg-black/10 px-2.5 text-[10px] font-black uppercase tracking-wider text-neutral-800">
              <Wallet size={11} strokeWidth={2.4}/>
              {washerBalance === null ? "— washers" : `${washerBalance} washers`}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 p-3">
          {/* Subject input — short one-line label above the textarea
              so the AI has both a topic and a goal to work with. */}
          <label className="text-[10px] font-black uppercase text-neutral-500">
            Subject
            <input
              type="text"
              value={aiSubject}
              onChange={(e) => setAiSubject(e.target.value.slice(0, 120))}
              placeholder="e.g. Concrete driveway in Manchester"
              className="mt-1 w-full rounded-md border bg-white px-2 py-1.5 text-[13px] text-neutral-900 focus:outline-none focus:ring-2"
              style={{ borderColor: "rgba(139,69,19,0.15)" }}
            />
          </label>

          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value.slice(0, 2200))}
            rows={4}
            placeholder="Explain briefly what your main goal of this post is and its subject."
            className="w-full resize-none rounded-lg border bg-white px-3 py-2 text-[13px] text-neutral-900 focus:outline-none focus:ring-2"
            style={{ borderColor: "rgba(139,69,19,0.15)" }}
          />
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-neutral-500">{captionGuideFor(frame.slug)}</span>
            <span className="text-neutral-400">{caption.length} / 2200</span>
          </div>

          <button
            type="button"
            onClick={() => void runAiCaption()}
            disabled={busy !== "none"}
            className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md text-[11px] font-black uppercase tracking-wider disabled:opacity-60"
            style={{ backgroundColor: BRAND_BLACK, color: BRAND_YELLOW }}
          >
            {busy === "ai" ? <Loader2 size={12} className="animate-spin"/> : <Sparkles size={12}/>}
            {washerBalance !== null && washerBalance <= 0 ? "Write with AI · needs washers" : "Write with AI · 1 washer"}
          </button>
        </div>
      </div>

      {/* Overlay + Banner library drawers */}
      {libraryOpen === "overlays" && (
        <OverlayDrawer onClose={() => setLibraryOpen(null)} onPick={addOverlay}/>
      )}
      {libraryOpen === "banners" && (
        <BannerDrawer onClose={() => setLibraryOpen(null)} onPick={addBanner}/>
      )}
      {libraryOpen === "shapes" && (
        <ShapeDrawer
          onClose={() => setLibraryOpen(null)}
          onPick={(kind, preset) => addShape(kind, preset)}
        />
      )}
      {libraryOpen === "backdrops" && (
        <BackdropDrawer
          onClose={() => setLibraryOpen(null)}
          onPick={(b) => {
            // Admin picks a curated backdrop → drops in as the active
            // slide's base. isPlaceholder=false because this IS a
            // real photo the template ships with (a "nice default"
            // merchants can keep). Use the empty-placeholder toggle
            // below the panel to author a photo-required template.
            patchSlide((s) => ({
              ...s,
              base: {
                sourceImageId: null,
                url:           b.url,
                offsetX:       0,
                offsetY:       0,
                scale:         1,
                kind:          "image",
                isPlaceholder: false
              }
            }));
            setStatus(`Backdrop set: ${b.label}`);
          }}
        />
      )}
      {libraryOpen === "templates" && (
        <TemplatesDrawer
          onClose={() => setLibraryOpen(null)}
          currentFrameSlug={frame.slug}
          onPick={(tpl) => {
            // Crown banner path — all text + design burned into the
            // image at authoring time. We drop one editable text
            // layer per configured slot. Prefer tpl.editSlots (array,
            // supports multi-slot banners like WAS/NOW pricing);
            // fall back to tpl.phoneSlot (legacy single-slot) or
            // zero-slot art-only crown banners.
            if (tpl.isCrown && tpl.imageUrl) {
              const displayScale = canvas.w / frame.pixelW;
              type Slot = { id: string; kind?: string; x: number; y: number; width: number; fontSize: number; placeholder?: string; color?: string };
              const slots: Slot[] = Array.isArray(tpl.editSlots) && tpl.editSlots.length > 0
                ? (tpl.editSlots as Slot[])
                : tpl.phoneSlot
                  ? [{ id: "phone", kind: "phone", ...tpl.phoneSlot }]
                  : [];
              const defaultPlaceholderFor = (kind?: string) =>
                  kind === "phone" ? "07XXX XXX XXX"
                : kind === "price" ? "£00"
                :                    "Tap to edit";
              const layers: EditorLayer[] = slots.map((slot, i) => ({
                id:         `t-${slot.id}`,
                kind:       "text",
                z:          i + 1,
                x:          Math.round(slot.x        * displayScale),
                y:          Math.round(slot.y        * displayScale),
                width:      Math.round(slot.width    * displayScale),
                fontSize:   Math.max(12, Math.round(slot.fontSize * displayScale)),
                rotation:   0,
                opacity:    1,
                text:       slot.placeholder ?? defaultPlaceholderFor(slot.kind),
                fontWeight: 700,
                fontFamily: "system-ui",
                color:      slot.color ?? "#FFFFFF",
                align:      "center",
                variant:    "body",
                effects:    { shadow: { color: "rgba(0,0,0,0.55)", blur: 4, offsetX: 0, offsetY: 1 } }
              }) as unknown as EditorLayer);
              const slideId = `slide-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
              setState({
                version:          1,
                frameSlug:        frame.slug,
                activeSlideIndex: 0,
                slides: [{
                  id:     slideId,
                  mode:   "single",
                  base: {
                    sourceImageId: null,
                    url:           tpl.imageUrl,
                    offsetX:       0,
                    offsetY:       0,
                    scale:         1,
                    kind:          "image",
                    isPlaceholder: false
                  },
                  layers
                }]
              });
              // Crown banners bypass the resolver — clear tracked
              // content so changeFrame doesn't try to re-resolve.
              templateContentRef.current = null;
              setActiveSlot("base");
              if (layers.length > 0) setSelectedLayerId(layers[0].id);
              const promptCopy = slots.length === 0
                ? "Finished art. Add your own text via the Text tool if needed."
                : slots.length === 1
                  ? (slots[0].kind === "price" ? "Enter your price." : "Enter your phone number.")
                  : `Enter values for ${slots.length} slots (${slots.map(s => s.id.toUpperCase()).join(", ")}).`;
              setStatus(`Loaded crown banner: ${tpl.label}. ${promptCopy}`);
              return;
            }
            // Prefer the frame-aware resolver path: if the template
            // carries semantic content (all showcase templates do),
            // resolve into the CURRENT frame's safe zones so text
            // lands correctly the moment the merchant taps. Track
            // the content in a ref so changeFrame can re-resolve
            // if the merchant later switches frame.
            if (tpl.content && tpl.imageUrl) {
              // Display scale = current canvas display width / frame
              // authoring width. Konva Stage renders at display size
              // and doesn't scale coordinates, so we pre-scale the
              // authored zones into display pixels here.
              const displayScale = canvas.w / frame.pixelW;
              const resolved: EditorLayer[] = resolveTemplateLayers(tpl.content, frame.slug, displayScale) as unknown as EditorLayer[];
              const slideId = `slide-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
              const nextState: EditorState = {
                version:          1,
                frameSlug:        frame.slug,
                activeSlideIndex: 0,
                slides: [{
                  id:            slideId,
                  mode:          "single",
                  base: {
                    sourceImageId: null,
                    url:           tpl.imageUrl,
                    offsetX:       0,
                    offsetY:       0,
                    scale:         1,
                    kind:          "image",
                    isPlaceholder: false
                  },
                  layers:        resolved
                }]
              };
              setState(nextState);
              templateContentRef.current = tpl.content;
              setActiveSlot("base");
              setStatus(`Loaded template: ${tpl.label}`);
              return;
            }
            // Legacy path — DB templates that don't yet expose
            // semantic content. Adopt the template's full state as
            // authored + switch to its authored frame.
            setState(migrateLegacyState(tpl.state));
            const nextFrame = EDITOR_FRAMES.find((f) => f.slug === tpl.frame_slug);
            if (nextFrame) setFrame(nextFrame);
            templateContentRef.current = null;
            setActiveSlot("base");
            setStatus(`Loaded template: ${tpl.label}`);
          }}
        />
      )}
      {libraryOpen === "images" && (
        <ImageLibraryDrawer
          onClose={() => setLibraryOpen(null)}
          onPick={handleLibraryPick}
          currentFrameSlug={frame.slug}
        />
      )}

      {socialDrawer && (
        <SocialLinksDrawer
          onClose={() => setSocialDrawer(null)}
          onSaved={(links) => {
            setSocialLinks(links);
            setSocialDrawer(null);
            setStatus("Links saved. Tap Auto-post again to share.");
          }}
          focus={socialDrawer.focus}
          intro={socialDrawer.intro}
        />
      )}

      {/* Desktop action bar. Mobile uses the fixed bottom rail
          rendered outside the scroll container. */}
      {!isMobile && (
        <ActionBar
          paid={paid}
          busy={busy}
          onSave={() => void saveDraft(false)}
          onExport={doExport}
          onShareCanteen={shareToCanteen}
          shareMenuOpen={shareMenuOpen}
          onToggleShareMenu={() => setShareMenuOpen((v) => !v)}
          onAutoPost={autoPost}
          onManageLinks={() => { setShareMenuOpen(false); setSocialDrawer({}); }}
        />
      )}
    </div>

    {/* ==================== MOBILE FIXED CHROME ==================== */}
    {isMobile && (
      <>
        {/* Mobile action bar — 4 icon buttons on one row, always visible */}
        <div
          className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t px-2"
          style={{
            height:          `calc(56px + env(safe-area-inset-bottom, 0px))`,
            paddingBottom:   "env(safe-area-inset-bottom, 0px)",
            backgroundColor: BRAND_BLACK
          }}
        >
          <MobileActionBtn icon={<Save size={16}/>}      label="Save"      busy={busy === "save"}   onClick={() => void saveDraft(false)}/>
          <MobileActionBtn icon={<Download size={16}/>}  label="Download"  busy={busy === "export"} onClick={doExport}/>
          <MobileActionBtn icon={<Send size={16}/>}      label="Canteen"   busy={busy === "share"}  onClick={shareToCanteen}/>
          <MobileActionBtn icon={<Send size={16}/>}      label="Auto"      busy={false}             onClick={() => setShareMenuOpen((v) => !v)}/>
        </div>

        {/* Mobile Auto-post picker sheet — pops up above the action
            bar when the Auto icon is tapped. */}
        {shareMenuOpen && (
          <div
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl border-t bg-white p-3 shadow-2xl"
            style={{
              paddingBottom: `calc(72px + env(safe-area-inset-bottom, 0px))`,
              borderColor:   "rgba(139,69,19,0.15)"
            }}
          >
            <div className="mb-2 flex items-center justify-between">
              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-500">Auto-post</div>
              <button type="button" onClick={() => setShareMenuOpen(false)} className="text-[10px] text-neutral-500">Close</button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {(["instagram", "facebook", "tiktok", "snapchat"] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => autoPost(n)}
                  className="rounded-md py-2 text-[10.5px] font-black uppercase tracking-wider"
                  style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}
                >
                  {n}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => { setShareMenuOpen(false); setSocialDrawer({}); }}
              className="mt-2 w-full rounded-md py-2 text-[10.5px] font-black uppercase tracking-wider text-neutral-600 hover:bg-neutral-100"
              style={{ border: "1px solid rgba(139,69,19,0.15)" }}
            >
              Manage links…
            </button>
          </div>
        )}

        {/* Mobile properties bottom-sheet — appears when a layer is
            selected. Same fields as the desktop PropertiesPanel.
            Sits at z-50 (above the z-40 action bar) with an OPAQUE
            white background + inner padding buffer so range slider
            thumbs / dropdowns don't visually bleed into the black
            action bar underneath during scroll. */}
        {selectedLayer && (
          <div
            className="fixed left-0 right-0 z-50 max-h-[45vh] overflow-y-auto rounded-t-2xl border-t p-3 shadow-2xl"
            style={{
              bottom:          `calc(56px + 56px + env(safe-area-inset-bottom, 0px))`,
              paddingBottom:   "20px",
              borderColor:     "rgba(139,69,19,0.15)",
              backgroundColor: "#FFFFFF"
            }}
          >
            <PropertiesPanel
              layer={selectedLayer}
              onChange={(patch) => updateLayer(selectedLayer.id, patch)}
              onDelete={() => removeLayer(selectedLayer.id)}
              onDuplicate={() => duplicateLayer(selectedLayer.id)}
              onBringForward={() => bumpZ(selectedLayer.id, +1)}
              onSendBack={() => bumpZ(selectedLayer.id, -1)}
              adminAuthoring={adminAuthoring}
            />
          </div>
        )}
      </>
    )}

    {/* ==================== CHANGE BOTTOM SHEET ==================== */}
    {/* Three mutually-exclusive toggles: Image (default on when
        sheet opens) · Video · Before / After. Selecting any toggle
        auto-schedules the sheet to close after 3 seconds so the
        merchant sees confirmation then returns to the canvas.
        Image / Video toggles ALSO open their file picker; Before/
        After just switches mode — the merchant uploads BEFORE + AFTER
        images by tapping the canvas halves directly, not here. */}
    {changeSheetOpen && (
      <ChangeSheet
        currentMode={activeS.mode}
        currentMedia={mediaChoice}
        onImage={() => {
          patchSlide((s) => ({ ...s, mode: "single", secondaryBase: undefined }));
          setActiveSlot("base");
          openImagePicker();
        }}
        onVideo={() => {
          patchSlide((s) => ({ ...s, mode: "single", secondaryBase: undefined }));
          setActiveSlot("base");
          openVideoPicker();
        }}
        onBeforeAfter={() => {
          patchSlide((s) => ({
            ...s,
            mode: "beforeAfter",
            secondaryBase: s.secondaryBase ?? newEmptyBaseSlot()
          }));
          setActiveSlot("base");
        }}
        onPickTemplate={(tpl) => {
          // Adopt the template's full state — replaces layers +
          // base + mode. Frame is switched to the template's own.
          // Templates use the legacy top-level shape (base/mode/layers) —
          // migrateLegacyState wraps them into slides[0] so carousel-shaped
          // reads keep working.
          setState(migrateLegacyState(tpl.state));
          const nextFrame = EDITOR_FRAMES.find((f) => f.slug === tpl.frame_slug);
          if (nextFrame) setFrame(nextFrame);
          setActiveSlot("base");
          setChangeSheetOpen(false);
          setStatus(`Loaded template: ${tpl.label}`);
        }}
        onClose={() => setChangeSheetOpen(false)}
      />
    )}
    </>
  );
}

function OverlayDrawer({ onClose, onPick }: { onClose: () => void; onPick: (o: Overlay) => void }) {
  const [group,    setGroup]    = useState<Overlay["group"]>("hero");
  const [overlays, setOverlays] = useState<Overlay[]>(EDITOR_BADGES);
  const [loading,  setLoading]  = useState(true);
  const [uploading,setUploading]= useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const uploadRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/site/editor/overlays");
      const data = await res.json().catch(() => ({} as { overlays?: Overlay[] }));
      // Merge: default hero badges first, then anything the user
      // uploaded (which lives under "custom" via the API).
      setOverlays([...EDITOR_BADGES, ...(data.overlays ?? [])]);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function handleUpload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const label = file.name.replace(/\.[^.]+$/, "").slice(0, 80) || "Overlay";
      // Detect aspect ratio client-side so the layer sizes correctly
      // on drop without a server round trip.
      const ratio = await new Promise<number>((resolve) => {
        const img = new window.Image();
        img.onload  = () => resolve(img.naturalWidth  / Math.max(1, img.naturalHeight));
        img.onerror = () => resolve(1);
        img.src = URL.createObjectURL(file);
      });
      const form = new FormData();
      form.append("file",         file);
      form.append("label",        label);
      form.append("category",     group === "custom" ? "custom" : group);
      form.append("aspect_ratio", String(ratio));
      const res = await fetch("/api/site/editor/overlays", { method: "POST", body: form });
      const data = await res.json().catch(() => ({} as { ok?: boolean; overlay?: Overlay; error?: string }));
      if (!res.ok || data.ok !== true || !data.overlay) {
        setError(data.error === "not_authenticated"
          ? "Sign in to upload overlays."
          : data.error ?? "Upload failed.");
        return;
      }
      setOverlays((prev) => [data.overlay!, ...prev]);
      setGroup((data.overlay.group ?? "custom") as Overlay["group"]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(o: Overlay) {
    if (!o.isMine) return;
    if (!window.confirm(`Delete "${o.label}"?`)) return;
    const res = await fetch(`/api/site/editor/overlays?id=${encodeURIComponent(o.id)}`, { method: "DELETE" });
    if (res.ok) {
      setOverlays((prev) => prev.filter((x) => x.id !== o.id));
    }
  }

  const items = overlays.filter((o) => o.group === group);

  return (
    <div className="overflow-hidden rounded-xl border" style={{ backgroundColor: "white", borderColor: "rgba(139,69,19,0.15)" }}>
      {/* Yellow container-strip header — matches ImageLibraryDrawer
          + SocialLinksDrawer so every drawer reads the same. Small
          yellow icon buttons beside the title give the "advanced UI"
          feel: Upload (primary action) is one tap away, Close on the
          far right. */}
      <div className="flex items-center justify-between px-3 py-1.5" style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}>
        <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em]">
          Overlays
          <span className="rounded-full bg-black/10 px-1.5 py-0.5 text-[9px] font-black text-neutral-700">
            {items.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <HeaderIconBtn title="Upload overlay" onClick={() => uploadRef.current?.click()} busy={uploading}>
            {uploading ? <Loader2 size={12} className="animate-spin"/> : <UploadIcon size={12} strokeWidth={2.4}/>}
          </HeaderIconBtn>
          <HeaderIconBtn title="Refresh" onClick={() => void load()}>
            <RotateCw size={12} strokeWidth={2.4}/>
          </HeaderIconBtn>
          <HeaderIconBtn title="Close" onClick={onClose}>
            <X size={12} strokeWidth={2.6}/>
          </HeaderIconBtn>
        </div>
      </div>

      <div className="p-2">
      {/* Group selector — dropdown (drop-down slider) rather than
          chip buttons so the drawer's visual weight sits on the
          tiles, not on the filter row. */}
      <div className="relative mb-2">
        <select
          value={group}
          onChange={(e) => setGroup(e.target.value as Overlay["group"])}
          aria-label="Overlay category"
          className="h-9 w-full appearance-none rounded-md border pl-3 pr-8 text-[11.5px] font-black uppercase tracking-wider focus:outline-none"
          style={{
            borderColor:     "rgba(139,69,19,0.20)",
            backgroundColor: "white",
            color:           BRAND_BLACK
          }}
        >
          {OVERLAY_GROUPS.map((g) => (
            <option key={g.slug} value={g.slug}>{g.label}</option>
          ))}
        </select>
        <ChevronDown size={14} strokeWidth={2.4} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500"/>
      </div>

      {error && (
        <div className="mb-2 rounded-md bg-red-50 px-2 py-1 text-[10.5px] font-black text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        {/* Upload tile — always first in every category */}
        <button
          type="button"
          disabled={uploading}
          onClick={() => uploadRef.current?.click()}
          className="flex flex-col items-stretch rounded-lg border-2 border-dashed transition hover:border-neutral-500 hover:shadow-md disabled:opacity-60"
          style={{ borderColor: "rgba(139,69,19,0.25)", backgroundColor: CREAM }}
        >
          <div className="flex h-28 w-full flex-col items-center justify-center gap-1 rounded-t-lg bg-transparent p-3 text-neutral-700">
            {uploading ? <Loader2 size={22} className="animate-spin"/> : <UploadIcon size={22} strokeWidth={2}/>}
            <span className="text-[10px] font-black uppercase tracking-wider">
              {uploading ? "Uploading…" : "Upload"}
            </span>
          </div>
          <span className="line-clamp-1 border-t px-2 py-1 text-center text-[10px] font-black uppercase tracking-wider text-neutral-700" style={{ borderColor: "rgba(139,69,19,0.08)" }}>
            PNG · JPG · SVG · 8MB
          </span>
        </button>
        <input
          ref={uploadRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          aria-hidden
          tabIndex={-1}
          style={{ position: "absolute", opacity: 0, pointerEvents: "none", width: 1, height: 1, overflow: "hidden" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleUpload(f);
            e.target.value = "";
          }}
        />

        {items.map((o) => (
          <div
            key={o.id}
            className="group relative flex flex-col items-stretch rounded-lg border transition hover:border-neutral-400 hover:shadow-md"
            style={{ borderColor: "rgba(139,69,19,0.12)", backgroundColor: "white" }}
          >
            <button
              type="button"
              onClick={() => onPick(o)}
              className="flex h-28 w-full items-center justify-center overflow-hidden rounded-t-lg bg-white p-3"
              title={o.label}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={o.url}
                alt={o.label}
                loading="lazy"
                decoding="async"
                className="max-h-full max-w-full object-contain transition group-hover:scale-105"
              />
            </button>
            {o.isMine && (
              <button
                type="button"
                onClick={() => void handleDelete(o)}
                aria-label={`Delete ${o.label}`}
                title="Delete overlay"
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-white text-red-600 opacity-0 shadow transition group-hover:opacity-100"
              >
                <Trash2 size={11}/>
              </button>
            )}
            <span className="line-clamp-1 border-t px-2 py-1 text-center text-[10px] font-black uppercase tracking-wider text-neutral-700" style={{ borderColor: "rgba(139,69,19,0.08)" }}>
              {o.label}
            </span>
          </div>
        ))}

        {!loading && items.length === 0 && (
          <div className="col-span-full py-8 text-center text-[11px] text-neutral-500">
            No overlays in <span className="font-black uppercase">{group}</span> yet — tap Upload to add one.
          </div>
        )}
      </div>
      </div>
    </div>
  );
}

function BannerDrawer({ onClose, onPick }: { onClose: () => void; onPick: (b: Banner) => void }) {
  // Network filter — 1-row toggle. "all" shows the whole library;
  // picking a specific network narrows to banners tagged for that
  // network in banners.ts (squares for feed nets, talls for story
  // nets). Snapchat sits in the same row per the design brief.
  const [network, setNetwork] = useState<NetworkSlug | "all">("all");
  const filtered = network === "all"
    ? BANNER_LIBRARY
    : BANNER_LIBRARY.filter((b) => b.networks.includes(network));

  return (
    <div className="overflow-hidden rounded-xl border" style={{ backgroundColor: "white", borderColor: "rgba(139,69,19,0.15)" }}>
      {/* Yellow container-strip header — same pattern as
          ImageLibrary + Overlays so every drawer reads the same. */}
      <div className="flex items-center justify-between px-3 py-1.5" style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}>
        <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em]">
          Banners
          <span className="rounded-full bg-black/10 px-1.5 py-0.5 text-[9px] font-black text-neutral-700">
            {filtered.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <HeaderIconBtn title="Reset filter" onClick={() => setNetwork("all")}>
            <RotateCw size={12} strokeWidth={2.4}/>
          </HeaderIconBtn>
          <HeaderIconBtn title="Close" onClick={onClose}>
            <X size={12} strokeWidth={2.6}/>
          </HeaderIconBtn>
        </div>
      </div>

      <div className="p-2">
      {/* Network filter — dropdown to match ImageLibrary / Overlays
          pattern (drop-down slider, not chip / icon badges). */}
      <div className="relative mb-2">
        <select
          value={network}
          onChange={(e) => setNetwork(e.target.value as NetworkSlug | "all")}
          aria-label="Filter banners by network"
          className="h-9 w-full appearance-none rounded-md border pl-3 pr-8 text-[11.5px] font-black uppercase tracking-wider focus:outline-none"
          style={{
            borderColor:     "rgba(139,69,19,0.20)",
            backgroundColor: "white",
            color:           BRAND_BLACK
          }}
        >
          <option value="all">All networks</option>
          {(Object.keys(NETWORK_META) as NetworkSlug[]).map((slug) => (
            <option key={slug} value={slug}>{NETWORK_META[slug].label}</option>
          ))}
        </select>
        <ChevronDown size={14} strokeWidth={2.4} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500"/>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {filtered.length === 0 ? (
          <div className="col-span-full flex h-16 items-center justify-center text-[10.5px] text-neutral-500">
            No banners for this network yet.
          </div>
        ) : filtered.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => onPick(b)}
            className="flex flex-col items-center rounded-lg border p-1 transition hover:shadow-sm"
            style={{ borderColor: "rgba(139,69,19,0.10)" }}
            title={b.label}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={b.svg} alt={b.label} className={b.shape === "tall-strip" ? "h-24 w-8 rounded-md" : "h-14 w-14 rounded-md"}/>
            <span className="mt-0.5 line-clamp-1 text-[9px] text-neutral-600">{b.label}</span>
          </button>
        ))}
      </div>
      </div>
    </div>
  );
}

/** Backdrop picker — admin-only drawer that lists the curated
 *  template backdrop pool (hammerex_template_backdrops). Tap a
 *  backdrop to set it as the active slide's base image. Rendered
 *  from EditorClient when libraryOpen === "backdrops". */
type TemplateBackdrop = {
  id:             string;
  slug:           string;
  label:          string;
  url:            string;
  width_px:       number;
  height_px:      number;
  text_safe_zone: string;
  tags:           string[];
};

function BackdropDrawer({ onClose, onPick }: {
  onClose: () => void;
  onPick:  (b: TemplateBackdrop) => void;
}) {
  const [backdrops, setBackdrops] = useState<TemplateBackdrop[] | null>(null);
  const [safe,      setSafe]      = useState<string>("all");
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const url = safe === "all" ? "/api/site/editor/template-backdrops"
                                   : `/api/site/editor/template-backdrops?safe=${encodeURIComponent(safe)}`;
        const res  = await fetch(url);
        const data = await res.json().catch(() => ({ backdrops: [] }));
        if (!cancelled) setBackdrops((data.backdrops as TemplateBackdrop[] | undefined) ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [safe]);

  const items = backdrops ?? [];

  return (
    <div className="overflow-hidden rounded-xl border" style={{ backgroundColor: "white", borderColor: "rgba(139,69,19,0.15)" }}>
      <div className="flex items-center justify-between px-3 py-1.5" style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}>
        <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em]">
          Backdrops
          <span className="rounded-full bg-black/10 px-1.5 py-0.5 text-[9px] font-black text-neutral-700">
            {items.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <HeaderIconBtn title="Close" onClick={onClose}>
            <X size={12} strokeWidth={2.6}/>
          </HeaderIconBtn>
        </div>
      </div>

      <div className="p-2">
        <div className="relative mb-2">
          <select
            value={safe}
            onChange={(e) => setSafe(e.target.value)}
            aria-label="Text-safe zone filter"
            className="h-9 w-full appearance-none rounded-md border pl-3 pr-8 text-[11.5px] font-black uppercase tracking-wider focus:outline-none"
            style={{
              borderColor:     "rgba(139,69,19,0.20)",
              backgroundColor: "white",
              color:           BRAND_BLACK
            }}
          >
            <option value="all">All safe zones</option>
            <option value="any">Any (uniform / texture)</option>
            <option value="top">Text-safe top</option>
            <option value="bottom">Text-safe bottom</option>
            <option value="centre">Text-safe centre</option>
            <option value="left">Text-safe left</option>
            <option value="right">Text-safe right</option>
          </select>
          <ChevronDown size={14} strokeWidth={2.4} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500"/>
        </div>

        {loading ? (
          <div className="flex h-24 items-center justify-center text-neutral-400">
            <Loader2 size={20} className="animate-spin"/>
          </div>
        ) : items.length === 0 ? (
          <div className="py-8 text-center text-[11px] text-neutral-500">
            No backdrops in this filter — seed rows into <span className="font-mono">hammerex_template_backdrops</span> to populate.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {items.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => { onPick(b); onClose(); }}
                className="group flex flex-col overflow-hidden rounded-lg border bg-white text-left transition hover:border-neutral-500 hover:shadow-md"
                style={{ borderColor: "rgba(139,69,19,0.12)" }}
                title={b.label}
              >
                <div className="relative h-28 w-full overflow-hidden bg-neutral-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={b.url}
                    alt={b.label}
                    loading="lazy"
                    className="h-full w-full object-cover transition group-hover:scale-105"
                  />
                  <span className="pointer-events-none absolute left-1 top-1 rounded-full bg-black/70 px-1.5 py-0.5 text-[8.5px] font-black uppercase tracking-wider text-yellow-300">
                    Safe: {b.text_safe_zone}
                  </span>
                </div>
                <div className="line-clamp-2 border-t px-1.5 py-1 text-[10px] font-black uppercase tracking-wider text-neutral-700" style={{ borderColor: "rgba(139,69,19,0.08)" }}>
                  {b.label}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Admin template authoring panel — only rendered when the editor
 *  is opened via /admin/site-editor/templates. Collects the metadata
 *  the DB row needs (slug, label, category, min-tier) then POSTs the
 *  current EditorState to /api/admin/site-editor/templates which
 *  upserts on slug so repeated saves overwrite the same row. */
function AdminTemplatePanel({
  initialSlug,
  initialLabel,
  initialCategory,
  initialSiblingGroup,
  frameSlug,
  state,
  basePlaceholder,
  baseHasImage,
  onStatus,
  onOpenBackdrops,
  onMarkPlaceholder,
  onClearPlaceholder,
  captureThumbnail
}: {
  initialSlug:         string;
  initialLabel:        string;
  initialCategory:     string;
  initialSiblingGroup: string;
  frameSlug:           string;
  state:               EditorState;
  basePlaceholder:     boolean;
  baseHasImage:        boolean;
  onStatus:            (msg: string | null) => void;
  onOpenBackdrops:     () => void;
  onMarkPlaceholder:   () => void;
  onClearPlaceholder:  () => void;
  /** Snapshot the current canvas as a PNG data URL — parent owns
   *  the stage ref so this callback bridges into it. Returns null
   *  when the stage isn't mounted yet. */
  captureThumbnail:    () => string | null;
}) {
  const [slug,         setSlug]         = useState(initialSlug);
  const [label,        setLabel]        = useState(initialLabel);
  const [category,     setCategory]     = useState(initialCategory);
  const [minTier,      setMinTier]      = useState<string>("");
  const [siblingGroup, setSiblingGroup] = useState<string>(initialSiblingGroup);
  const [saving,       setSaving]       = useState(false);

  const suggestSlugFromLabel = () => {
    if (slug) return;
    const s = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
    if (s) setSlug(s);
  };

  const handleSave = async () => {
    if (!slug || !label) {
      onStatus("Template needs both slug and label.");
      return;
    }
    setSaving(true);
    onStatus("Capturing preview…");
    try {
      // Two-step save: (1) upload thumbnail PNG, (2) POST template
      // row referencing the thumbnail URL. Thumbnail failure is
      // non-fatal — we still save the template so the admin doesn't
      // lose their work.
      let thumbnailUrl: string | null = null;
      const dataUrl = captureThumbnail();
      if (dataUrl) {
        try {
          const thumbRes = await fetch("/api/admin/site-editor/template-thumbnail", {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ data_url: dataUrl, slug })
          });
          const thumbData = await thumbRes.json().catch(() => ({} as { ok?: boolean; url?: string }));
          if (thumbRes.ok && thumbData.ok && thumbData.url) thumbnailUrl = thumbData.url;
        } catch { /* fall through — save row without thumbnail */ }
      }

      onStatus("Saving template…");
      const res = await fetch("/api/admin/site-editor/templates", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          label,
          category,
          frame_slug:         frameSlug,
          state_json:         state,
          thumbnail_url:      thumbnailUrl,
          min_tier:           minTier || null,
          sibling_group_slug: siblingGroup || null,
          active:             true
        })
      });
      const data = await res.json().catch(() => ({} as { ok?: boolean; error?: string }));
      if (!res.ok || !data.ok) {
        onStatus(data.error ?? "Save failed.");
      } else {
        onStatus(`Template saved: ${label} (${slug})${thumbnailUrl ? " · preview updated" : ""}`);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border" style={{ backgroundColor: "white", borderColor: "rgba(139,69,19,0.15)" }}>
      <div className="flex items-center justify-between px-3 py-1.5" style={{ backgroundColor: "#166534", color: "#FFFFFF" }}>
        <div className="text-[11px] font-black uppercase tracking-[0.16em]">
          Admin · Save as template
        </div>
        <div className="text-[10px] uppercase tracking-wider opacity-80">
          Frame: {frameSlug}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2">
        <label className="text-[10px] font-black uppercase text-neutral-500">
          Label
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value.slice(0, 120))}
            onBlur={suggestSlugFromLabel}
            placeholder="e.g. Big quote (white)"
            className="mt-1 w-full rounded-md border px-2 py-1.5 text-[12px]"
            style={{ borderColor: "rgba(139,69,19,0.15)" }}
          />
        </label>
        <label className="text-[10px] font-black uppercase text-neutral-500">
          Slug
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 60))}
            placeholder="e.g. quote-big-white"
            className="mt-1 w-full rounded-md border px-2 py-1.5 text-[12px] font-mono"
            style={{ borderColor: "rgba(139,69,19,0.15)" }}
          />
        </label>
        <label className="text-[10px] font-black uppercase text-neutral-500">
          Category
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="mt-1 w-full rounded-md border px-2 py-1.5 text-[12px]"
            style={{ borderColor: "rgba(139,69,19,0.15)" }}
          >
            <option value="promo">Offers & promos</option>
            <option value="price-card">Prices</option>
            <option value="quote">Quotes</option>
            <option value="testimonial">Testimonials</option>
            <option value="announcement">Announcements</option>
            <option value="before-after">Before / After</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label className="text-[10px] font-black uppercase text-neutral-500">
          Min tier
          <select
            value={minTier}
            onChange={(e) => setMinTier(e.target.value)}
            className="mt-1 w-full rounded-md border px-2 py-1.5 text-[12px]"
            style={{ borderColor: "rgba(139,69,19,0.15)" }}
          >
            <option value="">Free to all</option>
            <option value="app_trial">App trial +</option>
            <option value="app_paid">App paid +</option>
            <option value="verified">Verified +</option>
          </select>
        </label>
        <label className="col-span-full text-[10px] font-black uppercase text-neutral-500">
          Sibling group (multi-size link)
          <input
            type="text"
            value={siblingGroup}
            onChange={(e) => setSiblingGroup(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 60))}
            placeholder="e.g. quote-big-white-set — leave blank if standalone"
            className="mt-1 w-full rounded-md border px-2 py-1.5 text-[12px] font-mono"
            style={{ borderColor: "rgba(139,69,19,0.15)" }}
          />
          <span className="mt-0.5 block text-[9px] font-normal normal-case text-neutral-400">
            Templates sharing this group link as multi-size variants of the same design.
          </span>
        </label>
        {/* Base-image quick actions — one-tap flows for the two
            common template photo strategies:
              (a) Pick a curated backdrop as the DEFAULT photo
                  (merchant can keep or swap in the editor)
              (b) Empty the slot + flag as placeholder so merchants
                  see "Tap to add your photo" (forces upload) */}
        <div className="col-span-full flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={onOpenBackdrops}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[10px] font-black uppercase tracking-wider hover:bg-neutral-50"
            style={{ borderColor: "rgba(139,69,19,0.20)", color: BRAND_BLACK }}
          >
            <ImageIcon size={12}/>
            Pick backdrop
          </button>
          {basePlaceholder ? (
            <button
              type="button"
              onClick={onClearPlaceholder}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[10px] font-black uppercase tracking-wider hover:bg-neutral-50"
              style={{ borderColor: "rgba(139,69,19,0.20)", color: BRAND_BLACK }}
            >
              Clear placeholder flag
            </button>
          ) : (
            <button
              type="button"
              onClick={onMarkPlaceholder}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[10px] font-black uppercase tracking-wider hover:bg-neutral-50"
              style={{ borderColor: "rgba(139,69,19,0.20)", color: BRAND_BLACK }}
            >
              Empty base as placeholder
            </button>
          )}
          <span className="text-[10px] text-neutral-500">
            {basePlaceholder ? "Merchants see 'Tap to add your photo'."
              : baseHasImage  ? "Ships with this photo as the default."
                              : "No base photo set."}
          </span>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !label || !slug}
          className="col-span-full inline-flex h-9 items-center justify-center gap-2 rounded-md text-[11px] font-black uppercase tracking-wider disabled:opacity-60"
          style={{ backgroundColor: "#166534", color: "#FFFFFF" }}
        >
          {saving ? <Loader2 size={12} className="animate-spin"/> : <Save size={12}/>}
          Save as template
        </button>
      </div>
    </div>
  );
}

/** Templates drawer — pre-built compositions the merchant taps to
 *  adopt as their entire canvas state. Powered by
 *  hammerex_site_editor_templates (seeded with 6 offers/promos/
 *  testimonial/announcement layouts; extend by inserting rows).
 *  Categories dropdown mirrors the DB `category` column. Picking a
 *  card fires onPick with the full EditorTemplate — the parent
 *  runs migrateLegacyState + setFrame. */
const TEMPLATE_CATEGORIES: Array<{ slug: string; label: string }> = [
  { slug: "all",          label: "All templates" },
  { slug: "crown",        label: "Crown · Premium" },
  { slug: "promo",        label: "Offers & promos" },
  { slug: "price-card",   label: "Prices" },
  { slug: "quote",        label: "Quotes" },
  { slug: "testimonial",  label: "Testimonials" },
  { slug: "announcement", label: "Announcements" },
  { slug: "before-after", label: "Before / After" }
];

function TemplatesDrawer({ onClose, onPick, currentFrameSlug }: {
  onClose:           () => void;
  onPick:            (tpl: EditorTemplate) => void;
  /** Merchant's currently-selected frame — used by the "Fits current
   *  frame" toggle. When on, we filter templates to those sharing
   *  the same frame_slug so what shows up is what will land clean
   *  on the canvas. Default: on, so the drawer is helpful even
   *  when the merchant hasn't thought about it. */
  currentFrameSlug:  string | null;
}) {
  const [category, setCategory] = useState<string>("all");
  const [filterFrame, setFilterFrame] = useState<boolean>(!!currentFrameSlug);
  // Hydrate synchronously from the module cache so the drawer opens
  // populated on subsequent visits (no spinner flash).
  const [templates, setTemplates] = useState<EditorTemplate[] | null>(() =>
    templatesCache ? (templatesCache as unknown as EditorTemplate[]) : null
  );
  const [loading, setLoading]     = useState(templatesCache === null);

  useEffect(() => {
    // If we already have a cache hit, skip the fetch entirely.
    if (templatesCache) return;
    let cancelled = false;
    (async () => {
      const merged = await ensureTemplatesCache();
      if (!cancelled) {
        setTemplates(merged as unknown as EditorTemplate[]);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Collapse siblings into one entry per sibling_group_slug (or
  // per-template for standalones). Each entry shows the "cover" —
  // the sibling that matches the current frame (if any), else the
  // first member. `alternates` counts the extra frames available so
  // we can badge the card with a "3 sizes" pip.
  const rawItems = (templates ?? [])
    .filter((t) => category === "all" ? true : t.category === category);

  const grouped = new Map<string, { cover: EditorTemplate; siblings: EditorTemplate[] }>();
  for (const t of rawItems) {
    const key = t.sibling_group_slug ?? `standalone:${t.slug}`;
    const g = grouped.get(key);
    if (g) {
      g.siblings.push(t);
      // Prefer a sibling whose frame matches the current frame as the cover.
      if (currentFrameSlug && t.frame_slug === currentFrameSlug) g.cover = t;
    } else {
      grouped.set(key, { cover: t, siblings: [t] });
    }
  }

  const items = Array.from(grouped.values())
    .filter((g) => {
      if (!filterFrame || !currentFrameSlug) return true;
      // Fits-frame toggle — group is shown when ANY sibling matches.
      return g.siblings.some((s) => s.frame_slug === currentFrameSlug);
    });

  // Escape closes + scroll lock while open — matches ImageLibraryDrawer
  // so the two drawers feel identical from the user's side.
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

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center"
      style={{ backgroundColor: "rgba(10,10,10,0.55)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Templates"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex h-[70vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl"
      >
        {/* Header — brand-yellow band, matches ImageLibraryDrawer. */}
        <div className="flex flex-none items-center justify-between border-b px-4 py-2" style={{ borderColor: "rgba(0,0,0,0.10)", backgroundColor: BRAND_YELLOW }}>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: BRAND_BLACK }}>Templates</span>
            <span className="rounded-full bg-black/10 px-1.5 py-0.5 text-[9px] font-black text-neutral-800">
              {items.length}
            </span>
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
            aria-label="Close templates"
            className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-black/10"
            style={{ color: BRAND_BLACK }}
          >
            <X size={15} strokeWidth={2.6}/>
          </button>
        </div>

        {/* Category dropdown row — matches the source-select row in
            ImageLibraryDrawer so the two drawers share a visual rhythm. */}
        <div className="flex flex-none flex-wrap items-center gap-2 border-b px-3 py-2" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
          <div className="relative">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              aria-label="Template category"
              className="h-9 appearance-none rounded-md border pl-3 pr-8 text-[11.5px] font-black uppercase tracking-wider focus:outline-none"
              style={{
                borderColor:     "rgba(139,69,19,0.20)",
                backgroundColor: "white",
                color:           BRAND_BLACK
              }}
            >
              {TEMPLATE_CATEGORIES.map((c) => (
                <option key={c.slug} value={c.slug}>{c.label}</option>
              ))}
            </select>
            <ChevronDown size={14} strokeWidth={2.4} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500"/>
          </div>
        </div>

        {/* Scrollable grid */}
        <div className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-neutral-500">
              <div className="relative">
                <Loader2 size={48} strokeWidth={2.2} className="animate-spin" style={{ color: BRAND_YELLOW }}/>
                <div
                  className="absolute inset-0 rounded-full"
                  style={{ boxShadow: `0 0 20px ${BRAND_YELLOW}55` }}
                />
              </div>
              <div className="flex flex-col items-center gap-1">
                <span
                  className="text-[13px] font-black uppercase tracking-[0.28em] animate-pulse"
                  style={{ color: BRAND_BLACK }}
                >
                  Loading
                </span>
                <span className="text-[10px] font-medium uppercase tracking-wider text-neutral-500">
                  Fetching your template library
                </span>
              </div>
            </div>
          ) : items.length === 0 ? (
            <div className="flex h-full items-center justify-center text-[12px] text-neutral-500">
              No templates in this category yet.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {items.map(({ cover, siblings }) => {
                const sizeCount = siblings.length;
                return (
                  <button
                    key={cover.id}
                    type="button"
                    onClick={() => {
                      // Multi-size groups: prefer the sibling matching
                      // the merchant's current frame, else fall back to
                      // the cover. Standalones just pick the cover.
                      const target = (currentFrameSlug && siblings.find((s) => s.frame_slug === currentFrameSlug)) || cover;
                      onPick(target);
                      onClose();
                    }}
                    className="group flex flex-col overflow-hidden rounded-lg border bg-white text-left transition hover:border-neutral-500 hover:shadow-md"
                    style={{ borderColor: "rgba(139,69,19,0.12)" }}
                    title={cover.label}
                  >
                    <div className="relative flex h-32 w-full items-center justify-center overflow-hidden bg-neutral-100">
                      {cover.preview ? (
                        <>
                          {/* Real library photo */}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={cover.preview.imageUrl}
                            alt={cover.label}
                            loading="lazy"
                            className="absolute inset-0 h-full w-full object-cover transition group-hover:scale-105"
                          />
                          {/* Scrim for text legibility — direction
                              matches where the headline sits. */}
                          <div
                            className="pointer-events-none absolute inset-0"
                            style={{
                              background:
                                cover.preview.scrim === "top"    ? "linear-gradient(180deg, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0) 65%)"
                              : cover.preview.scrim === "full"   ? "linear-gradient(180deg, rgba(0,0,0,0.55), rgba(0,0,0,0.55))"
                              : cover.preview.scrim === "left"   ? "linear-gradient(90deg, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0) 65%)"
                              :                                    "linear-gradient(180deg, rgba(0,0,0,0) 35%, rgba(0,0,0,0.8) 100%)"
                            }}
                          />
                          {/* Headline + subline overlay */}
                          <div
                            className={
                              "pointer-events-none absolute inset-0 flex flex-col p-2 " +
                              (cover.preview.scrim === "top"    ? "justify-start"
                              : cover.preview.scrim === "full"   ? "justify-center items-center text-center"
                              : cover.preview.scrim === "left"   ? "justify-center items-start"
                              :                                    "justify-end")
                            }
                          >
                            <div
                              className="text-[11px] font-black uppercase leading-tight"
                              style={{
                                color: cover.preview.textColor ?? "#FFFFFF",
                                textShadow: "0 1px 3px rgba(0,0,0,0.7)",
                                letterSpacing: "-0.01em"
                              }}
                            >
                              {cover.preview.headline}
                            </div>
                            {cover.preview.subline && (
                              <div
                                className="mt-0.5 text-[8.5px] font-bold uppercase tracking-wider"
                                style={{
                                  color: "#FFFFFF",
                                  opacity: 0.95,
                                  textShadow: "0 1px 2px rgba(0,0,0,0.7)"
                                }}
                              >
                                {cover.preview.subline}
                              </div>
                            )}
                          </div>
                        </>
                      ) : cover.thumbnail_url ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={cover.thumbnail_url}
                          alt={cover.label}
                          loading="lazy"
                          className="h-full w-full object-cover transition group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-neutral-50 text-neutral-400">
                          <LayoutTemplate size={22} strokeWidth={1.5}/>
                          <span className="text-[9px] font-black uppercase tracking-wider">{cover.frame_slug}</span>
                        </div>
                      )}
                      {/* Category badge — top-left corner pill */}
                      <span className="pointer-events-none absolute left-1 top-1 rounded-full bg-black/70 px-1.5 py-0.5 text-[8.5px] font-black uppercase tracking-wider text-yellow-300">
                        {cover.category}
                      </span>
                      {/* Gold Crown badge — top-right, marks premium
                          burnt-in banners so merchants know it's the
                          curated tier. Trumps the sibling pip. */}
                      {cover.isCrown ? (
                        <span
                          className="pointer-events-none absolute right-1 top-1 flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[8.5px] font-black uppercase tracking-wider shadow"
                          style={{ backgroundColor: "#D4AF37", color: "#0A0A0A" }}
                        >
                          <Crown size={10} strokeWidth={2.4}/>
                          Crown
                        </span>
                      ) : sizeCount > 1 ? (
                        <span className="pointer-events-none absolute right-1 top-1 rounded-full bg-yellow-400 px-1.5 py-0.5 text-[8.5px] font-black uppercase tracking-wider text-black">
                          {sizeCount} sizes
                        </span>
                      ) : null}
                    </div>
                    <div className="line-clamp-2 border-t px-1.5 py-1 text-[10px] font-black uppercase tracking-wider text-neutral-700" style={{ borderColor: "rgba(139,69,19,0.08)" }}>
                      {cover.label}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Shape library drawer — category dropdown + preset grid. Each
 *  card renders an inline SVG preview of the shape at its actual
 *  style (solid / outline / bordered) so what the merchant sees is
 *  what lands on the canvas. Picking a card calls onPick with the
 *  full style preset (fill / stroke / strokeWidth) so the shape
 *  drops in-place already looking right. */
function ShapeDrawer({ onClose, onPick }: {
  onClose: () => void;
  onPick:  (kind: ShapeLayer["shape"], preset: { fill: string | null; stroke: string | null; strokeWidth: number }) => void;
}) {
  const [category, setCategory] = useState<ShapeCategory>("basic");
  const items = SHAPE_LIBRARY.filter((s) => s.category === category);

  return (
    <div className="overflow-hidden rounded-xl border" style={{ backgroundColor: "white", borderColor: "rgba(139,69,19,0.15)" }}>
      {/* Yellow container-strip header — matches every other drawer. */}
      <div className="flex items-center justify-between px-3 py-1.5" style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}>
        <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em]">
          Shapes
          <span className="rounded-full bg-black/10 px-1.5 py-0.5 text-[9px] font-black text-neutral-700">
            {items.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <HeaderIconBtn title="Close" onClick={onClose}>
            <X size={12} strokeWidth={2.6}/>
          </HeaderIconBtn>
        </div>
      </div>

      <div className="p-2">
        {/* Category dropdown — drop-down slider (matches Image /
            Overlays / Banners). */}
        <div className="relative mb-2">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as ShapeCategory)}
            aria-label="Shape category"
            className="h-9 w-full appearance-none rounded-md border pl-3 pr-8 text-[11.5px] font-black uppercase tracking-wider focus:outline-none"
            style={{
              borderColor:     "rgba(139,69,19,0.20)",
              backgroundColor: "white",
              color:           BRAND_BLACK
            }}
          >
            {SHAPE_CATEGORIES.map((c) => (
              <option key={c.slug} value={c.slug}>{c.label}</option>
            ))}
          </select>
          <ChevronDown size={14} strokeWidth={2.4} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500"/>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {items.map((entry) => {
            const preset = stylePreset(entry);
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => { onPick(entry.kind, preset); onClose(); }}
                className="flex flex-col items-center gap-1 rounded-lg border p-1 transition hover:shadow-sm"
                style={{ borderColor: "rgba(139,69,19,0.10)" }}
                title={entry.label}
              >
                <ShapeThumb kind={entry.kind} preset={preset}/>
                <span className="line-clamp-1 text-[9px] text-neutral-600">{entry.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Inline-SVG shape preview — matches the on-canvas Konva render
 *  so the picker WYSIWYG's the outcome. Fixed 48×48 viewport with
 *  4px padding so borders don't clip. */
function ShapeThumb({ kind, preset }: {
  kind:   ShapeLayer["shape"];
  preset: { fill: string | null; stroke: string | null; strokeWidth: number };
}) {
  const size = 48;
  const pad  = 4;
  const s    = size - pad * 2;
  const fill        = preset.fill   ?? "none";
  const stroke      = preset.stroke ?? "none";
  const strokeWidth = preset.stroke ? Math.max(1, preset.strokeWidth) : 0;
  let inner: React.ReactNode = null;
  if (kind === "rect")     inner = <rect x={pad} y={pad} width={s} height={s} rx={6} fill={fill} stroke={stroke} strokeWidth={strokeWidth}/>;
  if (kind === "circle")   inner = <circle cx={size / 2} cy={size / 2} r={s / 2} fill={fill} stroke={stroke} strokeWidth={strokeWidth}/>;
  if (kind === "triangle") inner = <polygon points={`${size / 2},${pad} ${size - pad},${size - pad} ${pad},${size - pad}`} fill={fill} stroke={stroke} strokeWidth={strokeWidth}/>;
  if (kind === "star") {
    const pts: string[] = [];
    const cx = size / 2, cy = size / 2, rOut = s / 2, rIn = rOut * 0.5;
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? rOut : rIn;
      const a = (Math.PI / 5) * i - Math.PI / 2;
      pts.push(`${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`);
    }
    inner = <polygon points={pts.join(" ")} fill={fill} stroke={stroke} strokeWidth={strokeWidth}/>;
  }
  if (kind === "arrow") {
    const cy = size / 2;
    const barH = 8;
    const headW = 12;
    const colour = preset.fill ?? preset.stroke ?? "#0A0A0A";
    inner = <polygon points={`${pad},${cy - barH / 2} ${size - pad - headW},${cy - barH / 2} ${size - pad - headW},${pad} ${size - pad},${cy} ${size - pad - headW},${size - pad} ${size - pad - headW},${cy + barH / 2} ${pad},${cy + barH / 2}`} fill={colour}/>;
  }
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {inner}
    </svg>
  );
}

// ============================================================ subcomponents

/** Lucide icon per network. lucide dropped brand marks for
 *  trademark reasons, so we map to semantic-fit icons that ARE in
 *  lucide (platform rule: lucide-only, no invented SVGs):
 *    Instagram → Camera        (photo-first app)
 *    Facebook  → MessageCircle (social messaging)
 *    TikTok    → Music2        (short-form video with music)
 *    Snapchat  → Ghost         (Snap's mascot). */
const NETWORK_ICON: Record<NetworkSlug, typeof Camera> = {
  instagram:  Camera,
  facebook:   MessageCircle,
  tiktok:     Music2,
  snapchat:   Ghost,
  networkers: HardHat        // Canteen + Yard live under the Networkers marque
};

function FramePicker({ current, onChange }: { current: EditorFrame; onChange: (f: EditorFrame) => void }) {
  const [network, setNetwork] = useState<NetworkSlug>(current.network);
  useEffect(() => { setNetwork(current.network); }, [current.network]);
  const options = EDITOR_FRAMES.filter((f) => f.network === network);
  return (
    <div className="relative flex flex-col gap-2 overflow-hidden rounded-xl border p-2" style={{ backgroundColor: CREAM, borderColor: "rgba(139,69,19,0.15)" }}>
      {/* Bulldozer decor — sits on the RIGHT edge. Previously used a
          negative percentage offset (right: -25%) which multiplied
          on wider desktop containers and pushed the image entirely
          off-screen. Now anchored a fixed 12px inside the right edge
          so it stays consistently visible across viewports. Sits
          behind the interactive controls (z-0) with pointer-events
          off so it never blocks a tap on the social buttons or frame
          chips. Reduced opacity so the icons + text keep full
          contrast. object-contain preserves the truck silhouette. */}
      <img
        src="https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2021,%202026,%2002_05_49%20PM.png"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 z-0 h-[120%] w-auto -translate-y-1/2 object-contain"
        style={{ right: "12px", opacity: 0.32 }}
      />
      {/* Section header — sits above the network icons so the merchant
          knows what they're picking. Prominent black h2-scale title
          + a muted subtitle underneath. */}
      <div className="relative z-10 flex flex-col leading-tight">
        <h2 className="text-[22px] font-black uppercase tracking-[0.10em] sm:text-[26px]" style={{ color: BRAND_BLACK }}>
          Social Media
        </h2>
        <span className="mt-0.5 text-[11px] font-black uppercase tracking-wider text-neutral-500">
          Select your preferred social media
        </span>
      </div>
      <div className="relative z-10 flex flex-wrap gap-2">
        {(Object.keys(NETWORK_META) as NetworkSlug[]).map((slug) => {
          const meta            = NETWORK_META[slug];
          const iconUrl         = NETWORK_ICON_URL[slug];
          const LucideFallback  = NETWORK_ICON[slug];
          const active          = slug === network;
          const isNetworkers    = slug === "networkers";
          return (
            <button
              key={slug}
              type="button"
              onClick={() => setNetwork(slug)}
              aria-label={meta.label}
              title={meta.label}
              // Same 44×44 tap target for every network (WCAG). The
              // visual footprint of the icon inside is what varies —
              // social PNGs occupy 36×36 (their brand art fills the
              // square), so Networkers gets the SAME 36×36 orange
              // inner square with the HardHat centred inside. Result:
              // every chip reads at the same visual weight.
              className="flex h-11 w-11 items-center justify-center rounded-md transition hover:brightness-110"
              style={{
                backgroundColor: "transparent",
                border:          active
                  ? `2px solid ${isNetworkers ? "#F97316" : BRAND_YELLOW}`
                  : "2px solid transparent",
                boxShadow:       active
                  ? (isNetworkers ? "0 2px 8px rgba(249,115,22,0.4)" : "0 2px 8px rgba(255,179,0,0.4)")
                  : "none"
              }}
            >
              {iconUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={iconUrl} alt="" className="h-9 w-9 object-contain"/>
              ) : LucideFallback ? (
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-md"
                  style={{ backgroundColor: "#F97316", color: "white" }}
                >
                  <LucideFallback size={20} strokeWidth={2.4}/>
                </div>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Frame-size label — sits between the network icons and the
          aspect chips so the merchant knows the next row is where
          they pick the post shape (Feed / Story / Reel etc).
          Image / Video selection now lives in the Change bottom-sheet
          (top-left of the canvas). */}
      <div className="relative z-10 mt-1 text-[11px] font-black uppercase tracking-wider text-neutral-500">
        Select post
      </div>
      <div className="relative z-10 flex flex-wrap gap-1">
        {options.map((opt) => {
          const active = opt.slug === current.slug;
          return (
            <button
              key={opt.slug}
              type="button"
              onClick={() => onChange(opt)}
              className="inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-[10.5px] font-black uppercase tracking-wider transition"
              style={{
                // Selected chip = dark green (platform CTA green,
                // #166534) with white text. Default = white with
                // black text. Small rounded corners (rounded-md).
                backgroundColor: active ? "#166534" : "white",
                color:           active ? "white"   : BRAND_BLACK,
                border:          active
                  ? "1.5px solid #166534"
                  : "1px solid rgba(139,69,19,0.15)",
                boxShadow:       active ? "0 2px 6px rgba(22,101,52,0.30)" : "none"
              }}
              title={opt.bestFor}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Toolrail({
  current,
  onSelect,
  onAddText,
  onOpenFilePicker
}: {
  current:          Tool;
  onSelect:         (t: Tool) => void;
  onAddText:        () => void;
  onOpenFilePicker: () => void;
}) {
  return (
    <div className="flex flex-row gap-1.5 md:flex-col">
      <ToolBtn
        icon={<ImageIcon size={16}/>}
        label="Upload"
        active={current === "upload"}
        onClick={() => { onSelect("upload"); onOpenFilePicker(); }}
      />
      <ToolBtn
        icon={<Layers size={16}/>}
        label="Library"
        active={current === "library"}
        onClick={() => onSelect("library")}
      />
      <ToolBtn icon={<Type size={16}/>}     label="Text"     active={current === "text"}     onClick={() => { onSelect("text"); onAddText(); }}/>
      <ToolBtn icon={<Layers size={16}/>}   label="Overlays" active={current === "overlays"} onClick={() => onSelect("overlays")}/>
      <ToolBtn icon={<Square size={16}/>}   label="Banners"  active={current === "banners"}  onClick={() => onSelect("banners")}/>
      <ToolBtn icon={<Circle size={16}/>}  label="Shapes"  active={current === "shapes"}  onClick={() => onSelect("shapes")}/>
      <ToolBtn icon={<LayoutTemplate size={16}/>} label="Templates" active={current === "templates"} onClick={() => onSelect("templates")}/>
    </div>
  );
}

function ToolBtn({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  // Default = solid yellow button with black icon/text.
  // Active  = solid black with yellow icon/text — inverted so the
  // selected tool reads clearly at a glance.
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-14 w-14 flex-col items-center justify-center gap-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition"
      style={{
        backgroundColor: active ? BRAND_BLACK : BRAND_YELLOW,
        color:           active ? BRAND_YELLOW : BRAND_BLACK,
        boxShadow:       active
          ? "0 2px 6px rgba(0,0,0,0.35), inset 0 1px 2px rgba(0,0,0,0.4)"
          : "0 1px 2px rgba(255,179,0,0.25)"
      }}
    >
      {icon}
      {label}
    </button>
  );
}

/** Mobile tool-rail button — horizontal-scroll strip variant. Same
 *  green-when-active / yellow-otherwise language as the desktop
 *  ToolBtn but sized for touch (min 44×44 tap target). */
function MobileToolBtn({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-14 w-full flex-col items-center justify-center gap-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition"
      style={{
        backgroundColor: active ? BRAND_BLACK : BRAND_YELLOW,
        color:           active ? BRAND_YELLOW : BRAND_BLACK,
        boxShadow:       active
          ? "0 2px 6px rgba(0,0,0,0.35), inset 0 1px 2px rgba(0,0,0,0.4)"
          : "0 1px 2px rgba(255,179,0,0.25)"
      }}
    >
      {icon}
      {label}
    </button>
  );
}

/** Mobile action-bar button — icon + label vertically stacked so
 *  4 buttons fit across a phone comfortably. Yellow icon on the
 *  black bar background. */
function MobileActionBtn({ icon, label, busy, onClick }: { icon: React.ReactNode; label: string; busy: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="flex h-11 min-w-[52px] flex-col items-center justify-center gap-0.5 rounded-md px-2 text-[9px] font-black uppercase tracking-wider disabled:opacity-60"
      style={{ color: BRAND_YELLOW }}
    >
      {busy ? <Loader2 size={14} className="animate-spin"/> : icon}
      {label}
    </button>
  );
}

function ShapeMini({ icon, onClick }: { icon: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-md text-neutral-700 transition hover:bg-neutral-100"
    >
      {icon}
    </button>
  );
}

/** Small circular icon button that sits inside a yellow drawer
 *  header strip. Black-on-yellow with a translucent hover ring so
 *  the header stays on-brand while providing pro-feel actions
 *  (upload, refresh, close, extras). 24×24 for a compact strip. */
function HeaderIconBtn({ title, onClick, busy, children }: {
  title:    string;
  onClick:  () => void;
  busy?:    boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={busy}
      className="flex h-6 w-6 items-center justify-center rounded-full transition hover:bg-black/15 disabled:opacity-60"
      style={{ color: BRAND_BLACK }}
    >
      {children}
    </button>
  );
}

function PropertiesPanel({
  layer,
  onChange,
  onDelete,
  onDuplicate,
  onBringForward,
  onSendBack,
  adminAuthoring
}: {
  layer:          EditorLayer | null;
  onChange:       (patch: Partial<EditorLayer>) => void;
  onDelete:       () => void;
  onDuplicate:    () => void;
  onBringForward: () => void;
  onSendBack:     () => void;
  /** Admin authoring mode — reveals template-author-only controls
   *  like the text-lock toggles. Undefined = normal merchant use. */
  adminAuthoring?: boolean;
}) {
  if (!layer) {
    return (
      <div className="rounded-xl border p-3 text-[11px] text-neutral-500" style={{ backgroundColor: "white", borderColor: "rgba(139,69,19,0.15)" }}>
        Select a layer to edit its properties.
      </div>
    );
  }
  // Human-readable label for the header — layer.kind is the internal
  // union tag; users see "Text" / "Shape" / "Image" / etc. in the
  // yellow strip.
  const kindLabel = layer.kind === "text"     ? "Text"
                  : layer.kind === "shape"    ? "Shape"
                  : layer.kind === "image"    ? "Image"
                  : layer.kind === "overlay"  ? "Overlay"
                  : layer.kind === "banner"   ? "Banner"
                  :                             "Layer";
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border" style={{ backgroundColor: "white", borderColor: "rgba(139,69,19,0.15)" }}>
      {/* Yellow container-strip header — matches ImageLibrary /
          Overlays / Banners so every panel reads the same. Pro-feel
          icon buttons on the right (duplicate, bring forward, send
          back, delete) sit inside the yellow strip so layer actions
          are always one tap away without competing with the fields
          below. */}
      <div className="flex items-center justify-between px-3 py-1.5" style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}>
        <div className="text-[11px] font-black uppercase tracking-[0.16em]">
          {kindLabel}
        </div>
        <div className="flex items-center gap-1">
          <HeaderIconBtn title="Duplicate"     onClick={onDuplicate}><Copy size={12}/></HeaderIconBtn>
          <HeaderIconBtn title="Bring forward" onClick={onBringForward}><MoveUp size={12}/></HeaderIconBtn>
          <HeaderIconBtn title="Send back"     onClick={onSendBack}><MoveDown size={12}/></HeaderIconBtn>
          <HeaderIconBtn title="Delete"        onClick={onDelete}><Trash2 size={12}/></HeaderIconBtn>
        </div>
      </div>
      <div className="flex flex-col gap-2 p-3">

      {layer.kind === "text" && (
        <>
          {/* Template-authored style lock — merchant can always edit
              the text CONTENT, but styling controls (size / weight /
              align / colour / font / effects) are hidden when the
              template author locked the design. A "Locked" pill flags
              why the sliders are gone. */}
          {layer.locked === "style" && (
            <div className="inline-flex w-fit items-center gap-1 rounded-full bg-black/5 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-neutral-600">
              Template locked
            </div>
          )}
          {/* Admin-only lock authoring — sets the layer.locked flag
              so downstream merchants see the constraints applied. */}
          {adminAuthoring && (
            <div className="flex flex-wrap gap-1 rounded-md border border-dashed p-1.5" style={{ borderColor: "#166534" }}>
              <span className="mr-1 text-[9px] font-black uppercase tracking-wider text-neutral-500">
                Author locks:
              </span>
              <MiniToggle
                active={layer.locked === "style"}
                onClick={() => onChange({ locked: layer.locked === "style" ? undefined : "style" } as Partial<EditorLayer>)}
                label="Style"
              />
              <MiniToggle
                active={layer.locked === "position"}
                onClick={() => onChange({ locked: layer.locked === "position" ? undefined : "position" } as Partial<EditorLayer>)}
                label="Position"
              />
            </div>
          )}
          <textarea
            value={layer.text}
            onChange={(e) => onChange({ text: e.target.value })}
            rows={3}
            className="rounded-md border px-2 py-1 text-[12px]"
            style={{ borderColor: "rgba(139,69,19,0.15)" }}
          />
          {layer.locked !== "style" && (
          <>
          <label className="text-[10px] font-black uppercase text-neutral-500">
            Size
            <input
              type="range" min={12} max={140} value={layer.fontSize}
              onChange={(e) => onChange({ fontSize: Number(e.target.value) })}
              className="mt-1 w-full"
            />
          </label>
          <div className="flex gap-1">
            <MiniToggle active={layer.variant === "body"}   onClick={() => onChange({ variant: "body" })}   label="Body"/>
            <MiniToggle active={layer.variant === "header"} onClick={() => onChange({ variant: "header", fontSize: Math.max(layer.fontSize, 48), fontWeight: 800 })} label="Header"/>
          </div>
          <div className="flex gap-1">
            <MiniToggle active={layer.fontWeight >= 700} onClick={() => onChange({ fontWeight: layer.fontWeight >= 700 ? 400 : 700 })} label="Bold"/>
            <MiniToggle active={layer.align === "left"}   onClick={() => onChange({ align: "left"   })} label="L"/>
            <MiniToggle active={layer.align === "center"} onClick={() => onChange({ align: "center" })} label="C"/>
            <MiniToggle active={layer.align === "right"}  onClick={() => onChange({ align: "right"  })} label="R"/>
          </div>
          <label className="text-[10px] font-black uppercase text-neutral-500">
            Colour
            <input type="color" value={layer.color} onChange={(e) => onChange({ color: e.target.value })} className="mt-1 h-7 w-full"/>
          </label>

          {/* Font family picker — curated list from fonts.ts. All
              families are already loaded via the app's layout so
              switching is free. */}
          <label className="text-[10px] font-black uppercase text-neutral-500">
            Font
            <select
              value={layer.fontFamily}
              onChange={(e) => onChange({ fontFamily: e.target.value })}
              className="mt-1 w-full rounded-md border px-2 py-1.5 text-[12px]"
              style={{ borderColor: "rgba(139,69,19,0.15)" }}
            >
              {FONT_CATALOGUE.map((f) => (
                <option key={f.slug} value={f.slug} style={{ fontFamily: f.cssFamily }}>{f.label}</option>
              ))}
            </select>
          </label>

          {/* Text effects — three orthogonal toggles + expanders.
              Shadow ships enabled by default (see addText); outline
              + highlight are opt-in. */}
          <div className="mt-1 border-t pt-2 text-[10px] font-black uppercase tracking-wider text-neutral-500" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
            Effects
          </div>
          <div className="flex flex-col gap-2">
            <EffectToggle
              label="Shadow"
              on={Boolean(layer.effects?.shadow)}
              onToggle={(next) => onChange({ effects: { ...(layer.effects ?? {}), shadow: next ? { color: "rgba(0,0,0,0.6)", blur: 4, offsetX: 0, offsetY: 2 } : undefined } })}
            >
              {layer.effects?.shadow && (
                <div className="flex flex-col gap-1 pl-2 pt-1">
                  <label className="text-[9px] font-black uppercase text-neutral-500">
                    Blur ({layer.effects.shadow.blur}px)
                    <input type="range" min={0} max={20} value={layer.effects.shadow.blur} onChange={(e) => onChange({ effects: { ...layer.effects, shadow: { ...layer.effects!.shadow!, blur: Number(e.target.value) } } })} className="mt-0.5 w-full"/>
                  </label>
                  <label className="text-[9px] font-black uppercase text-neutral-500">
                    Offset Y ({layer.effects.shadow.offsetY}px)
                    <input type="range" min={-10} max={10} value={layer.effects.shadow.offsetY} onChange={(e) => onChange({ effects: { ...layer.effects, shadow: { ...layer.effects!.shadow!, offsetY: Number(e.target.value) } } })} className="mt-0.5 w-full"/>
                  </label>
                </div>
              )}
            </EffectToggle>
            <EffectToggle
              label="Outline"
              on={Boolean(layer.effects?.outline)}
              onToggle={(next) => onChange({ effects: { ...(layer.effects ?? {}), outline: next ? { color: "#000000", width: 2 } : undefined } })}
            >
              {layer.effects?.outline && (
                <div className="flex flex-col gap-1 pl-2 pt-1">
                  <label className="text-[9px] font-black uppercase text-neutral-500">
                    Colour
                    <input type="color" value={layer.effects.outline.color} onChange={(e) => onChange({ effects: { ...layer.effects, outline: { ...layer.effects!.outline!, color: e.target.value } } })} className="mt-0.5 h-6 w-full"/>
                  </label>
                  <label className="text-[9px] font-black uppercase text-neutral-500">
                    Width ({layer.effects.outline.width}px)
                    <input type="range" min={1} max={8} value={layer.effects.outline.width} onChange={(e) => onChange({ effects: { ...layer.effects, outline: { ...layer.effects!.outline!, width: Number(e.target.value) } } })} className="mt-0.5 w-full"/>
                  </label>
                </div>
              )}
            </EffectToggle>
            <EffectToggle
              label="Highlight"
              on={Boolean(layer.effects?.highlight)}
              onToggle={(next) => onChange({ effects: { ...(layer.effects ?? {}), highlight: next ? { color: "#FFB300", padding: 8 } : undefined } })}
            >
              {layer.effects?.highlight && (
                <div className="flex flex-col gap-1 pl-2 pt-1">
                  <label className="text-[9px] font-black uppercase text-neutral-500">
                    Colour
                    <input type="color" value={layer.effects.highlight.color} onChange={(e) => onChange({ effects: { ...layer.effects, highlight: { ...layer.effects!.highlight!, color: e.target.value } } })} className="mt-0.5 h-6 w-full"/>
                  </label>
                  <label className="text-[9px] font-black uppercase text-neutral-500">
                    Padding ({layer.effects.highlight.padding}px)
                    <input type="range" min={0} max={30} value={layer.effects.highlight.padding} onChange={(e) => onChange({ effects: { ...layer.effects, highlight: { ...layer.effects!.highlight!, padding: Number(e.target.value) } } })} className="mt-0.5 w-full"/>
                  </label>
                </div>
              )}
            </EffectToggle>
          </div>
          </>
          )}
        </>
      )}

      {layer.kind === "shape" && (
        <>
          {/* Fill — transparent toggle collapses the colour picker
              when the merchant wants an outline-only shape (badge
              style, letting the background image show through). */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-neutral-500">Fill</span>
            <label className="flex cursor-pointer items-center gap-1 text-[9px] font-black uppercase tracking-wider text-neutral-500">
              <input
                type="checkbox"
                checked={layer.fill === null}
                onChange={(e) => onChange({ fill: e.target.checked ? null : (layer.stroke ?? "#FFB300") } as Partial<EditorLayer>)}
                className="h-3 w-3 accent-neutral-900"
              />
              Transparent
            </label>
          </div>
          {layer.fill !== null && (
            <input type="color" value={layer.fill} onChange={(e) => onChange({ fill: e.target.value } as Partial<EditorLayer>)} className="h-7 w-full"/>
          )}

          {/* Stroke — colour + width. Setting stroke to null via the
              Border toggle removes it entirely (Konva reads undefined
              as no stroke). */}
          <div className="mt-1 flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-neutral-500">Border</span>
            <label className="flex cursor-pointer items-center gap-1 text-[9px] font-black uppercase tracking-wider text-neutral-500">
              <input
                type="checkbox"
                checked={layer.stroke !== null}
                onChange={(e) => onChange({ stroke: e.target.checked ? "#0A0A0A" : null, strokeWidth: e.target.checked ? Math.max(2, layer.strokeWidth || 2) : 0 } as Partial<EditorLayer>)}
                className="h-3 w-3 accent-neutral-900"
              />
              On
            </label>
          </div>
          {layer.stroke !== null && (
            <>
              <input type="color" value={layer.stroke} onChange={(e) => onChange({ stroke: e.target.value } as Partial<EditorLayer>)} className="h-7 w-full"/>
              <label className="text-[9px] font-black uppercase text-neutral-500">
                Border width ({layer.strokeWidth}px)
                <input
                  type="range" min={1} max={16} value={layer.strokeWidth || 1}
                  onChange={(e) => onChange({ strokeWidth: Number(e.target.value) } as Partial<EditorLayer>)}
                  className="mt-1 w-full"
                />
              </label>
            </>
          )}

          <label className="text-[10px] font-black uppercase text-neutral-500">
            Opacity
            <input
              type="range" min={0} max={100} value={Math.round(layer.opacity * 100)}
              onChange={(e) => onChange({ opacity: Number(e.target.value) / 100 })}
              className="mt-1 w-full"
            />
          </label>
        </>
      )}

      <label className="text-[10px] font-black uppercase text-neutral-500">
        Rotation
        <input
          type="range" min={0} max={360} value={Math.round(layer.rotation)}
          onChange={(e) => onChange({ rotation: Number(e.target.value) })}
          className="mt-1 w-full"
        />
      </label>

      {/* Animation timing — only meaningful when the base is a video.
          The timeline strip under the canvas is the visual editor;
          these sliders provide fine-grained control. */}
      {layer.animation && (
        <>
          <div className="mt-1 border-t pt-2 text-[10px] font-black uppercase tracking-wider text-neutral-500" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
            Animation
          </div>
          <label className="text-[10px] font-black uppercase text-neutral-500">
            Fade in ({layer.animation.fadeInSec.toFixed(1)}s)
            <input
              type="range" min={0} max={3} step={0.1} value={layer.animation.fadeInSec}
              onChange={(e) => onChange({ animation: { ...layer.animation!, fadeInSec: Number(e.target.value) } })}
              className="mt-1 w-full"
            />
          </label>
          <label className="text-[10px] font-black uppercase text-neutral-500">
            Fade out ({layer.animation.fadeOutSec.toFixed(1)}s)
            <input
              type="range" min={0} max={3} step={0.1} value={layer.animation.fadeOutSec}
              onChange={(e) => onChange({ animation: { ...layer.animation!, fadeOutSec: Number(e.target.value) } })}
              className="mt-1 w-full"
            />
          </label>
        </>
      )}
      </div>
    </div>
  );
}

function IconBtn({ children, title, onClick }: { children: React.ReactNode; title: string; onClick: () => void }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="flex h-6 w-6 items-center justify-center rounded-md text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900"
    >
      {children}
    </button>
  );
}

/** Effect toggle row — checkbox-style header + optional expander
 *  below with fine controls (blur / offset / colour / width etc). */
function EffectToggle({ label, on, onToggle, children }: {
  label:    string;
  on:       boolean;
  onToggle: (next: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-md border p-1.5" style={{ borderColor: on ? "#166534" : "rgba(139,69,19,0.12)", backgroundColor: on ? "#E7F5EC" : "transparent" }}>
      <button
        type="button"
        onClick={() => onToggle(!on)}
        className="flex w-full items-center justify-between text-[10px] font-black uppercase tracking-wider"
        style={{ color: BRAND_BLACK }}
      >
        <span>{label}</span>
        <span
          className="relative inline-flex h-4 w-8 items-center rounded-full transition"
          style={{ backgroundColor: on ? "#166534" : "#D4D4D4" }}
        >
          <span
            className="absolute h-3 w-3 rounded-full bg-white transition-all"
            style={{ left: on ? "calc(100% - 14px)" : "2px", boxShadow: "0 1px 2px rgba(0,0,0,0.3)" }}
          />
        </span>
      </button>
      {on && children}
    </div>
  );
}

function MiniToggle({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-7 items-center rounded-md px-2 text-[10px] font-black uppercase tracking-wider transition"
      style={{
        backgroundColor: active ? BRAND_BLACK : CREAM,
        color:           active ? BRAND_YELLOW : "#333",
        border:          "1px solid rgba(139,69,19,0.12)"
      }}
    >
      {label}
    </button>
  );
}

function ActionBar({
  paid,
  busy,
  onSave,
  onExport,
  onShareCanteen,
  shareMenuOpen,
  onToggleShareMenu,
  onAutoPost,
  onManageLinks
}: {
  paid:              boolean;
  busy:              "none" | "export" | "save" | "share" | "ai";
  onSave:            () => void;
  onExport:          () => void;
  onShareCanteen:    () => void;
  shareMenuOpen:     boolean;
  onToggleShareMenu: () => void;
  onAutoPost:        (network: "instagram" | "facebook" | "tiktok" | "snapchat") => void;
  onManageLinks:     () => void;
}) {
  return (
    <div className="relative mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border p-2" style={{ backgroundColor: BRAND_BLACK, borderColor: BRAND_BLACK }}>
      <div className="flex items-center gap-2">
        <div
          className="inline-flex h-6 items-center rounded-full px-2 text-[10px] font-black uppercase tracking-wider"
          style={{
            backgroundColor: paid ? BRAND_YELLOW : "#3f3f3f",
            color:           paid ? BRAND_BLACK  : "white"
          }}
        >
          {paid ? "Clean export" : "Free — watermarked"}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <BarBtn onClick={onSave}          busy={busy === "save"}   icon={<Save size={12}/>}     label="Save"/>
        <BarBtn onClick={onExport}        busy={busy === "export"} icon={<Download size={12}/>} label="Download"/>
        <BarBtn onClick={onShareCanteen}  busy={busy === "share"}  icon={<Send size={12}/>}     label="Canteen"/>
        <div className="relative">
          <BarBtn onClick={onToggleShareMenu} busy={false} icon={<Send size={12}/>} label="Auto-post"/>
          {shareMenuOpen && (
            <div className="absolute right-0 top-full z-10 mt-1 flex flex-col gap-1 rounded-lg border bg-white p-1 shadow-xl" style={{ borderColor: "rgba(139,69,19,0.15)" }}>
              {(["instagram", "facebook", "tiktok", "snapchat"] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => onAutoPost(n)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-[10.5px] font-black uppercase tracking-wider text-neutral-800 hover:bg-neutral-100"
                >
                  {n}
                </button>
              ))}
              <div className="my-1 border-t" style={{ borderColor: "rgba(139,69,19,0.10)" }}/>
              <button
                type="button"
                onClick={onManageLinks}
                className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-[10.5px] font-black uppercase tracking-wider text-neutral-500 hover:bg-neutral-100"
              >
                Manage links…
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Change bottom-sheet — three mutually-exclusive toggle switches
 *  (Image · Video · Before/After). Any tap fires the parent handler
 *  AND schedules a 5-second auto-close so the merchant sees the
 *  toggle confirm + has room to review before it dismisses. Tapping
 *  again during the countdown reschedules to +5s. */
type EditorTemplate = {
  id:                 string;
  slug:               string;
  label:              string;
  category:           string;
  frame_slug:         string;
  state:              unknown;
  thumbnail_url:      string | null;
  /** Sibling group — when set, this template is one member of a
   *  multi-frame authored set (same design, different aspects). The
   *  TemplatesDrawer collapses siblings into one card + auto-adopts
   *  the sibling matching the merchant's current frame on tap. */
  sibling_group_slug?: string | null;
  /** WYSIWYG preview metadata — the drawer tile composites this into
   *  a live preview (real photo + scrim + text) so merchants see
   *  exactly what they'll land with. Populated by showcase templates;
   *  DB templates fall back to thumbnail_url. */
  preview?: {
    imageUrl:    string;
    headline:    string;
    subline?:    string;
    textColor?:  string;
    accentColor?: string;
    scrim?:      "bottom" | "top" | "full" | "left";
  };
  /** Semantic template content used by the frame-aware resolver
   *  (frameLayout.ts). Present on showcase templates; DB templates
   *  can add it later. When present, the pick handler resolves the
   *  template against the CURRENT frame — guaranteeing text lands
   *  inside the frame's safe zone. */
  content?:           TemplateContent;
  /** Background image URL applied as the base slot. Paired with
   *  `content` for the resolver path. */
  imageUrl?:          string;
  /** Crown banner — premium content with all design/text burned
   *  into the source PNG. Only the phone-slot is editable. Rendered
   *  with a gold Crown badge on the drawer tile. */
  isCrown?:           boolean;
  /** Trade-slug allowlist. When set the template only appears in
   *  the drawer for merchants whose primary trade matches. Empty
   *  or undefined = visible to every trade. */
  tradeSlugs?:        string[];
  /** Pre-calibrated phone-slot position (1080-scale) for crown
   *  banners. See ShowcaseTemplate type for full docs. Legacy
   *  single-slot path — new crown banners with 1 or 2 slots use
   *  editSlots below. */
  phoneSlot?: {
    x:        number;
    y:        number;
    width:    number;
    fontSize: number;
    placeholder?: string;
    color?:   string;
  };
  /** Multi-slot metadata — an array of edit slots. Used when a
   *  crown banner has more than one editable field (e.g. a "WAS
   *  £249 / NOW ONLY £179" pricing pair). Each slot is dropped
   *  onto the canvas as its own Konva text layer at pick time.
   *  Pick handler prefers editSlots when set, falls back to
   *  phoneSlot otherwise. */
  editSlots?: Array<{
    id:       string;
    kind?:    "phone" | "price" | "text";
    x:        number;
    y:        number;
    width:    number;
    fontSize: number;
    placeholder?: string;
    color?:   string;
  }>;
};

function ChangeSheet({
  currentMode, currentMedia, onImage, onVideo, onBeforeAfter, onPickTemplate, onClose
}: {
  currentMode:    "single" | "beforeAfter";
  currentMedia:   "image" | "video";
  onImage:        () => void;
  onVideo:        () => void;
  onBeforeAfter:  () => void;
  onPickTemplate: (tpl: EditorTemplate) => void;
  onClose:        () => void;
}) {
  const closeTimerRef = useRef<number | null>(null);
  const scheduleClose = useCallback(() => {
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(onClose, 5000);
  }, [onClose]);
  useEffect(() => () => {
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
  }, []);
  // Templates — lazy-load once on open. Kept in local state so re-
  // opening the sheet is instant after the first fetch.
  const [templates, setTemplates] = useState<EditorTemplate[] | null>(null);
  useEffect(() => {
    if (templates !== null) return;
    (async () => {
      try {
        const res = await fetch("/api/site/editor/templates");
        const data = await res.json().catch(() => ({} as { templates?: EditorTemplate[] }));
        setTemplates(data.templates ?? []);
      } catch { setTemplates([]); }
    })();
  }, [templates]);

  // Live "on" state per toggle — driven by INTENT (mediaChoice +
  // mode), not by whether the upload has completed. Tapping Video
  // flips the mediaChoice to "video" immediately, so the Video
  // toggle switches on and Image switches off before the file
  // picker has even returned. Before/After is orthogonal to the
  // image/video choice — its toggle reads mode directly.
  const imageOn       = currentMode === "single" && currentMedia === "image";
  const videoOn       = currentMode === "single" && currentMedia === "video";
  const beforeAfterOn = currentMode === "beforeAfter";

  const handle = (fn: () => void) => () => { fn(); scheduleClose(); };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center"
      style={{ backgroundColor: "rgba(10,10,10,0.55)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Change composition"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg overflow-hidden rounded-t-3xl bg-white shadow-2xl"
        style={{
          border:        `2px solid ${BRAND_YELLOW}`,
          borderBottom:  "none",
          animation:     "slideUp 220ms ease-out",
          paddingBottom: "env(safe-area-inset-bottom, 0px)"
        }}
      >
        {/* Grab handle */}
        <div className="flex justify-center pt-2">
          <div className="h-1 w-10 rounded-full" style={{ backgroundColor: BRAND_YELLOW }}/>
        </div>

        <div className="flex items-center justify-between px-4 pt-2">
          <div className="text-[11px] font-black uppercase tracking-[0.16em] text-neutral-800">Change</div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-[10px] font-black uppercase tracking-wider text-neutral-500 hover:underline"
          >
            Close
          </button>
        </div>

        <div className="flex flex-col gap-2 px-4 pt-3 pb-4">
          <ChangeToggle
            label="Image"
            icon={<ImageIcon size={16} strokeWidth={2.4}/>}
            on={imageOn}
            onTap={handle(onImage)}
          />
          <ChangeToggle
            label="Video"
            icon={<VideoIcon size={16} strokeWidth={2.4}/>}
            on={videoOn}
            onTap={handle(onVideo)}
          />
          <ChangeToggle
            label="Before / After"
            icon={<Layers size={16} strokeWidth={2.4}/>}
            on={beforeAfterOn}
            onTap={handle(onBeforeAfter)}
          />
          <p className="pt-1 text-[10px] text-neutral-500">
            {beforeAfterOn
              ? "Tap the empty halves on the canvas to upload Before + After."
              : "Sheet closes in 5s after selection · tap again to keep it open."}
          </p>

          {/* Templates — curated starter compositions. Tapping any
              REPLACES the current editor state with the template's
              base + layers + frame. Auto-closes the sheet on pick. */}
          {templates && templates.length > 0 && (
            <div className="mt-2 border-t pt-3" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
              <div className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-neutral-500">
                Templates <span className="text-neutral-400">· tap to load</span>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {templates.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => { onPickTemplate(tpl); }}
                    className="flex flex-col items-center rounded-md border p-2 text-center transition hover:brightness-95"
                    style={{ borderColor: "rgba(139,69,19,0.15)", backgroundColor: CREAM }}
                  >
                    <div className="mb-1 flex h-16 w-full items-center justify-center rounded-md" style={{ backgroundColor: "#111", color: BRAND_YELLOW }}>
                      {tpl.thumbnail_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={tpl.thumbnail_url} alt="" className="h-full w-full rounded-md object-cover"/>
                      ) : (
                        <span className="text-[9px] font-black uppercase tracking-wider">{tpl.category}</span>
                      )}
                    </div>
                    <span className="line-clamp-2 text-[10px] font-black uppercase tracking-wider text-neutral-800">
                      {tpl.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Individual switch row — icon + label on the left, iOS-style
 *  toggle on the right. Green when on, grey when off. */
function ChangeToggle({ label, icon, on, onTap }: { label: string; icon: React.ReactNode; on: boolean; onTap: () => void }) {
  return (
    <button
      type="button"
      onClick={onTap}
      className="flex h-14 w-full items-center justify-between rounded-lg px-3 transition hover:brightness-95"
      style={{
        backgroundColor: on ? "#E7F5EC" : "#F1EBDF",
        border:          `1.5px solid ${on ? "#166534" : "rgba(139,69,19,0.15)"}`
      }}
    >
      <span className="flex items-center gap-2.5 text-[12px] font-black uppercase tracking-wider" style={{ color: BRAND_BLACK }}>
        <span
          className="flex h-8 w-8 items-center justify-center rounded-md"
          style={{
            backgroundColor: on ? "#166534" : "white",
            color:           on ? BRAND_YELLOW : BRAND_BLACK
          }}
        >
          {icon}
        </span>
        {label}
      </span>
      <span
        className="relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition"
        style={{ backgroundColor: on ? "#166534" : "#D4D4D4" }}
      >
        <span
          className="absolute h-6 w-6 rounded-full bg-white transition-all"
          style={{
            left:      on ? "calc(100% - 26px)" : "2px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.3)"
          }}
        />
      </span>
    </button>
  );
}

/** Frame-aware caption hint — a one-line nudge under the caption
 *  textarea that tells the merchant what actually works on the frame
 *  they picked. Based on the caption-behaviour audit (Story captions
 *  rarely read, Reels need a hook, Feed rewards length + hashtags). */
function captionGuideFor(frameSlug: string): string {
  if (frameSlug.endsWith("-story")) return "Story captions rarely get read — use the Text tool on the image.";
  if (frameSlug === "ig-reel" || frameSlug === "tt-video-cover" || frameSlug === "tt-photo" || frameSlug === "snap-spot") {
    return "Hook in the first 90 chars, then hashtags.";
  }
  if (frameSlug === "ig-feed" || frameSlug === "ig-portrait") {
    return "100–300 chars with a question at the end drives replies. 5–8 hashtags.";
  }
  if (frameSlug === "fb-feed" || frameSlug === "fb-square") {
    return "Conversational, one CTA question. Hashtags don't help on Facebook.";
  }
  if (frameSlug === "canteen-post") {
    return "Trades read your caption on the Canteen wall — a real update outperforms a slogan.";
  }
  return "Punchy first line, one call-to-action at the end.";
}

/** Format seconds → MM:SS.d for scrubber label. */
function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Video playback + trim scrubber. Play/pause on left, current-time
 *  chip, then a dual-handle trim bar with the play head marker.
 *  Mobile-first: 44px play button, full-width scrubber, sticky handles. */
function VideoControls({
  videoTime, duration, trimFrom, trimTo, isPlaying, onTogglePlay, onSeek, onTrim
}: {
  videoTime:     number;
  duration:      number;
  trimFrom:      number;
  trimTo:        number;
  isPlaying:     boolean;
  onTogglePlay:  () => void;
  onSeek:        (sec: number) => void;
  onTrim:        (from: number, to: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);

  const pct = (t: number) => duration > 0 ? Math.max(0, Math.min(100, (t / duration) * 100)) : 0;

  // Drag handler shared by playhead + trim handles. Returns the
  // seconds under the pointer.
  const secAt = (clientX: number): number => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return 0;
    const frac = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return frac * duration;
  };

  const dragHandle = (kind: "from" | "to" | "head") => (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const onMove = (ev: PointerEvent) => {
      const sec = secAt(ev.clientX);
      if (kind === "from") onTrim(Math.min(sec, trimTo - 0.2), trimTo);
      else if (kind === "to") onTrim(trimFrom, Math.max(sec, trimFrom + 0.2));
      else onSeek(sec);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup",   onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup",   onUp);
  };

  return (
    <div className="flex w-full items-center gap-2 rounded-xl border p-2" style={{ backgroundColor: "white", borderColor: "rgba(139,69,19,0.15)" }}>
      <button
        type="button"
        onClick={onTogglePlay}
        aria-label={isPlaying ? "Pause" : "Play"}
        className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full transition hover:brightness-95"
        style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}
      >
        {isPlaying ? <Pause size={18} strokeWidth={2.4}/> : <Play size={18} strokeWidth={2.4} className="ml-0.5"/>}
      </button>
      <div className="min-w-[60px] whitespace-nowrap text-[11px] font-black tracking-wider text-neutral-700">
        {formatTime(videoTime)}<span className="text-neutral-400"> / {formatTime(duration)}</span>
      </div>
      <div
        ref={trackRef}
        className="relative h-8 flex-1 select-none rounded-md"
        style={{ backgroundColor: "#F1EBDF" }}
      >
        {/* Trim highlight strip */}
        <div
          className="absolute top-0 h-full rounded-md"
          style={{
            left:            `${pct(trimFrom)}%`,
            width:           `${pct(trimTo) - pct(trimFrom)}%`,
            backgroundColor: "rgba(255,179,0,0.4)",
            border:          "1px solid rgba(255,179,0,0.8)"
          }}
        />
        {/* Trim FROM handle */}
        <div
          onPointerDown={dragHandle("from")}
          className="absolute top-0 h-full w-3 -translate-x-1/2 cursor-ew-resize rounded-sm"
          style={{ left: `${pct(trimFrom)}%`, backgroundColor: BRAND_YELLOW, border: `2px solid ${BRAND_BLACK}` }}
          aria-label="Trim start"
        />
        {/* Trim TO handle */}
        <div
          onPointerDown={dragHandle("to")}
          className="absolute top-0 h-full w-3 -translate-x-1/2 cursor-ew-resize rounded-sm"
          style={{ left: `${pct(trimTo)}%`, backgroundColor: BRAND_YELLOW, border: `2px solid ${BRAND_BLACK}` }}
          aria-label="Trim end"
        />
        {/* Play head */}
        <div
          onPointerDown={dragHandle("head")}
          className="absolute -top-0.5 h-9 w-1 -translate-x-1/2 cursor-ew-resize rounded-full"
          style={{ left: `${pct(videoTime)}%`, backgroundColor: "#166534", boxShadow: "0 0 4px rgba(22,101,52,0.6)" }}
          aria-label="Playhead"
        />
      </div>
    </div>
  );
}

/** Layer-timeline strip — one horizontal row per layer showing its
 *  active range as a yellow bar. Drag either edge to change enter /
 *  exit times. Playhead position tracks video playback. Mobile-first:
 *  compact 24px rows so many layers fit without vertical bloat. */
function LayerTimeline({
  layers, duration, trimFrom, trimTo, videoTime, selectedLayerId, onSelect, onUpdateAnimation
}: {
  layers:            EditorLayer[];
  duration:          number;
  trimFrom:          number;
  trimTo:            number;
  videoTime:         number;
  selectedLayerId:   string | null;
  onSelect:          (id: string | null) => void;
  onUpdateAnimation: (id: string, patch: Partial<{ enterAtSec: number; exitAtSec: number; fadeInSec: number; fadeOutSec: number }>) => void;
}) {
  const trackWidth = trimTo - trimFrom;
  const pct = (t: number) => trackWidth > 0 ? Math.max(0, Math.min(100, ((t - trimFrom) / trackWidth) * 100)) : 0;

  const clampToTrim = (t: number) => Math.max(trimFrom, Math.min(trimTo, t));

  return (
    <div className="flex w-full flex-col gap-1.5 rounded-xl border p-2" style={{ backgroundColor: "white", borderColor: "rgba(139,69,19,0.15)" }}>
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-500">Timeline</div>
        <div className="text-[10px] font-black tracking-wider text-neutral-500">
          {formatTime(videoTime)}<span className="text-neutral-400"> / {formatTime(duration)}</span>
        </div>
      </div>
      <div className="relative flex flex-col gap-1">
        {/* Playhead line spans all rows */}
        <div
          className="pointer-events-none absolute top-0 bottom-0 z-10 w-0.5"
          style={{ left: `${pct(videoTime)}%`, backgroundColor: "#166534", boxShadow: "0 0 4px rgba(22,101,52,0.6)" }}
        />
        {layers.map((layer) => {
          const isSelected = selectedLayerId === layer.id;
          const anim = layer.animation ?? { enterAtSec: trimFrom, exitAtSec: trimTo, fadeInSec: 0, fadeOutSec: 0 };
          const trackRef: React.RefObject<HTMLDivElement | null> = { current: null };
          const secAt = (clientX: number): number => {
            const rect = trackRef.current?.getBoundingClientRect();
            if (!rect || rect.width === 0) return trimFrom;
            const frac = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
            return trimFrom + frac * trackWidth;
          };
          const drag = (kind: "enter" | "exit" | "bar") => (e: React.PointerEvent<HTMLDivElement>) => {
            e.preventDefault();
            e.stopPropagation();
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
            const startX     = e.clientX;
            const startEnter = anim.enterAtSec;
            const startExit  = anim.exitAtSec;
            const onMove = (ev: PointerEvent) => {
              if (kind === "enter") {
                const sec = clampToTrim(secAt(ev.clientX));
                onUpdateAnimation(layer.id, { enterAtSec: Math.min(sec, anim.exitAtSec - 0.2) });
              } else if (kind === "exit") {
                const sec = clampToTrim(secAt(ev.clientX));
                onUpdateAnimation(layer.id, { exitAtSec: Math.max(sec, anim.enterAtSec + 0.2) });
              } else {
                const dx = ev.clientX - startX;
                const dSec = (dx / (trackRef.current?.getBoundingClientRect().width ?? 1)) * trackWidth;
                const newEnter = clampToTrim(startEnter + dSec);
                const newExit  = clampToTrim(startExit  + dSec);
                if (newEnter >= trimFrom && newExit <= trimTo && newExit > newEnter) {
                  onUpdateAnimation(layer.id, { enterAtSec: newEnter, exitAtSec: newExit });
                }
              }
            };
            const onUp = () => {
              window.removeEventListener("pointermove", onMove);
              window.removeEventListener("pointerup",   onUp);
            };
            window.addEventListener("pointermove", onMove);
            window.addEventListener("pointerup",   onUp);
          };
          return (
            <div key={layer.id} className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onSelect(isSelected ? null : layer.id)}
                className="flex-shrink-0 text-[9px] font-black uppercase tracking-wider transition"
                style={{ color: isSelected ? BRAND_BLACK : "#666", width: 56, textAlign: "left" }}
                title={layer.kind}
              >
                {layer.kind.slice(0, 8)}
              </button>
              <div
                ref={(el) => { trackRef.current = el; }}
                className="relative h-6 flex-1 rounded"
                style={{ backgroundColor: "#F1EBDF" }}
              >
                <div
                  onPointerDown={drag("bar")}
                  className="absolute top-0 h-full cursor-move rounded"
                  style={{
                    left:            `${pct(anim.enterAtSec)}%`,
                    width:           `${pct(anim.exitAtSec) - pct(anim.enterAtSec)}%`,
                    backgroundColor: isSelected ? "#166534" : "rgba(255,179,0,0.7)",
                    border:          `1.5px solid ${isSelected ? "#166534" : "#D18C00"}`,
                    boxShadow:       isSelected ? "0 2px 4px rgba(22,101,52,0.3)" : "none"
                  }}
                >
                  {/* Fade-in gradient ghost */}
                  {anim.fadeInSec > 0 && (
                    <div
                      className="pointer-events-none absolute top-0 left-0 h-full"
                      style={{
                        width:      `${(anim.fadeInSec / (anim.exitAtSec - anim.enterAtSec)) * 100}%`,
                        background: "linear-gradient(to right, rgba(255,255,255,0.6), transparent)"
                      }}
                    />
                  )}
                  {/* Fade-out gradient ghost */}
                  {anim.fadeOutSec > 0 && (
                    <div
                      className="pointer-events-none absolute top-0 right-0 h-full"
                      style={{
                        width:      `${(anim.fadeOutSec / (anim.exitAtSec - anim.enterAtSec)) * 100}%`,
                        background: "linear-gradient(to left, rgba(255,255,255,0.6), transparent)"
                      }}
                    />
                  )}
                </div>
                {/* Enter handle */}
                <div
                  onPointerDown={drag("enter")}
                  className="absolute top-0 h-full w-2 -translate-x-1/2 cursor-ew-resize"
                  style={{ left: `${pct(anim.enterAtSec)}%`, backgroundColor: BRAND_BLACK, borderRadius: 1 }}
                />
                {/* Exit handle */}
                <div
                  onPointerDown={drag("exit")}
                  className="absolute top-0 h-full w-2 -translate-x-1/2 cursor-ew-resize"
                  style={{ left: `${pct(anim.exitAtSec)}%`, backgroundColor: BRAND_BLACK, borderRadius: 1 }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BarBtn({ onClick, busy, icon, label }: { onClick: () => void; busy: boolean; icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[11px] font-black uppercase tracking-wider disabled:opacity-60"
      style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}
    >
      {busy ? <Loader2 size={12} className="animate-spin"/> : icon}
      {label}
    </button>
  );
}

