"use client";

// StudioReplaceModal — swap the current section's registration for a
// different variant from the same library.
//
// Opened by the mirror when tool-action arrives with tool="replace-
// layout". Lists every registered section in the same library as the
// current one, previewed via each registration's own renderer. Click
// a card → the mirror calls swap() which mutates history + fires
// telemetry + closes the modal.

import { useEffect } from "react";
import "@/lib/studio/sections"; // populates registry
import { sectionRegistry } from "@/lib/studio/sectionRegistry";
import type { AnySectionRegistration } from "@/lib/studio/sectionTypes";
import { DEFAULT_TOKENS } from "@/lib/studio/tokens";

const YELLOW = "#FFB300";

type Props = {
  currentSectionId: string;
  currentInstanceId: string;
  merchantSlug: string;
  onSwap: (nextRegistrationId: string) => void;
  onClose: () => void;
};

export function StudioReplaceModal({
  currentSectionId,
  currentInstanceId,
  merchantSlug,
  onSwap,
  onClose
}: Props) {
  const current = sectionRegistry.get(currentSectionId);
  const library = current?.library ?? "hero";
  const candidates = sectionRegistry
    .list(library)
    .filter((r) => r.id !== currentSectionId);

  // Escape closes.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Replace section"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center gap-4 border-b border-neutral-200 p-5">
          <div className="min-w-0 flex-1">
            <p
              className="text-[10px] font-extrabold uppercase tracking-widest"
              style={{ color: YELLOW }}
            >
              Replace section
            </p>
            <h2 className="mt-1 text-[18px] font-extrabold text-neutral-900">
              Pick a {prettyLibrary(library)} layout
            </h2>
            <p className="mt-1 text-[12px] text-neutral-500">
              Currently:{" "}
              <code className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[11px]">
                {currentSectionId}
              </code>{" "}
              on instance{" "}
              <code className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[11px]">
                {currentInstanceId}
              </code>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 place-items-center rounded-full text-[15px] font-extrabold text-neutral-500 transition hover:bg-neutral-100"
          >
            ✕
          </button>
        </header>

        <div className="max-h-[70vh] overflow-y-auto p-5">
          {candidates.length === 0 ? (
            <p className="py-12 text-center text-[13px] text-neutral-500">
              No other {prettyLibrary(library)} layouts registered yet —
              more variants ship with later modules.
            </p>
          ) : (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {candidates.map((r) => (
                <li key={r.id}>
                  <ReplaceCard
                    reg={r}
                    merchantSlug={merchantSlug}
                    onPick={() => onSwap(r.id)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function ReplaceCard({
  reg,
  merchantSlug,
  onPick
}: {
  reg: AnySectionRegistration;
  merchantSlug: string;
  onPick: () => void;
}) {
  const Renderer = reg.renderer;
  const defaults = reg.defaultConfig();
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
    <button
      type="button"
      onClick={onPick}
      className="group flex w-full flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white text-left transition hover:border-neutral-500 hover:shadow-md"
    >
      <div className="relative h-40 w-full overflow-hidden bg-neutral-100">
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "400%",
            height: "400%",
            transform: "scale(0.25)",
            transformOrigin: "top left",
            pointerEvents: "none"
          }}
        >
          <Renderer
            instanceId="preview"
            config={defaults}
            tokens={DEFAULT_TOKENS}
            data={data}
            mode="preview"
          />
        </div>
      </div>
      <div className="p-3">
        <p className="text-[13px] font-extrabold text-neutral-900">
          {reg.name}
        </p>
        <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-neutral-600">
          {reg.description}
        </p>
        <p
          className="mt-2 text-[10px] font-extrabold uppercase tracking-widest transition group-hover:text-neutral-900"
          style={{ color: "#737373" }}
        >
          Use this →
        </p>
      </div>
    </button>
  );
}

function prettyLibrary(lib: string): string {
  return lib === "hero" ? "hero" : lib.replace(/_/g, " ");
}
