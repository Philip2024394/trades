// SurfaceLists — sidebar-style list of elevations + rooms with
// include-toggle chips, active-highlight, +Add button.

"use client";

import { Home, Layers, Plus, Trash2 } from "lucide-react";
import { Button } from "@/platform/ui";
import type { Elevation, Room } from "../logic";

export type ElevationListProps = {
  elevations: Elevation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
};

export function ElevationList({
  elevations,
  activeId,
  onSelect,
  onAdd,
  onRemove
}: ElevationListProps) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5 text-neutral-500" />
          <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            External elevations ({elevations.length})
          </div>
        </div>
        <Button intent="ghost" size="sm" icon={Plus} onClick={onAdd}>
          Add
        </Button>
      </div>
      {elevations.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-200 bg-neutral-50 px-3 py-3 text-[11px] text-neutral-600">
          No elevations. Add front / back / gable.
        </div>
      ) : (
        <ul className="flex flex-col gap-1">
          {elevations.map((e) => {
            const isActive = e.id === activeId;
            return (
              <li key={e.id}>
                <div
                  className={`flex items-center gap-1 rounded-lg border p-1.5 transition ${
                    isActive
                      ? "border-amber-400 bg-amber-50"
                      : "border-neutral-200 bg-white hover:border-neutral-300"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSelect(e.id)}
                    className="flex-1 text-left"
                  >
                    <div className="text-[12px] font-semibold text-neutral-900">
                      {e.name}
                    </div>
                    <div className="text-[10px] text-neutral-500">
                      {e.wall_shape === "rect_gable" ? "Rect + gable" : "Rectangle"}
                      {" · "}
                      {e.include ? "in quote" : "excluded"}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemove(e.id)}
                    aria-label="Remove elevation"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-neutral-500 hover:bg-red-50 hover:text-red-700"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export type RoomListProps = {
  rooms: Room[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
};

export function RoomList({
  rooms,
  activeId,
  onSelect,
  onAdd,
  onRemove
}: RoomListProps) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Home className="h-3.5 w-3.5 text-neutral-500" />
          <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            Internal rooms ({rooms.length})
          </div>
        </div>
        <Button intent="ghost" size="sm" icon={Plus} onClick={onAdd}>
          Add
        </Button>
      </div>
      {rooms.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-200 bg-neutral-50 px-3 py-3 text-[11px] text-neutral-600">
          No rooms. Add living room / bedroom / hallway.
        </div>
      ) : (
        <ul className="flex flex-col gap-1">
          {rooms.map((r) => {
            const isActive = r.id === activeId;
            return (
              <li key={r.id}>
                <div
                  className={`flex items-center gap-1 rounded-lg border p-1.5 transition ${
                    isActive
                      ? "border-amber-400 bg-amber-50"
                      : "border-neutral-200 bg-white hover:border-neutral-300"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSelect(r.id)}
                    className="flex-1 text-left"
                  >
                    <div className="text-[12px] font-semibold text-neutral-900">
                      {r.name}
                    </div>
                    <div className="text-[10px] text-neutral-500">
                      {r.substrate === "solid" ? "Solid" : "Timber"}
                      {" · "}
                      {r.include ? "in quote" : "excluded"}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemove(r.id)}
                    aria-label="Remove room"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-neutral-500 hover:bg-red-50 hover:text-red-700"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
