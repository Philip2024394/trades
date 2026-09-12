"use client";

// src/components/nex-app/live/CreateWorldPanel.tsx
//
// NEX Music/Video · Create World · Phase M · §5 §6 §20
//
// Slides in from the RIGHT when the user swipes → on the media screen.
// Frames the user's creation actions as a calm workspace (§20) rather
// than an admin dashboard.
//
// CRITICAL (§6):
//   The Create World must use the existing Phase C upload chain via
//   the existing routes:
//     · /nex-video/create      (RECORD)
//     · /nex-live/upload       (UPLOAD MUSIC / VIDEO)
//     · /nex-live/my           (MY LIVE)
//   We do NOT create a second upload path. Actions here are entry-
//   point links · the actual pipeline stays in the Phase C files.
//
// Unavailable actions (Go Live, Edit) render as an honest disabled
// row per §5 · never a fake "coming soon" green dot. Users must never
// think a feature works when it doesn't.

import Link from "next/link";
import { useCallback, useEffect, useRef } from "react";
import { X, Video, Upload, Music2, Radio, Scissors, FileEdit, ListMusic } from "lucide-react";

type Availability = "AVAILABLE" | "NOT_YET_AVAILABLE";

type Action = {
  id: string;
  label: string;
  hint: string;
  href: string | null;
  icon: React.ReactNode;
  availability: Availability;
  priority: "primary" | "secondary";
};

const ACTIONS: ReadonlyArray<Action> = [
  {
    id: "upload-music",
    label: "Upload Music",
    hint: "Existing track · rights declaration required",
    href: "/nex-live/upload",
    icon: <Music2 size={18} strokeWidth={2} />,
    availability: "AVAILABLE",
    priority: "primary",
  },
  {
    id: "upload-video",
    label: "Upload Video",
    hint: "Existing clip · rights declaration required",
    href: "/nex-live/upload",
    icon: <Upload size={18} strokeWidth={2} />,
    availability: "AVAILABLE",
    priority: "primary",
  },
  {
    id: "record",
    label: "Record",
    hint: "Camera + microphone",
    href: "/nex-video/create",
    icon: <Video size={18} strokeWidth={2} />,
    availability: "AVAILABLE",
    priority: "primary",
  },
  {
    id: "go-live",
    label: "Go Live",
    hint: "Broadcast to your audience in real time",
    href: null,
    icon: <Radio size={18} strokeWidth={2} />,
    availability: "NOT_YET_AVAILABLE",
    priority: "primary",
  },
  {
    id: "edit",
    label: "Edit",
    hint: "Trim · cut · cover art",
    href: null,
    icon: <Scissors size={18} strokeWidth={2} />,
    availability: "NOT_YET_AVAILABLE",
    priority: "secondary",
  },
  {
    id: "my-drafts",
    label: "My Drafts",
    hint: "Unpublished uploads",
    href: null,
    icon: <FileEdit size={18} strokeWidth={2} />,
    availability: "NOT_YET_AVAILABLE",
    priority: "secondary",
  },
  {
    id: "my-live",
    label: "My Live",
    hint: "Everything you have published",
    href: "/nex-live/my",
    icon: <ListMusic size={18} strokeWidth={2} />,
    availability: "AVAILABLE",
    priority: "secondary",
  },
];

export type CreateWorldPanelProps = {
  isOpen: boolean;
  onClose: () => void;
  panelId: string;
};

