// EditModeContext — provides the isEditMode flag + toggle to every
// EditableSection under the LiveEditShell. Also tracks unsaved
// draft state so the Publish button knows when to enable.
//
// Extended with reorder mode + slot assignments + variant overrides
// so the page-slot reorder system can piggyback on the same context
// without a second provider.

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState
} from "react";
import type { PublishStatus } from "@/lib/live-edit/types";

/** A section's placement on the page — which slot it lives in and
 *  what layout variant it renders with. Slot swaps happen through
 *  moveSectionToSlot; variant overrides via setSectionVariant. */
export type SectionPlacement = {
  slotId: string;
  variant: string;
};

/** Ordered map of sectionId → placement. LiveEditShell hands this
 *  ordering to PageBuilder to render sections into slots. */
export type PagePlacements = Record<string, SectionPlacement>;

type EditModeContextValue = {
  /** Signed-in merchant id — omitted for public visitor views. Passed
   *  through by LiveEditShell so downstream UI (e.g. the hero-swap
   *  "licence to remove watermark" chip) can prefill checkout with
   *  the merchant identity. */
  merchantId: string | null;

  isEditMode: boolean;
  toggleEditMode: () => void;
  setEditMode: (v: boolean) => void;

  /** Reorder mode is a sub-mode of edit mode. When on, sections
   *  collapse to compact drag cards + drop targets between slots
   *  become visible. Off by default; toggled from the sticky footer. */
  isReorderMode: boolean;
  toggleReorderMode: () => void;
  setReorderMode: (v: boolean) => void;

  publishStatus: PublishStatus;
  setPublishStatus: (s: PublishStatus) => void;

  /** Called by any EditableSection when its config changes. Marks
   *  the page as having unsaved changes so Publish becomes active. */
  markDirty: () => void;
  markClean: () => void;
  hasUnsaved: boolean;

  /** Section registry — each EditableSection reports its current
   *  config here so LiveEditShell can persist the full page as one
   *  atomic draft. Keys are section IDs, values are section-specific
   *  configs. Stored in a ref (not state) so registration doesn't
   *  cause re-renders. */
  registerSectionState: (id: string, state: unknown) => void;
  getAllSectionState: () => Record<string, unknown>;

  /** Slot placement state — which slot each section renders in and
   *  what variant. Lives in state (not ref) so slot swaps trigger
   *  re-render + persist through auto-save. */
  placements: PagePlacements;
  registerPlacement: (
    sectionId: string,
    slotId: string,
    variant: string
  ) => void;
  moveSectionToSlot: (
    sectionId: string,
    targetSlotId: string,
    newVariant?: string
  ) => void;
  setSectionVariant: (sectionId: string, variant: string) => void;

  /** Which section is currently being dragged in reorder mode. Set
   *  by DragSectionHandle on pointerdown; cleared on pointerup. */
  draggingSectionId: string | null;
  setDraggingSectionId: (id: string | null) => void;
};

const EditModeContext = createContext<EditModeContextValue | null>(null);

export function useEditMode(): EditModeContextValue {
  const ctx = useContext(EditModeContext);
  if (!ctx) {
    throw new Error(
      "useEditMode must be used inside <LiveEditShell> — no EditModeContext"
    );
  }
  return ctx;
}

/** Non-throwing variant — safe to call outside a shell. Returns null
 *  when there's no shell (so EditableSection can render as passthrough
 *  in read-only contexts like public visitor views). */
export function useEditModeOptional(): EditModeContextValue | null {
  return useContext(EditModeContext);
}

export type EditModeProviderProps = {
  initialEditMode?: boolean;
  merchantId?: string | null;
  children: React.ReactNode;
};

