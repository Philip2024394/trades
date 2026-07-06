// StickyEditFooter — the sticky footer bar with Edit / Publish
// buttons. Visible only to logged-in merchants (LiveEditShell only
// renders it when the merchantId prop is set).
//
// - Edit toggles the isEditMode flag → every EditableSection reveals
//   its outline + edit button.
// - Publish disabled until the merchant has unsaved changes. Tap →
//   POSTs the current page state to /api/merchant-page/publish.
// - Visual state reflects publishStatus: "clean" / "unsaved" /
//   "publishing" / "published" / "error".

"use client";

import { Check, Eye, Pencil, Send } from "lucide-react";
import { useEditMode } from "./EditModeContext";

export type StickyEditFooterProps = {
  onPublish?: () => Promise<void> | void;
};

export function StickyEditFooter({ onPublish }: StickyEditFooterProps) {
  const {
    isEditMode,
    toggleEditMode,
    publishStatus,
    setPublishStatus,
    hasUnsaved,
    markClean
  } = useEditMode();

  const canPublish = hasUnsaved && publishStatus !== "publishing";

  const handlePublish = async () => {
    if (!canPublish) return;
    setPublishStatus("publishing");
    try {
      if (onPublish) {
        await onPublish();
      }
      setPublishStatus("published");
      markClean();
      // After 3s revert to clean so the button chip stops shouting
      setTimeout(() => {
        setPublishStatus("clean");
      }, 3000);
    } catch {
      setPublishStatus("error");
    }
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center pb-4">
      <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-neutral-900 px-3 py-2 shadow-xl">
        <button
          type="button"
          onClick={toggleEditMode}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium transition ${
            isEditMode
              ? "bg-white text-neutral-900"
              : "bg-transparent text-white hover:bg-white/10"
          }`}
        >
          {isEditMode ? (
            <>
              <Eye className="h-3.5 w-3.5" /> Preview
            </>
          ) : (
            <>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </>
          )}
        </button>

        <button
          type="button"
          onClick={handlePublish}
          disabled={!canPublish}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold transition disabled:cursor-not-allowed ${
            canPublish
              ? "bg-amber-400 text-neutral-900 hover:bg-amber-300"
              : "bg-neutral-700 text-neutral-400"
          }`}
        >
          {publishStatus === "publishing" ? (
            "Publishing…"
          ) : publishStatus === "published" ? (
            <>
              <Check className="h-3.5 w-3.5" /> Published
            </>
          ) : publishStatus === "error" ? (
            "Retry publish"
          ) : (
            <>
              <Send className="h-3.5 w-3.5" /> Publish live
            </>
          )}
        </button>

        {publishStatus === "unsaved" ? (
          <span className="pl-1 text-[10px] font-medium text-amber-300">
            Unsaved changes
          </span>
        ) : null}
      </div>
    </div>
  );
}
