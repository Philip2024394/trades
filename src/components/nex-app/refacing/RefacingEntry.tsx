"use client";

// RefacingEntry — upload-first entry surface for /nex-app/refacing.
//
// LAYOUT (per Stage 1 A4 + B1 + B4):
//   · Header: "NEX REFACING" chip + boundary marker heading + one-line explainer
//   · Primary hero action: "START WITH YOUR STAIRCASE" · drag-drop on desktop ·
//     camera capture + file picker on mobile
//   · Secondary link (visually quieter · per PR-5 · Path B): "Just looking for
//     ideas? Explore inspiration" → /nex-app/staircase-renovations
//   · Design Library separation (per Stage 1 A3): explicit second card
//     "EXPLORE STAIRCASE DESIGNS" (Design Library, non-refacing) — for now
//     linking to the existing staircase library page.
//
// FLOW:
//   1. Customer taps upload / camera → picks file
//   2. ensureCase() creates a DRAFT Case with rf_ ID + return token
//   3. uploadBasePhoto() attaches the photo to the Case
//   4. Redirect to /nex-app/refacing/your-project/[rf_id]
//
// No prices displayed anywhere (PR-13). No taxonomies surfaced (PR-11).

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Camera, Image as ImageIcon, Loader2, Upload, ArrowRight } from "lucide-react";
import { ensureCase, uploadBasePhoto } from "@/lib/nex/refacing/use-case";

type UploadState = "idle" | "creating" | "uploading" | "done" | "error";

