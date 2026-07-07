// PageBuilder — the outer layout that maps sections to slots.
//
// Two modes:
//   NORMAL:    renders each slot's assigned section as a normal section
//              (the exact section the merchant sees when previewing).
//   REORDER:   sections collapse to compact drag cards, empty slots
//              show a drop prompt, moving a section auto-applies the
//              slot's preferred variant for that section type.
//
// The variant-aware placement magic lives in the onDrop handler
// below — when a section lands in a slot with a matching variant
// hint, we swap its layout variant automatically.
//
// Slots are defined by the caller (LANDING_PAGE_SLOTS is the
// canonical default). Each section is passed as { id, type, node }
// and PageBuilder decides where + how to render it based on the
// current placements state.

"use client";

import { useEffect, useMemo } from "react";
import {
  ArrowRightLeft,
  GripVertical,
  Sparkles
} from "lucide-react";
import { useEditMode } from "./EditModeContext";
import { useDragReorder } from "./useDragReorder";
import type { PageSlot } from "@/lib/live-edit/pageSlots";
import { preferredVariantForSlot } from "@/lib/live-edit/pageSlots";
import type { EditableSectionType } from "@/lib/live-edit/types";
import { variantsFor } from "@/lib/live-edit/sectionVariants";

export type PageBuilderSection = {
  id: string;
  type: EditableSectionType;
  label: string;
  /** The rendered section — the caller passes the actual EditableXSection
   *  as a React node so PageBuilder doesn't need to know each section's
   *  props. The section reads its own variant from context via
   *  useSectionPlacement (see helper below). */
  node: React.ReactNode;
  /** Default slot the section starts in on first mount. */
  defaultSlotId: string;
  /** Default variant on first mount. Slot preference wins on first
   *  registration if the slot has a hint for this section type. */
  defaultVariant: string;
};

export type PageBuilderProps = {
  slots: PageSlot[];
  sections: PageBuilderSection[];
};

export function PageBuilder({ slots, sections }: PageBuilderProps) {
  const {
    isReorderMode,
    placements,
    registerPlacement,
    moveSectionToSlot,
    setDraggingSectionId
  } = useEditMode();

  // On mount, register each section's default placement. The slot's
  // preferred variant for the section type wins over the section's
  // default variant on first placement.
  useEffect(() => {
    sections.forEach((s) => {
      const slot = slots.find((sl) => sl.id === s.defaultSlotId);
      const initialVariant = slot
        ? preferredVariantForSlot(slot, s.type, s.defaultVariant)
        : s.defaultVariant;
      registerPlacement(s.id, s.defaultSlotId, initialVariant);
    });
    // Only run once per section list identity — placements is
    // idempotent so re-running on state change is safe but wasted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { dragState, dragHandleProps, registerDropTarget } = useDragReorder({
    onDrop: (sectionId, targetSlotId) => {
      const section = sections.find((s) => s.id === sectionId);
      const slot = slots.find((sl) => sl.id === targetSlotId);
      if (!section || !slot) return;
      const currentVariant = placements[sectionId]?.variant ?? section.defaultVariant;
      const newVariant = preferredVariantForSlot(slot, section.type, currentVariant);
      moveSectionToSlot(sectionId, targetSlotId, newVariant);
      setDraggingSectionId(null);
    }
  });

  // Publish dragging id to context so other bits of UI can react.
  useEffect(() => {
    setDraggingSectionId(dragState.sectionId);
  }, [dragState.sectionId, setDraggingSectionId]);

  // Build slot → section map (each slot holds at most one section).
  const slotToSection = useMemo(() => {
    const map = new Map<string, PageBuilderSection>();
    sections.forEach((s) => {
      const placement = placements[s.id];
      if (placement) {
        map.set(placement.slotId, s);
      }
    });
    return map;
  }, [placements, sections]);

  return (
    <>
      {slots.map((slot) => (
        <PageSlotRenderer
          key={slot.id}
          slot={slot}
          section={slotToSection.get(slot.id) ?? null}
          isReorderMode={isReorderMode}
          activeDropSlot={dragState.activeSlotId}
          draggingSectionId={dragState.sectionId}
          dragHandleProps={dragHandleProps}
          registerDropTarget={registerDropTarget}
        />
      ))}

      {isReorderMode && dragState.isDragging ? (
        <DragGhost
          sectionLabel={
            sections.find((s) => s.id === dragState.sectionId)?.label ?? ""
          }
          x={dragState.pointerX}
          y={dragState.pointerY}
        />
      ) : null}
    </>
  );
}

/** Renders a single slot. In normal mode, just shows the section.
 *  In reorder mode, shows a drop-target container with a compact
 *  section card and the slot's aspect hint. */
