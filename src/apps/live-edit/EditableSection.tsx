// EditableSection — wraps any merchant page section. When not in edit
// mode, renders children as-is. When in edit mode, adds a subtle
// dashed outline + floating pencil button in the top-right corner
// that opens the section's editor.
//
// Sections that already have their own inline edit UI (like
// HeroSwapSlot which has its own ChangeImageChip) just need the
// visual affordance from this wrapper — no separate editor needed.
// Sections without built-in editors pass an onEdit callback here.

"use client";

import { Pencil } from "lucide-react";
import { useEditModeOptional } from "./EditModeContext";
import type { EditableSectionType } from "@/lib/live-edit/types";

export type EditableSectionProps = {
  id: string;
  type: EditableSectionType;
  label?: string;
  /** Called when the merchant taps the floating pencil button.
   *  Sections with built-in editors (like HeroSwapSlot) can ignore
   *  this — their own edit chip handles opening the editor. */
  onEdit?: () => void;
  /** Set true for sections that provide their own inline edit UI so
   *  we don't render a duplicate pencil button. */
  hasInlineEditor?: boolean;
  className?: string;
  children: React.ReactNode;
};

export function EditableSection({
  id,
  type,
  label,
  onEdit,
  hasInlineEditor = false,
  className = "",
  children
}: EditableSectionProps) {
  const editCtx = useEditModeOptional();
  const isEditMode = editCtx?.isEditMode ?? false;

  return (
    <section
      data-editable-section={id}
      data-section-type={type}
      className={`relative ${isEditMode ? "outline outline-2 outline-dashed outline-blue-400/70 outline-offset-4 rounded-2xl" : ""} ${className}`}
    >
      {isEditMode ? (
        <div className="pointer-events-none absolute -top-2 left-2 z-30 rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm">
          {label ?? type}
        </div>
      ) : null}

      {isEditMode && !hasInlineEditor && onEdit ? (
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit ${label ?? type} section`}
          className="absolute right-3 top-3 z-30 flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-white shadow-md transition hover:scale-110 hover:bg-blue-700"
        >
          <Pencil className="h-4 w-4" />
        </button>
      ) : null}

      {children}
    </section>
  );
}
