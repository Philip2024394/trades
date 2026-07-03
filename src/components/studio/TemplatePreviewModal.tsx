"use client";

// TemplatePreviewModal — full-viewport preview of a section registry
// template.
//
// Shows the section rendered at 100% width using merchant-default
// tokens. Bottom bar carries ← Prev / Next → nav to walk the filtered
// list without closing, plus a primary "Use this template" CTA that
// opens the TemplatePagePicker on top of this modal.
//
// ESC / click-backdrop / X button all close.

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_TOKENS } from "@/lib/studio/tokens";
import type { AnySectionRegistration } from "@/lib/studio/sectionTypes";
import { TemplatePagePicker } from "./TemplatePagePicker";
import { StudioErrorBoundary } from "./StudioErrorBoundary";
import { fetchWithRetry } from "@/lib/studio/fetchWithRetry";

const YELLOW = "#FFB300";
const BLACK = "#0A0A0A";

export function TemplatePreviewModal({
  templates,
  activeIndex,
  onChangeIndex,
  onClose,
  merchantSlug,
  pinnedPageId
}: {
  templates: AnySectionRegistration[];
  activeIndex: number;
  onChangeIndex: (nextIndex: number) => void;
  onClose: () => void;
  merchantSlug: string;
  /** When set, "Use this template" skips the page picker and posts
   *  directly against this pageId, then redirects to the editor. Used
   *  by the "Pick your hero" empty-state flow so the merchant lands on
   *  the freshly-populated page in one click. */
  pinnedPageId?: string | null;
}) {
  const router = useRouter();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [directStatus, setDirectStatus] = useState<
    | { kind: "idle" }
    | { kind: "adding" }
    | { kind: "error"; message: string }
  >({ kind: "idle" });
  const active = templates[activeIndex];

  const goPrev = useCallback(() => {
    if (templates.length === 0) return;
    onChangeIndex(
      (activeIndex - 1 + templates.length) % templates.length
    );
  }, [activeIndex, templates.length, onChangeIndex]);

  const goNext = useCallback(() => {
    if (templates.length === 0) return;
    onChangeIndex((activeIndex + 1) % templates.length);
  }, [activeIndex, templates.length, onChangeIndex]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (pickerOpen) return;
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    }
    window.addEventListener("keydown", onKey);
    // Lock scroll while modal is open
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, goPrev, goNext, pickerOpen]);

  if (!active) return null;
  const Renderer = active.renderer;
  const data = {
    merchantId: "preview",
    slug: merchantSlug,
    merchantName: "Your business",
    city: "Your city",
    whatsappHref: null,
    brandName: "Main brand",
    domain: {}
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Preview ${active.name}`}
      className="fixed inset-0 z-[500] flex flex-col bg-neutral-950/98 backdrop-blur-sm"
    >
      {/* Top bar */}
      <header
        className="flex flex-none items-center justify-between gap-4 border-b border-white/10 bg-black/60 px-5 py-3 backdrop-blur-md sm:px-8"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="hidden rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-widest sm:inline-flex"
            style={{ background: YELLOW, color: BLACK }}
          >
            {active.library}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[14px] font-extrabold text-white sm:text-[15px]">
              {active.name}
            </p>
            <p className="mt-0.5 truncate font-mono text-[10px] text-white/45">
              {active.id} · v{active.version}
            </p>
          </div>
        </div>
        <div className="flex flex-none items-center gap-2">
          <span className="hidden text-[11px] font-bold uppercase tracking-widest text-white/40 sm:inline">
            {activeIndex + 1} / {templates.length}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 text-white transition hover:bg-white/10"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
      </header>

      {/* Preview canvas — the actual section, real-size, scrollable */}
      <div
        className="relative flex-1 overflow-y-auto overflow-x-hidden bg-white"
        onClick={(e) => {
          // Click on the backdrop area of the canvas doesn't close —
          // clicking the section renderer itself is the merchant testing
          // behaviour. Only header X / ESC close the modal.
          e.stopPropagation();
        }}
      >
        <StudioErrorBoundary label={`Preview: ${active.id}`}>
          <Renderer
            instanceId="preview"
            config={active.defaultConfig()}
            tokens={DEFAULT_TOKENS}
            data={data}
            mode="preview"
          />
        </StudioErrorBoundary>
      </div>

      {/* Bottom bar */}
      <footer
        className="flex flex-none items-center justify-between gap-3 border-t border-white/10 bg-black/60 px-5 py-3 backdrop-blur-md sm:px-8"
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goPrev}
            aria-label="Previous template"
            className="inline-flex h-11 items-center gap-2 rounded-lg border border-white/20 px-3 text-[11px] font-extrabold uppercase tracking-widest text-white transition hover:bg-white/10 sm:h-10 sm:px-4"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m15 18-6-6 6-6" />
            </svg>
            <span className="hidden sm:inline">Prev</span>
          </button>
          <button
            type="button"
            onClick={goNext}
            aria-label="Next template"
            className="inline-flex h-11 items-center gap-2 rounded-lg border border-white/20 px-3 text-[11px] font-extrabold uppercase tracking-widest text-white transition hover:bg-white/10 sm:h-10 sm:px-4"
          >
            <span className="hidden sm:inline">Next</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        </div>

        <div className="min-w-0 flex-1 text-center">
          <p className="mx-auto max-w-md truncate text-[12px] text-white/70 sm:text-[13px]">
            {active.description}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            if (pinnedPageId) {
              void useDirectlyOnPinnedPage(active.id, pinnedPageId);
            } else {
              setPickerOpen(true);
            }
          }}
          disabled={directStatus.kind === "adding"}
          className="inline-flex h-11 items-center gap-2 rounded-xl px-5 text-[12px] font-extrabold uppercase tracking-widest transition active:scale-[0.98] disabled:opacity-70 sm:h-11 sm:px-6"
          style={{
            background: YELLOW,
            color: BLACK,
            boxShadow: `0 4px 16px ${YELLOW}66`
          }}
        >
          <span>
            {directStatus.kind === "adding"
              ? "Adding…"
              : pinnedPageId
                ? "Use for this page"
                : "Use this template"}
          </span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
      </footer>

      {/* Direct-add error toast (pinned-page shortcut only) */}
      {directStatus.kind === "error" && (
        <div
          role="alert"
          className="pointer-events-none absolute inset-x-0 bottom-24 flex justify-center px-4"
        >
          <div
            className="pointer-events-auto rounded-xl border px-4 py-2 text-[12px] font-bold"
            style={{
              borderColor: "#FCA5A5",
              background: "#FEF2F2",
              color: "#7F1D1D"
            }}
          >
            Couldn&rsquo;t add — {directStatus.message}
          </div>
        </div>
      )}

      {/* Page picker overlay */}
      {pickerOpen && (
        <TemplatePagePicker
          sectionId={active.id}
          sectionName={active.name}
          sectionLibrary={active.library}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );

  async function useDirectlyOnPinnedPage(sectionId: string, pageId: string) {
    setDirectStatus({ kind: "adding" });
    try {
      const res = await fetchWithRetry("/api/studio/templates/use", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectionId, pageId })
      });
      const json = (await res.json()) as
        | { ok: true; instanceId: string; layoutId: string; version: number }
        | { ok: false; error: string };
      if (!res.ok || !json.ok) {
        setDirectStatus({
          kind: "error",
          message: "error" in json ? json.error : `HTTP ${res.status}`
        });
        return;
      }
      router.push(`/studio/pages/${pageId}`);
    } catch (err) {
      setDirectStatus({
        kind: "error",
        message: (err as Error).message ?? "network"
      });
    }
  }
}
