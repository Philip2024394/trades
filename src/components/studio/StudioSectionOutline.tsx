"use client";

// StudioSectionOutline — drag-drop row list for the layout editor.
//
// Renders every top-level row from the current draft layout as a
// draggable card. Merchant grabs the handle, drags to reorder,
// releases to commit. Wraps the existing `reorderRow` reducer through
// the `onReorder(fromRowId, toRowId)` callback.
//
// Sits above StudioTreeNavigator in the editor aside so merchants can
// SHUFFLE the whole page in seconds instead of clicking ▲/▼ chips one
// step at a time.

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import type { StudioLayoutJson } from "@/lib/studio/schema";

const YELLOW = "#FFB300";

type Props = {
  layout: StudioLayoutJson;
  selectedInstanceId: string | null;
  onSelect: (instanceId: string) => void;
  onReorder: (fromRowId: string, toRowId: string) => void;
};

export function StudioSectionOutline({
  layout,
  selectedInstanceId,
  onSelect,
  onReorder
}: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      // 4 px activation distance stops the drag from firing when the
      // user just wants to click a row to select it.
      activationConstraint: { distance: 4 }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  );

  if (layout.rows.length === 0) {
    return (
      <div className="border-b border-neutral-200 px-4 py-6 text-center">
        <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-400">
          Sections
        </p>
        <p className="mt-2 text-[11px] text-neutral-500">
          No sections yet. Add one from the App Warehouse.
        </p>
      </div>
    );
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    onReorder(String(active.id), String(over.id));
  }

  return (
    <div>
      <header className="border-b border-neutral-200 px-4 py-3">
        <p
          className="text-[10px] font-extrabold uppercase tracking-widest"
          style={{ color: YELLOW }}
        >
          Sections
        </p>
        <p className="mt-0.5 text-[11px] font-bold text-neutral-500">
          Drag to reorder · {layout.rows.length} row
          {layout.rows.length === 1 ? "" : "s"}
        </p>
      </header>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={layout.rows.map((r) => r.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="m-0 flex list-none flex-col gap-1 px-2 pb-3">
            {layout.rows.map((row, index) => {
              const sections = row.columns
                .map((iid) =>
                  layout.sections.find((s) => s.instanceId === iid)
                )
                .filter((s): s is NonNullable<typeof s> => Boolean(s));
              const rowSelected = sections.some(
                (s) => s.instanceId === selectedInstanceId
              );
              return (
                <SortableRow
                  key={row.id}
                  rowId={row.id}
                  index={index}
                  sections={sections}
                  selected={rowSelected}
                  selectedInstanceId={selectedInstanceId}
                  onSelect={onSelect}
                />
              );
            })}
          </ul>
        </SortableContext>
      </DndContext>
    </div>
  );
}

// ─── Sortable row card ────────────────────────────────────────

function SortableRow({
  rowId,
  index,
  sections,
  selected,
  selectedInstanceId,
  onSelect
}: {
  rowId: string;
  index: number;
  sections: Array<{ instanceId: string; key: string }>;
  selected: boolean;
  selectedInstanceId: string | null;
  onSelect: (instanceId: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: rowId });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
    background: selected ? "rgba(255,179,0,0.14)" : "white",
    borderColor: selected ? YELLOW : "#E5E5E5"
  };

  return (
    <li ref={setNodeRef} style={style} className="rounded-lg border">
      <div className="flex items-stretch">
        <button
          type="button"
          aria-label={`Drag row ${index + 1}`}
          {...attributes}
          {...listeners}
          className="grid w-7 shrink-0 cursor-grab place-items-center rounded-l-lg border-r border-neutral-200 bg-neutral-50 text-neutral-400 hover:bg-neutral-100 active:cursor-grabbing"
        >
          <GripVertical className="h-3.5 w-3.5" aria-hidden />
        </button>
        <div className="min-w-0 flex-1 px-2 py-1.5">
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-400">
            Row {index + 1}
            {sections.length > 1 && ` · ${sections.length} cols`}
          </p>
          <div className="mt-1 flex flex-col gap-0.5">
            {sections.map((s) => {
              const isSelected = s.instanceId === selectedInstanceId;
              return (
                <button
                  key={s.instanceId}
                  type="button"
                  onClick={() => onSelect(s.instanceId)}
                  className="truncate rounded px-1.5 py-0.5 text-left text-[11.5px] font-semibold transition"
                  style={{
                    background: isSelected ? YELLOW : "transparent",
                    color: isSelected ? "#0A0A0A" : "#404040"
                  }}
                >
                  {prettySectionKey(s.key)}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </li>
  );
}

function prettySectionKey(key: string): string {
  // "trade.hero" → "Trade / Hero"; "hero-primary" → "Hero primary".
  const withSlash = key.replace(/\./g, " / ");
  const withSpaces = withSlash.replace(/[-_]/g, " ");
  return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
}