export function RefacingEntry() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const [state, setState] = useState<UploadState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback(
    async (file: File | null) => {
      if (!file) return;
      setErrorMsg(null);
      setState("creating");
      try {
        const { refacing_case_id, anonymous_return_token } = await ensureCase();
        setState("uploading");
        await uploadBasePhoto(refacing_case_id, anonymous_return_token, file);
        setState("done");
        router.push(`/nex-app/refacing/your-project/${refacing_case_id}`);
      } catch (err) {
        setState("error");
        setErrorMsg(err instanceof Error ? err.message : String(err));
      }
    },
    [router]
  );

  const openFilePicker = () => fileRef.current?.click();
  const openCamera = () => cameraRef.current?.click();

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) void handleFile(f);
  };

  return (
    <div
      className="relative mx-auto flex min-h-screen w-full max-w-md flex-col overflow-x-hidden"
      style={{ background: "var(--nex-cream, #F7F2E8)" }}
    >
      {/* ── Header · A4 boundary marker ── */}
      <header className="px-5 pt-8 pb-4">
        <div
          className="text-[11px] font-semibold uppercase tracking-widest"
          style={{ color: "var(--nex-accent-500, #8B7355)" }}
        >
          NEX Refacing
        </div>
        <h1
          className="mt-2 text-[26px] font-semibold leading-tight"
          style={{ color: "var(--nex-neutral-900, #1a1a1a)" }}
        >
          Keep your staircase.
          <br />
          Change its appearance.
        </h1>
        <p
          className="mt-2 text-[14px] leading-snug"
          style={{ color: "var(--nex-neutral-500, #6b6b6b)" }}
        >
          Show us your existing staircase. We will prepare your project and
          connect you with a suitable local staircase professional.
        </p>
      </header>

      {/* ── Primary hero · upload / camera / drag-drop ── */}
      <section className="px-5 pb-4">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className="rounded-2xl p-5 transition-colors"
          style={{
            background: dragOver ? "var(--nex-accent-50, #F1EBDD)" : "var(--nex-cream-elev, #FFFFFF)",
            border: `2px dashed ${dragOver ? "var(--nex-accent-500, #8B7355)" : "var(--nex-neutral-200, #E7E1D2)"}`,
          }}
        >
          <div className="flex flex-col items-center text-center gap-3">
            <span
              className="grid h-14 w-14 place-items-center rounded-full"
              style={{
                background: "var(--nex-accent-50, #F1EBDD)",
                color: "var(--nex-accent-500, #8B7355)",
              }}
              aria-hidden
            >
              <Upload size={26} strokeWidth={1.75} />
            </span>

            <div>
              <div
                className="text-[18px] font-semibold leading-tight"
                style={{ color: "var(--nex-neutral-900, #1a1a1a)" }}
              >
                START WITH YOUR STAIRCASE
              </div>
              <div
                className="mt-1 text-[12px] leading-snug"
                style={{ color: "var(--nex-neutral-500, #6b6b6b)" }}
              >
                One straight-on photo from the bottom is enough to begin.
              </div>
            </div>

            {/* Action buttons · camera on top for mobile-native reach */}
            <div className="mt-2 flex w-full flex-col gap-2">
              <button
                type="button"
                onClick={openCamera}
                disabled={state === "creating" || state === "uploading"}
                className="flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-[14px] font-semibold transition active:scale-95"
                style={{
                  background: "var(--nex-neutral-900, #1a1a1a)",
                  color: "var(--nex-cream, #F7F2E8)",
                }}
              >
                {state === "creating" || state === "uploading" ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Camera size={18} />
                )}
                {state === "creating"
                  ? "Preparing…"
                  : state === "uploading"
                    ? "Uploading…"
                    : "Take a photo"}
              </button>
              <button
                type="button"
                onClick={openFilePicker}
                disabled={state === "creating" || state === "uploading"}
                className="flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-[14px] font-semibold transition active:scale-95"
                style={{
                  background: "var(--nex-cream-elev, #FFFFFF)",
                  color: "var(--nex-neutral-900, #1a1a1a)",
                  border: "1px solid var(--nex-neutral-200, #E7E1D2)",
                }}
              >
                <ImageIcon size={18} />
                Upload from gallery
              </button>
            </div>
            <div
              className="text-[11px]"
              style={{ color: "var(--nex-neutral-500, #6b6b6b)" }}
            >
              or drop a photo here (desktop)
            </div>
          </div>

          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          />
        </div>

        {/* Error state · honest · no fake success */}
        <AnimatePresence>
          {state === "error" && errorMsg && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-3 rounded-lg px-3 py-2 text-[12px]"
              style={{
                background: "#FEECEC",
                color: "#7A1F1F",
                border: "1px solid #F1BFBF",
              }}
            >
              We couldn&apos;t save that photo. Please try again. If it keeps
              happening, use the &quot;Continue without a photo&quot; option
              below and you can add photos later.
              <div className="mt-1 opacity-70">Details: {errorMsg}</div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* ── Secondary Path B · quieter link (per PR-5 weighting) ── */}
      <section className="px-5 pb-2">
        <a
          href="/nex-app/staircase-renovations"
          className="block rounded-xl px-4 py-3 text-center text-[13px] transition"
          style={{
            background: "transparent",
            color: "var(--nex-neutral-700, #3d3d3d)",
            border: "1px dashed var(--nex-neutral-200, #E7E1D2)",
          }}
        >
          Just looking for ideas? <span className="font-semibold">Explore inspiration →</span>
        </a>
      </section>

      {/* ── Design Library separation (Stage 1 A3 · locked labels) ── */}
      <section className="px-5 pt-6 pb-8">
        <div
          className="rounded-2xl p-4"
          style={{
            background: "var(--nex-cream-elev, #FFFFFF)",
            border: "1px solid var(--nex-neutral-200, #E7E1D2)",
          }}
        >
          <div
            className="text-[10px] font-semibold uppercase tracking-widest"
            style={{ color: "var(--nex-neutral-500, #6b6b6b)" }}
          >
            Not the right journey?
          </div>

          <div className="mt-3 grid gap-3">
            <div
              className="rounded-xl p-3"
              style={{
                background: "var(--nex-accent-50, #F1EBDD)",
                border: "1px solid var(--nex-accent-500, #8B7355)",
              }}
            >
              <div
                className="text-[10px] font-semibold uppercase tracking-widest"
                style={{ color: "var(--nex-accent-500, #8B7355)" }}
              >
                You&apos;re here
              </div>
              <div
                className="mt-1 text-[15px] font-semibold"
                style={{ color: "var(--nex-neutral-900, #1a1a1a)" }}
              >
                REFACE YOUR EXISTING STAIRCASE
              </div>
              <div
                className="mt-1 text-[11px]"
                style={{ color: "var(--nex-neutral-500, #6b6b6b)" }}
              >
                Change how your current staircase looks — treads, risers, balustrade, newels, finishes.
              </div>
            </div>

            <a
              href="/nex-app/staircase-library"
              className="rounded-xl p-3 transition active:scale-[0.98]"
              style={{
                background: "var(--nex-cream, #F7F2E8)",
                border: "1px solid var(--nex-neutral-200, #E7E1D2)",
              }}
            >
              <div
                className="text-[10px] font-semibold uppercase tracking-widest"
                style={{ color: "var(--nex-neutral-500, #6b6b6b)" }}
              >
                Different journey
              </div>
              <div className="mt-1 flex items-center justify-between gap-2">
                <div
                  className="text-[15px] font-semibold"
                  style={{ color: "var(--nex-neutral-900, #1a1a1a)" }}
                >
                  EXPLORE STAIRCASE DESIGNS
                </div>
                <ArrowRight size={16} style={{ color: "var(--nex-neutral-500, #6b6b6b)" }} />
              </div>
              <div
                className="mt-1 text-[11px]"
                style={{ color: "var(--nex-neutral-500, #6b6b6b)" }}
              >
                Browse full staircase designs — new-build, replacements, and design library reference.
              </div>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
