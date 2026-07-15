"use client";

// AI Visualiser bolt-on for Site Interest.
//
// Constitutional rule (Philip 2026-07-16 —
// feedback_ai_visualiser_expectations_and_no_refunds.md):
//   • MUST show expectations screen BEFORE the upload input
//   • Photo tips + prompt tips + iteration reality + AI-is-AI
//     disclaimer + strict no-refund line, all verbatim
//   • Sticky "don't show again" for repeat generations
//   • Credits non-refundable — no refund UI, no refund endpoint
//
// Flow:
//   1. expectations   (skippable after first accept via localStorage)
//   2. upload         (room photo + optional prompt note)
//   3. queued         (job accepted, render arrives later)
//
// Real AI generation is a follow-up worker; this ships the intent
// capture and the constitutional expectations UX.

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Check, ChevronRight, Info, Loader2, Sparkles, X, ArrowLeft } from "lucide-react";

const BRAND_BLACK = "#0A0A0A";
const BRAND_YELLOW = "#FFB300";
const BRAND_GREEN = "#166534";
const RED = "#B91C1C";

const EXPECTATIONS_SKIP_KEY = "visualise_expectations_skip";
const MAX_ROOM_PHOTO_BYTES = 8 * 1024 * 1024;

export type VisualiseContext = {
  sourceImageUrl:  string;
  sourceImageAlt?: string;
  sourcePostId?:   string | null;
  sourceCanteenId?:string | null;
  targetTradeSlug?:string | null;
  /** Short project label ("Loft Ladders", "Garden Design") used in
   *  the modal header for context. */
  projectLabel?:   string;
};

