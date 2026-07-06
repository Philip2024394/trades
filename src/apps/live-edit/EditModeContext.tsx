// EditModeContext — provides the isEditMode flag + toggle to every
// EditableSection under the LiveEditShell. Also tracks unsaved
// draft state so the Publish button knows when to enable.

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

type EditModeContextValue = {
  isEditMode: boolean;
  toggleEditMode: () => void;
  setEditMode: (v: boolean) => void;

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
  children: React.ReactNode;
};

export function EditModeProvider({
  initialEditMode = false,
  children
}: EditModeProviderProps) {
  const [isEditMode, setIsEditMode] = useState(initialEditMode);
  const [publishStatus, setPublishStatus] = useState<PublishStatus>("clean");
  const [hasUnsaved, setHasUnsaved] = useState(false);

  const toggleEditMode = useCallback(() => {
    setIsEditMode((v) => !v);
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

  const value = useMemo<EditModeContextValue>(
    () => ({
      isEditMode,
      toggleEditMode,
      setEditMode: setIsEditMode,
      publishStatus,
      setPublishStatus,
      markDirty,
      markClean,
      hasUnsaved,
      registerSectionState,
      getAllSectionState
    }),
    [
      isEditMode,
      publishStatus,
      toggleEditMode,
      markDirty,
      markClean,
      hasUnsaved,
      registerSectionState,
      getAllSectionState
    ]
  );

  return (
    <EditModeContext.Provider value={value}>
      {children}
    </EditModeContext.Provider>
  );
}