export function EditModeProvider({
  initialEditMode = false,
  merchantId = null,
  children
}: EditModeProviderProps) {
  const [isEditMode, setIsEditMode] = useState(initialEditMode);
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [publishStatus, setPublishStatus] = useState<PublishStatus>("clean");
  const [hasUnsaved, setHasUnsaved] = useState(false);
  const [placements, setPlacements] = useState<PagePlacements>({});
  const [draggingSectionId, setDraggingSectionId] = useState<string | null>(
    null
  );

  const toggleEditMode = useCallback(() => {
    setIsEditMode((v) => {
      // Leaving edit mode also exits reorder mode.
      if (v) setIsReorderMode(false);
      return !v;
    });
  }, []);

  const toggleReorderMode = useCallback(() => {
    setIsReorderMode((v) => !v);
  }, []);

  const markDirty = useCallback(() => {
    setHasUnsaved(true);
    setPublishStatus("unsaved");
  }, []);

  const markClean = useCallback(() => {
    setHasUnsaved(false);
    setPublishStatus("clean");
  }, []);

  // Section registry lives in a ref so registrations don't trigger
  // re-renders on the whole tree.
  const sectionStates = useRef<Record<string, unknown>>({});
  const registerSectionState = useCallback((id: string, state: unknown) => {
    sectionStates.current[id] = state;
  }, []);
  const getAllSectionState = useCallback(
    () => ({ ...sectionStates.current }),
    []
  );

  /** Called by each EditableSection on mount to record its initial
   *  slot + variant. Idempotent — a section re-registering with the
   *  same values is a no-op so we don't churn state. */
  const registerPlacement = useCallback(
    (sectionId: string, slotId: string, variant: string) => {
      setPlacements((prev) => {
        const existing = prev[sectionId];
        if (
          existing &&
          existing.slotId === slotId &&
          existing.variant === variant
        ) {
          return prev;
        }
        return {
          ...prev,
          [sectionId]: { slotId, variant }
        };
      });
    },
    []
  );

  const moveSectionToSlot = useCallback(
    (sectionId: string, targetSlotId: string, newVariant?: string) => {
      setPlacements((prev) => {
        const existing = prev[sectionId];
        if (!existing) return prev;
        const next: SectionPlacement = {
          slotId: targetSlotId,
          variant: newVariant ?? existing.variant
        };
        if (
          existing.slotId === next.slotId &&
          existing.variant === next.variant
        ) {
          return prev;
        }
        return { ...prev, [sectionId]: next };
      });
      // Slot moves always mark the page dirty.
      setHasUnsaved(true);
      setPublishStatus("unsaved");
    },
    []
  );

  const setSectionVariant = useCallback(
    (sectionId: string, variant: string) => {
      setPlacements((prev) => {
        const existing = prev[sectionId];
        if (!existing) return prev;
        if (existing.variant === variant) return prev;
        return { ...prev, [sectionId]: { ...existing, variant } };
      });
      setHasUnsaved(true);
      setPublishStatus("unsaved");
    },
    []
  );

  const value = useMemo<EditModeContextValue>(
    () => ({
      merchantId,
      isEditMode,
      toggleEditMode,
      setEditMode: setIsEditMode,
      isReorderMode,
      toggleReorderMode,
      setReorderMode: setIsReorderMode,
      publishStatus,
      setPublishStatus,
      markDirty,
      markClean,
      hasUnsaved,
      registerSectionState,
      getAllSectionState,
      placements,
      registerPlacement,
      moveSectionToSlot,
      setSectionVariant,
      draggingSectionId,
      setDraggingSectionId
    }),
    [
      merchantId,
      isEditMode,
      isReorderMode,
      publishStatus,
      toggleEditMode,
      toggleReorderMode,
      markDirty,
      markClean,
      hasUnsaved,
      registerSectionState,
      getAllSectionState,
      placements,
      registerPlacement,
      moveSectionToSlot,
      setSectionVariant,
      draggingSectionId
    ]
  );

  return (
    <EditModeContext.Provider value={value}>
      {children}
    </EditModeContext.Provider>
  );
}