function PageSlotRenderer({
  slot,
  section,
  isReorderMode,
  activeDropSlot,
  draggingSectionId,
  dragHandleProps,
  registerDropTarget
}: {
  slot: PageSlot;
  section: PageBuilderSection | null;
  isReorderMode: boolean;
  activeDropSlot: string | null;
  draggingSectionId: string | null;
  dragHandleProps: (
    sectionId: string
  ) => { onPointerDown: (e: React.PointerEvent<HTMLElement>) => void };
  registerDropTarget: (
    slotId: string,
    hit: { rect: DOMRect; payload: { slotId: string } } | null
  ) => void;
}) {
  // Register / update this slot's rect for hit-testing in reorder mode.
  useEffect(() => {
    if (!isReorderMode) {
      registerDropTarget(slot.id, null);
      return;
    }
    // Registration happens on next tick to guarantee layout has settled.
    const el = document.querySelector<HTMLElement>(
      `[data-slot-drop="${slot.id}"]`
    );
    if (el) {
      registerDropTarget(slot.id, {
        rect: el.getBoundingClientRect(),
        payload: { slotId: slot.id }
      });
    }
    return () => registerDropTarget(slot.id, null);
  }, [isReorderMode, slot.id, registerDropTarget]);

  if (!isReorderMode) {
    return <>{section?.node ?? null}</>;
  }

  const isActive = activeDropSlot === slot.id;
  const isBeingDragged =
    draggingSectionId !== null && section?.id === draggingSectionId;

  return (
    <div
      data-slot-drop={slot.id}
      className={`relative mx-auto my-2 max-w-4xl rounded-2xl border-2 border-dashed p-3 transition ${
        isActive
          ? "border-amber-500 bg-amber-50"
          : "border-neutral-300 bg-white"
      }`}
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-neutral-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
            Slot {slot.order + 1}
          </span>
          <span className="text-[12px] font-medium text-neutral-800">
            {slot.name}
          </span>
        </div>
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-600">
          {aspectHintLabel(slot.aspectHint)}
        </span>
      </div>

      {section ? (
        <SectionDragCard
          section={section}
          slot={slot}
          isBeingDragged={isBeingDragged}
          isActive={isActive}
          dragHandleProps={dragHandleProps}
        />
      ) : (
        <EmptySlotHint slot={slot} isActive={isActive} />
      )}

      {/* When the merchant drags a section over this slot AND the
          hovered section's type has a variant hint for this slot, we
          preview which variant will apply on drop. */}
      {isActive && draggingSectionId ? (
        <SlotVariantHintPreview slot={slot} />
      ) : null}
    </div>
  );
}

function SectionDragCard({
  section,
  slot,
  isBeingDragged,
  isActive,
  dragHandleProps
}: {
  section: PageBuilderSection;
  slot: PageSlot;
  isBeingDragged: boolean;
  isActive: boolean;
  dragHandleProps: (
    sectionId: string
  ) => { onPointerDown: (e: React.PointerEvent<HTMLElement>) => void };
}) {
  const variantHint = slot.variantHints[section.type];
  const variants = variantsFor(section.type);
  return (
    <div
      className={`flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm transition ${
        isBeingDragged ? "opacity-30" : ""
      } ${isActive && !isBeingDragged ? "ring-2 ring-amber-400" : ""}`}
    >
      <button
        type="button"
        {...dragHandleProps(section.id)}
        className="flex h-10 w-10 shrink-0 cursor-grab items-center justify-center rounded-lg bg-neutral-100 text-neutral-600 hover:bg-neutral-200 active:cursor-grabbing"
        aria-label={`Drag ${section.label}`}
        style={{ touchAction: "none" }}
      >
        <GripVertical className="h-5 w-5" />
      </button>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold text-neutral-900">
          {section.label}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-1">
          <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-600">
            {sectionTypeLabel(section.type)}
          </span>
          {variants.length > 1 ? (
            <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-600">
              {variants.length} layouts
            </span>
          ) : null}
          {variantHint ? (
            <span className="inline-flex items-center gap-1 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-800">
              <Sparkles className="h-3 w-3" />
              This slot uses “{variantLabelFor(section.type, variantHint)}”
            </span>
          ) : null}
        </div>
      </div>
      <ArrowRightLeft className="h-4 w-4 shrink-0 text-neutral-400" />
    </div>
  );
}

function EmptySlotHint({
  slot,
  isActive
}: {
  slot: PageSlot;
  isActive: boolean;
}) {
  return (
    <div
      className={`flex h-24 items-center justify-center rounded-xl border-2 border-dashed px-4 text-center text-[12px] font-medium transition ${
        isActive
          ? "border-amber-500 bg-amber-100 text-amber-900"
          : "border-neutral-200 text-neutral-500"
      }`}
    >
      {isActive
        ? "Drop here"
        : slot.emptyPrompt ?? "Drag a section here."}
    </div>
  );
}

function SlotVariantHintPreview({ slot }: { slot: PageSlot }) {
  const entries = Object.entries(slot.variantHints);
  if (entries.length === 0) return null;
  return null; // Reserved for future preview; kept as a hook.
}

function DragGhost({
  sectionLabel,
  x,
  y
}: {
  sectionLabel: string;
  x: number;
  y: number;
}) {
  return (
    <div
      className="pointer-events-none fixed z-50 rounded-full bg-neutral-900 px-3 py-1.5 text-[12px] font-semibold text-white shadow-lg"
      style={{
        left: x + 12,
        top: y + 12
      }}
    >
      {sectionLabel}
    </div>
  );
}

function aspectHintLabel(hint: PageSlot["aspectHint"]): string {
  switch (hint) {
    case "landscape-wide":
      return "Wide landscape";
    case "landscape":
      return "Landscape";
    case "square":
      return "Square";
    case "portrait":
      return "Portrait";
    case "flexible":
    default:
      return "Any shape";
  }
}

function sectionTypeLabel(type: EditableSectionType): string {
  switch (type) {
    case "hero":
      return "Hero";
    case "text":
      return "Text";
    case "image":
      return "Image";
    case "gallery":
      return "Gallery";
    case "services":
      return "Services";
    case "contact":
      return "Contact";
    case "custom":
      return "Custom";
  }
}

function variantLabelFor(type: EditableSectionType, variantId: string): string {
  const spec = variantsFor(type).find((v) => v.id === variantId);
  return spec?.label ?? variantId;
}
