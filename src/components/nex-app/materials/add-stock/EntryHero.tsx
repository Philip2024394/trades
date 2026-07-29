"use client";
// EntryHero — two equal entry paths: type or upload.
// Prompt chips demonstrate what NEX can handle in this slice.

import { useRef, useState } from "react";
import { Send, Upload, Camera } from "lucide-react";
import { MT } from "../_tokens";
import { VoiceButton } from "../_shared/VoiceButton";

const EXAMPLES: string[] = [
  "Add 20 European Oak PAR boards, 2400 × 190 × 20mm",
  "Received 8 walnut boards from Latham, £24 each",
  "Add 40 pine string blanks",
  "Log 12 ash boards 3000 × 250 × 32mm",
];

export function EntryHero({
  onSubmitText, onSubmitFile, disabled,
}: {
  onSubmitText: (t: string) => void;
  onSubmitFile: (f: File) => void;
  disabled?: boolean;
}) {
  const [text, setText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const submit = () => {
    const t = text.trim();
    if (!t) return;
    onSubmitText(t);
  };

  return (
    <section className="mt-4">
      <div
        className="px-5 py-6"
        style={{
          background: MT.card,
          border: `1px solid ${MT.borderLight}`,
          borderRadius: MT.radiusLg,
          boxShadow: MT.shadowSoft,
        }}
      >
        <h2 className="text-[17px] font-extrabold" style={{ color: MT.darkGrey, letterSpacing: -0.3 }}>
          What have you received today?
        </h2>
        <p className="mt-2 text-[13px]" style={{ color: MT.secondaryGrey }}>
          Speak, snap, upload a delivery note, or type it below. NEX will interpret, match against your Materials Memory, and present the work for approval.
        </p>

        {/* Textarea + send */}
        <div className="mt-4 flex flex-col gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                submit();
              }
            }}
            rows={3}
            placeholder="Add 20 European Oak PAR boards, 2400 × 190 × 20mm from James Latham"
            className="w-full resize-none px-4 py-3 text-[14px] outline-none focus:ring-2"
            style={{
              background: MT.bg,
              border: `1px solid ${MT.border}`,
              color: MT.darkGrey,
              borderRadius: MT.radiusMd,
            }}
            disabled={disabled}
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={submit}
              disabled={disabled || !text.trim()}
              className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 text-[13.5px] font-bold transition-transform active:scale-95 disabled:opacity-50"
              style={{
                background: MT.primary,
                color: "#FFFFFF",
                borderRadius: MT.radiusMd,
                boxShadow: "0 6px 16px -6px rgba(245,130,32,0.55)",
              }}
            >
              <Send size={15} strokeWidth={2.25} />
              Ask NEX
            </button>
            <div
              className="grid h-11 w-11 place-items-center"
              style={{ background: MT.card, border: `1px solid ${MT.border}`, borderRadius: MT.radiusMd }}
            >
              <VoiceButton onTranscript={(t) => setText(t)} size={36} iconSize={16} />
            </div>
            <button
              type="button"
              aria-label="Upload document"
              onClick={() => fileRef.current?.click()}
              disabled={disabled}
              className="grid h-11 w-11 place-items-center transition-transform active:scale-95"
              style={{ background: MT.card, color: MT.primary, border: `1px solid ${MT.border}`, borderRadius: MT.radiusMd }}
            >
              <Upload size={18} strokeWidth={2} />
            </button>
            <button
              type="button"
              aria-label="Take photo"
              onClick={() => cameraRef.current?.click()}
              disabled={disabled}
              className="grid h-11 w-11 place-items-center transition-transform active:scale-95"
              style={{ background: MT.card, color: MT.primary, border: `1px solid ${MT.border}`, borderRadius: MT.radiusMd }}
            >
              <Camera size={18} strokeWidth={2} />
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onSubmitFile(f);
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
              if (f) onSubmitFile(f);
              e.target.value = "";
            }}
          />
        </div>

        {/* Example prompt chips */}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setText(ex)}
              className="rounded-full px-3 py-1.5 text-[11.5px] font-semibold transition-transform active:scale-95"
              style={{ background: MT.bg, color: MT.darkGrey, border: `1px solid ${MT.border}` }}
            >
              {ex}
            </button>
          ))}
        </div>
      </div>

      {/* What Rule holds this to */}
      <p className="mt-3 px-1 text-[11.5px]" style={{ color: MT.secondaryGrey }}>
        NEX never updates stock silently. Every action lands on a confirmation screen before anything is created.
      </p>
    </section>
  );
}
