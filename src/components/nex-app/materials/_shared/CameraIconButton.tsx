"use client";
// CameraIconButton — modality button matching VoiceButton in size.
// Parent owns the hidden `capture="environment"` file input.

import { Camera } from "lucide-react";
import { MT } from "../_tokens";

export function CameraIconButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Take a photo of a delivery note or receipt"
      className="grid h-9 w-9 place-items-center rounded-full transition-transform active:scale-95"
      style={{ color: MT.secondaryGrey }}
    >
      <Camera size={16} strokeWidth={2} />
    </button>
  );
}