export function VisualiseModal({
  context,
  onClose
}: {
  context: VisualiseContext;
  onClose: () => void;
}) {
  // Skip expectations for repeat users. First-run always shows it.
  const [step, setStep] = useState<"expectations" | "upload" | "queued">(() => {
    if (typeof window === "undefined") return "expectations";
    try {
      return window.localStorage.getItem(EXPECTATIONS_SKIP_KEY) === "1" ? "upload" : "expectations";
    } catch {
      return "expectations";
    }
  });
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [roomPhoto, setRoomPhoto] = useState<File | null>(null);
  const [promptNote, setPromptNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [queuedId, setQueuedId] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  // Escape + body scroll lock
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, [onClose]);

  const acceptExpectations = useCallback(() => {
    if (dontShowAgain) {
      try { window.localStorage.setItem(EXPECTATIONS_SKIP_KEY, "1"); } catch { /* ignore */ }
    }
    setStep("upload");
  }, [dontShowAgain]);

  const pickPhoto = useCallback((file: File | null) => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
    if (!file) { setRoomPhoto(null); return; }
    if (!file.type.startsWith("image/")) { setErrorKey("room-photo-must-be-image"); return; }
    if (file.size > MAX_ROOM_PHOTO_BYTES) { setErrorKey("room-photo-too-large"); return; }
    setErrorKey(null);
    setRoomPhoto(file);
    objectUrlRef.current = URL.createObjectURL(file);
  }, []);

  async function submit() {
    if (!roomPhoto || submitting) return;
    setSubmitting(true);
    setErrorKey(null);
    const fd = new FormData();
    fd.set("sourceImageUrl", context.sourceImageUrl);
    if (context.sourcePostId)    fd.set("sourcePostId",    context.sourcePostId);
    if (context.sourceCanteenId) fd.set("sourceCanteenId", context.sourceCanteenId);
    if (context.targetTradeSlug) fd.set("targetTradeSlug", context.targetTradeSlug);
    if (promptNote.trim())       fd.set("promptNote",      promptNote.trim());
    fd.append("roomPhoto", roomPhoto);
    try {
      const res = await fetch("/api/inspiration/visualise", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setErrorKey(typeof data.error === "string" ? data.error : "network-error");
        return;
      }
      setQueuedId(data.id ?? null);
      setStep("queued");
    } catch {
      setErrorKey("network-error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center overflow-y-auto p-0 sm:items-center sm:p-6"
      style={{ backgroundColor: "rgba(10,10,10,0.80)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-6"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-100"
        >
          <X size={16} strokeWidth={2.4}/>
        </button>

        {step === "expectations" && (
          <ExpectationsScreen
            projectLabel={context.projectLabel}
            dontShowAgain={dontShowAgain}
            onDontShowAgain={setDontShowAgain}
            onAccept={acceptExpectations}
          />
        )}

        {step === "upload" && (
          <UploadScreen
            projectLabel={context.projectLabel}
            sourceImageUrl={context.sourceImageUrl}
            roomPhoto={roomPhoto}
            objectUrl={objectUrlRef.current}
            promptNote={promptNote}
            onPromptNoteChange={setPromptNote}
            onPickPhoto={pickPhoto}
            onBack={() => setStep("expectations")}
            onSubmit={submit}
            submitting={submitting}
            errorKey={errorKey}
          />
        )}

        {step === "queued" && (
          <QueuedScreen queuedId={queuedId} onClose={onClose}/>
        )}
      </div>
    </div>
  );
}

// ─── Screen 1: Expectations ───────────────────────────────────

function ExpectationsScreen({
  projectLabel,
  dontShowAgain,
  onDontShowAgain,
  onAccept
}: {
  projectLabel?: string;
  dontShowAgain: boolean;
  onDontShowAgain: (v: boolean) => void;
  onAccept: () => void;
}) {
  return (
    <>
      <div className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
        AI Visualiser · read first
      </div>
      <h3
        className="mt-1 text-[22px] font-black leading-tight text-neutral-900"
        style={{ fontFamily: '"Playfair Display", Georgia, "Times New Roman", serif' }}
      >
        Before you upload{projectLabel ? ` your ${projectLabel.toLowerCase()} space` : ""}…
      </h3>
      <p className="mt-2 text-[12.5px] leading-relaxed text-neutral-700">
        AI generation is powerful but picky. Two minutes reading this gets you a much better result — and saves you from thinking your first render is you doing something wrong (it isn&apos;t).
      </p>

      <ExpectationBlock
        title="Photo tips"
        items={[
          "Flat-on angle — stand square to the wall or space, not at 45° from a corner.",
          "Natural daylight if you can — camera flash washes out edges.",
          "Whole space in frame — a foot-level partial view won't work, the AI needs to see the room.",
          "No fisheye lenses (most phones are fine on 1x)."
        ]}
      />
      <ExpectationBlock
        title="Prompt tips"
        items={[
          "Short + specific beats long + poetic.",
          "One or two changes per render, not five.",
          "Skip fluffy words like 'luxurious' or 'dreamy'."
        ]}
      />
      <ExpectationBlock
        title="Iteration reality"
        items={[
          "First render might miss. That's normal.",
          "Try 2–3 times with small tweaks to the prompt.",
          "Best results usually come on render 2 or 3."
        ]}
      />

      <div
        className="mt-4 rounded-xl border p-3"
        style={{ borderColor: "rgba(184,134,11,0.35)", backgroundColor: "rgba(255,179,0,0.08)" }}
      >
        <div className="flex items-start gap-2">
          <Info size={14} strokeWidth={2.4} className="mt-0.5 flex-shrink-0" style={{ color: "#7A5B00" }}/>
          <div className="text-[12px] leading-relaxed text-neutral-800">
            <strong>This isn&apos;t you — it&apos;s the level AI is at today, for everyone.</strong>{" "}
            Every platform (including the big ones) is in the same place. We&apos;ll upgrade the model as the tech improves.
          </div>
        </div>
      </div>

      <div
        className="mt-3 rounded-xl border p-3"
        style={{ borderColor: `${RED}55`, backgroundColor: "#FEF2F2" }}
      >
        <div className="text-[11px] font-black uppercase tracking-wider" style={{ color: RED }}>
          No refunds
        </div>
        <p className="mt-1 text-[11.5px] leading-snug text-neutral-700">
          Credits are non-refundable, even if a render doesn&apos;t meet expectations. AI generations consume the same GPU cost whether you love the result or not. Your first 3 renders are free — use them to learn what works.
        </p>
      </div>

      <label className="mt-3 flex cursor-pointer items-center gap-2 text-[11.5px] text-neutral-700">
        <input
          type="checkbox"
          checked={dontShowAgain}
          onChange={(e) => onDontShowAgain(e.target.checked)}
          className="h-4 w-4"
        />
        Got it — don&apos;t show me this again
      </label>

      <button
        type="button"
        onClick={onAccept}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-[12px] font-black uppercase tracking-wider text-white shadow-md transition active:scale-[0.97]"
        style={{ backgroundColor: BRAND_BLACK }}
      >
        <Sparkles size={13} strokeWidth={2.6}/>
        I&apos;m ready — let&apos;s go
        <ChevronRight size={13} strokeWidth={2.6}/>
      </button>
    </>
  );
}

function ExpectationBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="mt-4">
      <div className="text-[10.5px] font-black uppercase tracking-[0.14em] text-neutral-500">
        {title}
      </div>
      <ul className="mt-1.5 flex flex-col gap-1">
        {items.map((it) => (
          <li key={it} className="flex items-start gap-2 text-[12px] leading-snug text-neutral-800">
            <Check size={11} strokeWidth={2.6} className="mt-1 flex-shrink-0" style={{ color: BRAND_GREEN }}/>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Screen 2: Upload ─────────────────────────────────────────

const ERROR_COPY: Record<string, string> = {
  "room-photo-required":     "Please add a photo of your room.",
  "room-photo-must-be-image":"That file isn't an image — please pick a JPG or PNG.",
  "room-photo-too-large":    "Image is too large — please resize to under 8MB.",
  "invalid-source-image":    "Something's wrong with the source image — please close and try again from the card.",
  "rate-limited":            "You've submitted a few in a row — please wait an hour before trying again.",
  "upload-failed":           "Upload failed. Try a different image or check your connection.",
  "db-insert-failed":        "Save failed — try again.",
  "network-error":           "Network error — check your connection and try again."
};

function UploadScreen({
  projectLabel,
  sourceImageUrl,
  roomPhoto,
  objectUrl,
  promptNote,
  onPromptNoteChange,
  onPickPhoto,
  onBack,
  onSubmit,
  submitting,
  errorKey
}: {
  projectLabel?: string;
  sourceImageUrl: string;
  roomPhoto: File | null;
  objectUrl: string | null;
  promptNote: string;
  onPromptNoteChange: (v: string) => void;
  onPickPhoto: (file: File | null) => void;
  onBack: () => void;
  onSubmit: () => void;
  submitting: boolean;
  errorKey: string | null;
}) {
  return (
    <>
      <button
        type="button"
        onClick={onBack}
        className="mb-2 inline-flex items-center gap-1 text-[10.5px] font-black uppercase tracking-wider text-neutral-500 hover:text-neutral-900"
      >
        <ArrowLeft size={12} strokeWidth={2.6}/>
        Tips
      </button>
      <div className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
        Visualise in my room
      </div>
      <h3
        className="mt-1 text-[22px] font-black leading-tight text-neutral-900"
        style={{ fontFamily: '"Playfair Display", Georgia, "Times New Roman", serif' }}
      >
        Upload your space
      </h3>
      <p className="mt-1 text-[12px] leading-snug text-neutral-600">
        We&apos;ll blend {projectLabel ? `this ${projectLabel.toLowerCase()}` : "this inspiration"} into your room.
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="overflow-hidden rounded-xl border" style={{ borderColor: "rgba(139,69,19,0.15)" }}>
          <div className="bg-neutral-100 p-1.5 text-[9.5px] font-black uppercase tracking-wider text-neutral-500">Inspiration</div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={sourceImageUrl} alt="" className="block aspect-square w-full object-cover"/>
        </div>
        <label className="cursor-pointer overflow-hidden rounded-xl border transition hover:bg-neutral-50" style={{ borderColor: "rgba(139,69,19,0.15)" }}>
          <div className="bg-neutral-100 p-1.5 text-[9.5px] font-black uppercase tracking-wider text-neutral-500">Your room</div>
          {objectUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={objectUrl} alt="" className="block aspect-square w-full object-cover"/>
          ) : (
            <div className="flex aspect-square items-center justify-center bg-neutral-50 text-[11px] font-black text-neutral-500">
              <div className="text-center">
                <Camera size={22} strokeWidth={2.2} className="mx-auto text-neutral-400"/>
                <div className="mt-1">Tap to add</div>
              </div>
            </div>
          )}
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => onPickPhoto(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>

      <label className="mt-3 block">
        <div className="text-[10.5px] font-black uppercase tracking-[0.14em] text-neutral-600">
          Optional — one small tweak
        </div>
        <input
          type="text"
          value={promptNote}
          onChange={(e) => onPromptNoteChange(e.target.value.slice(0, 200))}
          placeholder="e.g. use darker timber than the reference"
          className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-[13px] text-neutral-900 focus:outline-none focus:ring-2"
          style={{ borderColor: "rgba(139,69,19,0.15)" }}
        />
        <div className="mt-0.5 text-[10px] text-neutral-400">Short + specific beats long + poetic. Leave blank for a straight blend.</div>
      </label>

      {errorKey && (
        <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[11.5px] font-black" style={{ color: RED }}>
          {ERROR_COPY[errorKey] ?? "Something went wrong. Please try again."}
        </div>
      )}

      <button
        type="button"
        onClick={onSubmit}
        disabled={!roomPhoto || submitting}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-[12px] font-black uppercase tracking-wider text-white shadow-md transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
        style={{ backgroundColor: BRAND_BLACK }}
      >
        {submitting ? <Loader2 size={13} className="animate-spin"/> : <Sparkles size={13} strokeWidth={2.6}/>}
        {submitting ? "Sending…" : "Visualise (free — 3 left)"}
      </button>
      <p className="mt-2 text-center text-[10px] text-neutral-400">
        First 3 renders free · packs from £4.99 · non-refundable
      </p>
    </>
  );
}

// ─── Screen 3: Queued ─────────────────────────────────────────

function QueuedScreen({ queuedId, onClose }: { queuedId: string | null; onClose: () => void }) {
  return (
    <div className="text-center">
      <div
        className="mx-auto flex h-14 w-14 items-center justify-center rounded-full"
        style={{ backgroundColor: `${BRAND_YELLOW}22` }}
      >
        <Sparkles size={26} strokeWidth={2.6} style={{ color: BRAND_YELLOW }}/>
      </div>
      <h3 className="mt-3 text-[19px] font-black text-neutral-900">
        Queued — your render is on the way.
      </h3>
      <p className="mx-auto mt-1.5 max-w-md text-[12.5px] leading-relaxed text-neutral-600">
        AI generation takes a minute or two. We&apos;ll pop it back onto your Site Board when it&apos;s ready — no need to keep this page open.
      </p>
      {queuedId && (
        <p className="mt-2 text-[10px] font-black uppercase tracking-[0.14em] text-neutral-400">
          Job {queuedId.slice(0, 8)}
        </p>
      )}
      <button
        type="button"
        onClick={onClose}
        className="mt-4 inline-flex items-center rounded-full border px-5 py-2 text-[11.5px] font-black uppercase tracking-wider text-neutral-800 hover:bg-neutral-50"
        style={{ borderColor: "rgba(139,69,19,0.15)" }}
      >
        Close
      </button>
    </div>
  );
}
