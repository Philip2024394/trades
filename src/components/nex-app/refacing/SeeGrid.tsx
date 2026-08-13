"use client";

// SeeGrid — SEE UI · SEE stage (spec §C).
//
// Fetches directions from GET /directions on mount. Renders:
//   · BASE photo (sticky top on mobile / left column on desktop)
//   · 2-4 direction cards (each = hero image + name + reason + materials +
//     [ See this on my staircase ] CTA)
//   · Save & Share block at the bottom (spec §E.3)
//   · Honest empty state ("we don't have that direction available yet")
//
// When the customer taps a card, the SeeComparison view opens.

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bookmark, Loader2, Share2, Sparkles } from "lucide-react";
import type { RefacingCase } from "@/lib/nex/refacing/case-schema";
import type { SeeDirection } from "@/lib/nex/refacing/retrieval";
import { fetchDirections, saveDirection } from "@/lib/nex/refacing/use-case";

type Props = {
  refacingCase: RefacingCase;
  token: string;
  onOpenComparison: (direction: SeeDirection) => void;
};

export function SeeGrid({ refacingCase, token, onOpenComparison }: Props) {
  const [directions, setDirections] = useState<SeeDirection[] | null>(null);
  const [empty, setEmpty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [savedIndexes, setSavedIndexes] = useState<Set<number>>(new Set());

  const basePhoto = refacingCase.existing_staircase.photos[0];
  const baseSrc = basePhoto
    ? `/api/nex/refacing/cases/${encodeURIComponent(
        refacingCase.refacing_case_id
      )}/photo/${encodeURIComponent(basePhoto.image_id)}?token=${encodeURIComponent(token)}`
    : null;

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const { directions: d, empty: e } = await fetchDirections(
        refacingCase.refacing_case_id,
        token
      );
      setDirections(d);
      setEmpty(e);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [refacingCase.refacing_case_id, token]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave(i: number, d: SeeDirection) {
    try {
      await saveDirection(
        refacingCase.refacing_case_id,
        token,
        d.direction,
        d.suggested_name,
        d.reason_for_existing,
        d.key_materials_description,
        d.reference_image_ids
      );
      setSavedIndexes((prev) => new Set(prev).add(i));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleShareAll() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "My staircase ideas",
          text: "I'm looking at these staircase ideas — which one do you prefer?",
          url,
        });
      } catch {
        // User cancelled · no-op
      }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        // Would trigger a toast · left minimal for MVP
      } catch {
        // Clipboard denied · no-op
      }
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 px-5 py-12">
        <Loader2 size={22} className="animate-spin" style={{ color: "var(--nex-neutral-500, #6b6b6b)" }} />
        <div className="text-[13px]" style={{ color: "var(--nex-neutral-500, #6b6b6b)" }}>
          Preparing some ideas for your staircase…
        </div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="px-5 py-6">
        <div className="rounded-lg px-3 py-2 text-[13px]"
             style={{ background: "#FEECEC", color: "#7A1F1F", border: "1px solid #F1BFBF" }}>
          Something went wrong loading ideas. {err}
        </div>
        <button
          type="button"
          onClick={load}
          className="mt-3 rounded-xl px-4 py-2 text-[13px] font-semibold"
          style={{ background: "var(--nex-neutral-900, #1a1a1a)", color: "var(--nex-cream, #F7F2E8)" }}
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 px-5 pb-8">
      {/* BASE photo · sticky-ish anchor */}
      {baseSrc && (
        <div
          className="sticky top-0 z-10 -mx-5 mb-1 px-5 py-2 backdrop-blur"
          style={{
            background: "rgba(247, 242, 232, 0.9)",
            borderBottom: "1px solid var(--nex-neutral-200, #E7E1D2)",
          }}
        >
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={baseSrc}
              alt="Your staircase"
              className="h-16 w-16 rounded-md object-cover"
            />
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-widest"
                   style={{ color: "var(--nex-accent-500, #8B7355)" }}>
                Your staircase
              </div>
              <div className="text-[13px] font-semibold"
                   style={{ color: "var(--nex-neutral-900, #1a1a1a)" }}>
                Ideas for how it could look
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty state · honest per PR-18/spec §H.2.a */}
      {empty || (directions?.length ?? 0) === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl p-6 text-center"
             style={{
               background: "var(--nex-cream-elev, #FFFFFF)",
               border: "1px solid var(--nex-neutral-200, #E7E1D2)",
             }}>
          <Sparkles size={22} style={{ color: "var(--nex-neutral-500, #6b6b6b)" }} />
          <div className="text-[15px] font-semibold"
               style={{ color: "var(--nex-neutral-900, #1a1a1a)" }}>
            We don&apos;t have a design direction that matches yet
          </div>
          <p className="text-[12px] leading-snug"
             style={{ color: "var(--nex-neutral-500, #6b6b6b)" }}>
            Our library is growing every week. Save what you like and NEX will
            let you know when a match arrives.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <AnimatePresence>
            {directions?.map((d, i) => (
              <motion.div
                key={d.hero_image.image_id + "-" + i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, delay: i * 0.05 }}
                className="overflow-hidden rounded-2xl"
                style={{
                  background: "var(--nex-cream-elev, #FFFFFF)",
                  border: "1px solid var(--nex-neutral-200, #E7E1D2)",
                }}
              >
                {/* Hero image · 16:9 · object-contain (cream backdrop keeps composition honest) */}
                <div className="aspect-video w-full"
                     style={{ background: "var(--nex-cream, #F7F2E8)" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={d.hero_image.src}
                    alt={d.hero_image.alt}
                    className="h-full w-full object-contain"
                  />
                </div>
                <div className="flex flex-col gap-2 p-4">
                  <div className="text-[10px] font-semibold uppercase tracking-widest"
                       style={{ color: "var(--nex-accent-500, #8B7355)" }}>
                    {d.suggested_name.toUpperCase()}
                  </div>
                  <div className="text-[13px]"
                       style={{ color: "var(--nex-neutral-700, #3d3d3d)" }}>
                    {d.reason_for_existing}
                  </div>
                  {d.key_materials_description && (
                    <div className="text-[12px] italic"
                         style={{ color: "var(--nex-neutral-500, #6b6b6b)" }}>
                      {d.key_materials_description}
                    </div>
                  )}
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenComparison(d)}
                      className="flex-1 rounded-xl px-4 py-2 text-[13px] font-semibold transition active:scale-95"
                      style={{
                        background: "var(--nex-neutral-900, #1a1a1a)",
                        color: "var(--nex-cream, #F7F2E8)",
                      }}
                    >
                      See this on my staircase
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSave(i, d)}
                      aria-label="Save this idea"
                      aria-pressed={savedIndexes.has(i)}
                      className="grid h-9 w-9 place-items-center rounded-xl transition active:scale-95"
                      style={{
                        background: savedIndexes.has(i)
                          ? "var(--nex-accent-50, #F1EBDD)"
                          : "var(--nex-cream, #F7F2E8)",
                        color: savedIndexes.has(i)
                          ? "var(--nex-accent-500, #8B7355)"
                          : "var(--nex-neutral-500, #6b6b6b)",
                        border: `1px solid ${savedIndexes.has(i) ? "var(--nex-accent-500, #8B7355)" : "var(--nex-neutral-200, #E7E1D2)"}`,
                      }}
                    >
                      <Bookmark size={16} />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Save & Share · spec §E.3 · placed below the direction grid */}
      <div
        className="mt-2 rounded-2xl p-4"
        style={{
          background: "var(--nex-cream-elev, #FFFFFF)",
          border: "1px solid var(--nex-neutral-200, #E7E1D2)",
        }}
      >
        <div className="text-[13px] font-semibold"
             style={{ color: "var(--nex-neutral-900, #1a1a1a)" }}>
          Save your staircase ideas
        </div>
        <p className="mt-1 text-[12px]"
           style={{ color: "var(--nex-neutral-500, #6b6b6b)" }}>
          Come back anytime. Share with someone at home to decide together.
        </p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={handleShareAll}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-[13px] font-semibold transition active:scale-95"
            style={{
              background: "var(--nex-cream, #F7F2E8)",
              color: "var(--nex-neutral-900, #1a1a1a)",
              border: "1px solid var(--nex-neutral-200, #E7E1D2)",
            }}
          >
            <Share2 size={14} />
            Share with your partner
          </button>
        </div>
      </div>
    </div>
  );
}
