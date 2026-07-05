// OpeningsEditor — add/edit/remove windows + doors on a wall or room.
//
// Feeds the beading engine automatically:
//   - windows/vents → window bead meters (top + 2 sides)
//   - all door types → door bead meters (top + 2 sides)

"use client";

import { Plus, Trash2 } from "lucide-react";
import type { ChangeEvent } from "react";
import { Button, Select, TextInput } from "@/platform/ui";
import { OPENING_LABEL } from "../logic";
import type { Opening, OpeningType } from "../logic";

const OPENING_ORDER: OpeningType[] = [
  "window",
  "single_door",
  "double_door",
  "sliding_door",
  "patio_door",
  "vent"
];

export type OpeningsEditorProps = {
  openings: Opening[];
  onAdd: (type: OpeningType) => void;
  onPatch: (id: string, patch: Partial<Opening>) => void;
  onRemove: (id: string) => void;
};

export function OpeningsEditor({
  openings,
  onAdd,
  onPatch,
  onRemove
}: OpeningsEditorProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
          Openings ({openings.length})
        </div>
        <Button
          intent="ghost"
          size="sm"
          onClick={() => onAdd("window")}
          type="button"
          icon={Plus}
        >
          Add opening
        </Button>
      </div>
      {openings.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-200 bg-neutral-50 px-3 py-3 text-[11px] text-neutral-600">
          No windows or doors on this surface. Add one to reduce area and
          include automatic beading.
        </div>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {openings.map((o) => (
            <li
              key={o.id}
              className="rounded-lg border border-neutral-200 bg-white p-2"
            >
              <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,0.6fr)_auto] gap-1.5">
                <Select
                  id={`op-type-${o.id}`}
                  value={o.type}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                    onPatch(o.id, {
                      type: e.currentTarget.value as OpeningType
                    })
                  }
                  options={OPENING_ORDER.map((t) => ({
                    value: t,
                    label: OPENING_LABEL[t]
                  }))}
                />
                <TextInput
                  id={`op-w-${o.id}`}
                  type="number"
                  value={String(o.width_m)}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    onPatch(o.id, {
                      width_m: parseFloat(e.currentTarget.value) || 0
                    })
                  }
                  min={0.1}
                  step={0.1}
                  suffix={
                    <span className="text-[10px] font-medium text-neutral-500">
                      W m
                    </span>
                  }
                />
                <TextInput
                  id={`op-h-${o.id}`}
                  type="number"
                  value={String(o.height_m)}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    onPatch(o.id, {
                      height_m: parseFloat(e.currentTarget.value) || 0
                    })
                  }
                  min={0.1}
                  step={0.1}
                  suffix={
                    <span className="text-[10px] font-medium text-neutral-500">
                      H m
                    </span>
                  }
                />
                <TextInput
                  id={`op-c-${o.id}`}
                  type="number"
                  value={String(o.count)}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    onPatch(o.id, {
                      count: Math.max(1, parseInt(e.currentTarget.value) || 1)
                    })
                  }
                  min={1}
                  step={1}
                  suffix={
                    <span className="text-[10px] font-medium text-neutral-500">
                      ×
                    </span>
                  }
                />
                <button
                  type="button"
                  onClick={() => onRemove(o.id)}
                  aria-label="Remove opening"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-neutral-500 hover:bg-red-50 hover:text-red-700"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
