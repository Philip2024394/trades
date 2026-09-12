// src/components/nex-app/shell/ActionProposalPrompt.tsx
//
// Stage 3.41 · Confirm/Decline prompt for pending mutation proposals
// (Philip 2026-08-31).
// Stage 3.41.c · Polish · icons + 44px touch targets + native feel.
//
// CONSTITUTIONAL: both buttons post messages back through the existing
// send path (`"yes send it"` / `"no"`) so the 3.37 authorization gate
// handles them identically to free-text confirmation. This gives us
// exactly one authorization code path · zero risk of drift between
// button-flow and typing-flow.

"use client";

import { Send, X } from "lucide-react";
import type { ChatArtifactPendingProposal } from "./chat-artifacts";

export function ActionProposalPrompt({
  proposal,
  disabled,
  onConfirm,
  onDecline,
}: {
  proposal: ChatArtifactPendingProposal;
  /** Disable both buttons once the user has clicked one (or typed) to prevent double-fire. */
  disabled?: boolean;
  onConfirm: () => void;
  onDecline: () => void;
}) {
  const isID = proposal.language === "id";
  const confirmLabel = isID ? "Iya, kirim" : "Yes, send it";
  const declineLabel = isID ? "Jangan"     : "No";
  return (
    <div
      className="mt-3 flex flex-wrap gap-2"
      data-testid="action-proposal-prompt"
      data-action-id={proposal.actionId}
    >
      <button
        type="button"
        onClick={onConfirm}
        disabled={disabled}
        aria-label={confirmLabel}
        className="flex h-11 items-center justify-center gap-1.5 rounded-full px-5 text-[13px] font-semibold text-white transition-opacity disabled:opacity-50"
        style={{
          background:  "var(--nex-accent-500, #F97316)",
          borderColor: "var(--nex-accent-500, #F97316)",
        }}
      >
        <Send size={15} strokeWidth={2.4} />
        <span>{confirmLabel}</span>
      </button>
      <button
        type="button"
        onClick={onDecline}
        disabled={disabled}
        aria-label={declineLabel}
        className="flex h-11 items-center justify-center gap-1.5 rounded-full border px-5 text-[13px] font-semibold transition-opacity disabled:opacity-50"
        style={{
          borderColor: "var(--nex-neutral-300, #d4d4d4)",
          color:       "var(--nex-neutral-900, #111)",
          background:  "transparent",
        }}
      >
        <X size={15} strokeWidth={2.4} />
        <span>{declineLabel}</span>
      </button>
    </div>
  );
}
