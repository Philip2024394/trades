"use client";

// src/app/nex-native/chat/peer/[accountId]/_report-user-affordance.tsx
//
// Bridge 16d · Report-user affordance wrapper.
// -------------------------------------------
// Combines a compact trigger button (bottom-left fixed pill) with
// the ReportUserModal into a single client wrapper. Owns the open/
// closed state so the parent Server Component just drops one tag.
//
// Hidden entirely when the viewer has already reported this peer
// (parent computes `alreadyReported` and skips the render).

import { useState } from "react";
import { ReportUserModal } from "./_report-user-modal";

interface ReasonMeta {
  slug: string;
  emoji: string;
  label: string;
  blurb: string;
}

interface ReportStrings {
  trigger: string;
  title: string;
  lede: string;
  reason_label: string;
  note_label: string;
  note_placeholder: string;
  submit: string;
  cancel: string;
  disclaimer: string;
}

export function ReportUserAffordance({
  action,
  peerName,
  backHref,
  reasons,
  strings,
}: {
  action: (formData: FormData) => Promise<never> | void;
  peerName: string;
  backHref: string;
  reasons: ReasonMeta[];
  strings: ReportStrings;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {/* Small "Report" pill · fixed to bottom-left · doesn't
          collide with the composer at bottom-centre or the shop
          button at header-right. Only rendered on commerce chats
          (parent gate). */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={strings.trigger}
        title={strings.trigger}
        style={{
          position: "fixed",
          left: "calc(env(safe-area-inset-left, 0) + 12px)",
          bottom: "calc(env(safe-area-inset-bottom, 0) + 76px)",
          zIndex: 50,
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          padding: "5px 10px",
          borderRadius: 999,
          background: "rgba(255,51,85,0.10)",
          border: "1px solid rgba(255,51,85,0.35)",
          color: "#FFB4C0",
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          cursor: "pointer",
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          boxShadow: "0 6px 14px rgba(255,51,85,0.22)",
        }}
      >
        🚨 {strings.trigger}
      </button>
      <ReportUserModal
        action={action}
        open={open}
        onClose={() => setOpen(false)}
        peerName={peerName}
        backHref={backHref}
        reasons={reasons}
        strings={{
          title: strings.title,
          lede: strings.lede,
          reason_label: strings.reason_label,
          note_label: strings.note_label,
          note_placeholder: strings.note_placeholder,
          submit: strings.submit,
          cancel: strings.cancel,
          disclaimer: strings.disclaimer,
        }}
      />
    </>
  );
}
