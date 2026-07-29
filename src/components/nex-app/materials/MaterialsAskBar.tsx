"use client";
// MaterialsAskBar — the conversation-first entry point on the Materials
// landing. Owner types what has happened ("I've received a delivery",
// "Bought some walnut"), presses Ask NEX, and the input flows into the
// existing confirmation workflow at /nex-app/materials/add?q=<text>.
//
// Layout: header row with title/subtitle on the LEFT and the input
// modality buttons (voice · camera · upload) on the TOP-RIGHT. Pill
// input row below carries only the text field + send. Suggestion
// chips removed per Philip 2026-07-28 — placeholder rotates through
// the same examples in-place, keeping the surface cleaner.

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { MT } from "./_tokens";
import { VoiceButton } from "./_shared/VoiceButton";
import { UploadIconButton } from "./_shared/UploadIconButton";
import { CameraIconButton } from "./_shared/CameraIconButton";

const PLACEHOLDERS: string[] = [
  "I've received a timber delivery",
  "Add 20 European Oak PAR boards, 2400 × 190 × 20mm",
  "Bought 8 walnut boards from Latham",
  "Log 40 pine string blanks",
];

export function MaterialsAskBar() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  // Cycle the placeholder to hint at what NEX can handle. Static after
  // the owner starts typing so we never fight their input.
  useEffect(() => {
    if (value) return;
    const t = setInterval(() => setPlaceholderIdx(i => (i + 1) % PLACEHOLDERS.length), 3500);
    return () => clearInterval(t);
  }, [value]);

  const submit = () => {
    const t = value.trim();
    if (!t) return;
    router.push(`/nex-app/materials/add?q=${encodeURIComponent(t)}`);
  };

  const submitFile = (_f: File) => {
    // Files can't be pre-filled via URL — route to /add where the owner
    // can drop / re-upload. Kept for symmetry with the workflow.
    router.push(`/nex-app/materials/add?source=upload`);
  };

  return (
    <section
      className="px-5 py-5"
      style={{
        background: MT.card,
        border: `1px solid ${MT.borderLight}`,
        borderRadius: MT.radiusLg,
        boxShadow: MT.shadowSoft,
      }}
    >
      {/* Header row · title/subtitle LEFT · modality buttons TOP-RIGHT */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="text-[17px] font-extrabold leading-tight" style={{ color: MT.darkGrey, letterSpacing: -0.3 }}>
            What have you received today?
          </div>
          <div className="mt-1 text-[12.5px]" style={{ color: MT.secondaryGrey }}>
            Say it, snap it, upload a delivery note, or type it below — NEX takes it from there.
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <ModalityIcon>
            <VoiceButton onTranscript={(t) => setValue(t)} size={36} iconSize={16} />
          </ModalityIcon>
          <CameraIconButton onClick={() => cameraRef.current?.click()} />
          <UploadIconButton onClick={() => fileRef.current?.click()} />
        </div>
      </div>

      {/* Pill input row · text + send only */}
      <div
        className="mt-4 flex items-center gap-2 pl-4 pr-1.5 py-1.5"
        style={{
          background: MT.bg,
          border: `1px solid ${MT.border}`,
          borderRadius: MT.radiusPill,
        }}
      >
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
          placeholder={PLACEHOLDERS[placeholderIdx]}
          aria-label="What have you received?"
          className="min-w-0 flex-1 bg-transparent py-2 text-[13.5px] outline-none"
          style={{ color: MT.darkGrey }}
        />
        <button
          type="button"
          onClick={submit}
          disabled={!value.trim()}
          aria-label="Ask NEX"
          className="grid h-9 min-w-[44px] place-items-center rounded-full px-3 transition-transform active:scale-95 disabled:opacity-40"
          style={{
            background: `linear-gradient(135deg, ${MT.primary}, ${MT.primaryHover})`,
            color: "#FFFFFF",
            boxShadow: "0 6px 14px -6px rgba(245,130,32,0.55)",
          }}
        >
          <Send size={14} strokeWidth={2.25} />
        </button>
      </div>

      <p className="mt-3 text-[11px]" style={{ color: MT.secondaryGrey }}>
        NEX will interpret, recognise what you&apos;ve worked with before, and show you exactly what will change before anything touches stock.
      </p>

      {/* Hidden file inputs · triggered by the modality buttons */}
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) submitFile(f);
          e.target.value = "";
        }}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) submitFile(f);
          e.target.value = "";
        }}
      />
    </section>
  );
}

/** Shared 36×36 slot for a modality icon — keeps voice/camera/upload
 *  visually aligned even though VoiceButton renders its own button. */
function ModalityIcon({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid h-9 w-9 place-items-center">
      {children}
    </div>
  );
}
