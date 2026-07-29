"use client";
// UploadIconButton — modality button matching VoiceButton in size and
// weight. Purely presentational — the parent owns the hidden input.

import { Upload } from "lucide-react";
import { MT } from "../_tokens";

export function UploadIconButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Upload a delivery note or invoice"
      className="grid h-9 w-9 place-items-center rounded-full transition-transform active:scale-95"
      style={{ color: MT.secondaryGrey }}
    >
      <Upload size={16} strokeWidth={2} />
    </button>
  );
}