export function CreateWorldPanel({ isOpen, onClose, panelId }: CreateWorldPanelProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const h = (ev: KeyboardEvent) => { if (ev.key === "Escape") { ev.preventDefault(); onClose(); } };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [isOpen, onClose]);

  const navigate = useCallback(() => onClose(), [onClose]);

  if (!isOpen) return null;

  const primary = ACTIONS.filter((a) => a.priority === "primary");
  const secondary = ACTIONS.filter((a) => a.priority === "secondary");

  return (
    <div
      ref={rootRef}
      id={panelId}
      role="dialog"
      aria-modal="false"
      aria-label="Create"
      data-testid="nex-create-world-panel"
      className="absolute inset-0 z-40 flex justify-end bg-black/40 backdrop-blur-md animate-[nex-cw-fade_140ms_ease-out]"
      onClick={(ev) => { if (ev.target === ev.currentTarget) onClose(); }}
    >
      <div
        className="h-full w-full bg-neutral-950 text-white overflow-y-auto flex flex-col animate-[nex-cw-slide-in_220ms_cubic-bezier(0.22,1,0.36,1)]"
        data-testid="nex-create-world-body"
      >
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-4 border-b border-white/10 sticky top-0 bg-neutral-950/95 backdrop-blur z-10">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-white/40">You</div>
            <div className="text-lg font-semibold">Create</div>
          </div>
          <button
            type="button"
            aria-label="Close Create"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/10"
            data-testid="nex-create-world-close"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </header>

        {/* Primary actions */}
        <section className="px-4 pt-4 pb-2">
          <h3 className="text-[10px] uppercase tracking-widest text-white/40 mb-2">
            Make something
          </h3>
          <div className="grid grid-cols-1 gap-2">
            {primary.map((a) => <ActionRow key={a.id} action={a} onNavigate={navigate} />)}
          </div>
        </section>

        {/* Secondary actions */}
        <section className="px-4 pt-2 pb-4 border-t border-white/5 mt-2">
          <h3 className="text-[10px] uppercase tracking-widest text-white/40 mb-2">
            Manage
          </h3>
          <div className="grid grid-cols-1 gap-2">
            {secondary.map((a) => <ActionRow key={a.id} action={a} onNavigate={navigate} />)}
          </div>
        </section>

        <div className="flex-1" />
        <div className="px-4 py-3 text-[10px] text-white/30 leading-relaxed">
          Uploads use the NEX rights declaration flow. <em className="not-italic text-white/50 font-semibold">Uploader-declared ownership</em> is not the same as NEX-verified ownership. Actions marked <em className="not-italic text-white/50 font-semibold">Not available yet</em> ship in later authorised slices.
        </div>

        <style>{`
          @keyframes nex-cw-fade { from { opacity: 0; } to { opacity: 1; } }
          @keyframes nex-cw-slide-in { from { transform: translateX(100%); } to { transform: translateX(0); } }
        `}</style>
      </div>
    </div>
  );
}

function ActionRow({ action, onNavigate }: { action: Action; onNavigate: () => void }) {
  const inner = (
    <>
      <span
        aria-hidden
        className={`grid place-items-center h-10 w-10 rounded-lg ${
          action.availability === "AVAILABLE"
            ? "bg-orange-500/20 text-orange-400"
            : "bg-white/[0.04] text-white/30"
        }`}
      >
        {action.icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-[14px] font-semibold ${
          action.availability === "AVAILABLE" ? "text-white" : "text-white/40"
        }`}>
          {action.label}
        </span>
        <span className="block text-[11px] text-white/40 mt-0.5">
          {action.hint}
        </span>
      </span>
      {action.availability === "NOT_YET_AVAILABLE" && (
        <span className="text-[10px] uppercase tracking-wider text-white/40 bg-white/[0.08] rounded-full px-2 py-0.5 whitespace-nowrap">
          Not available yet
        </span>
      )}
    </>
  );

  const baseClass = "flex items-center gap-3 px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.03]";

  if (action.availability === "AVAILABLE" && action.href) {
    return (
      <Link
        href={action.href}
        onClick={onNavigate}
        className={`${baseClass} hover:bg-white/[0.06] active:bg-white/[0.10] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40`}
        data-testid={`nex-create-world-action-${action.id}`}
        data-availability={action.availability}
      >
        {inner}
      </Link>
    );
  }
  return (
    <div
      className={`${baseClass} opacity-70 cursor-not-allowed`}
      data-testid={`nex-create-world-action-${action.id}`}
      data-availability={action.availability}
      aria-disabled="true"
    >
      {inner}
    </div>
  );
}
