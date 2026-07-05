// WallShapePicker — 2 illustrated cards side by side.
//
// User-requested: on gable selection show 2 designs so the customer
// knows what to enter:
//   A) rectangle only  — enter W × H
//   B) rectangle + triangle over — enter W × H rect + 3 triangle sides
//
// The illustrations are inline SVGs so they scale, print, and don't
// need image assets.

"use client";

import type { WallShape } from "../logic";

export type WallShapePickerProps = {
  value: WallShape;
  onChange: (v: WallShape) => void;
};

function RectDiagram({ active }: { active: boolean }) {
  const stroke = active ? "#b45309" : "#525252";
  const fill = active ? "#fef3c7" : "#f5f5f5";
  return (
    <svg
      viewBox="0 0 80 80"
      className="h-14 w-full"
      aria-hidden="true"
    >
      <rect
        x={12}
        y={20}
        width={56}
        height={50}
        fill={fill}
        stroke={stroke}
        strokeWidth={2}
        rx={2}
      />
      <line
        x1={12}
        y1={74}
        x2={68}
        y2={74}
        stroke={stroke}
        strokeWidth={1}
      />
      <text x={40} y={78} textAnchor="middle" fontSize={7} fill={stroke}>
        W
      </text>
      <line
        x1={72}
        y1={20}
        x2={72}
        y2={70}
        stroke={stroke}
        strokeWidth={1}
      />
      <text
        x={76}
        y={48}
        textAnchor="middle"
        fontSize={7}
        fill={stroke}
        transform="rotate(-90 76 48)"
      >
        H
      </text>
    </svg>
  );
}

function RectGableDiagram({ active }: { active: boolean }) {
  const stroke = active ? "#b45309" : "#525252";
  const fill = active ? "#fef3c7" : "#f5f5f5";
  return (
    <svg
      viewBox="0 0 80 80"
      className="h-14 w-full"
      aria-hidden="true"
    >
      {/* Triangle */}
      <polygon
        points="12,32 68,32 40,10"
        fill={fill}
        stroke={stroke}
        strokeWidth={2}
      />
      {/* Rect */}
      <rect
        x={12}
        y={32}
        width={56}
        height={38}
        fill={fill}
        stroke={stroke}
        strokeWidth={2}
      />
      {/* Triangle labels */}
      <text x={22} y={24} fontSize={6} fill={stroke}>
        L
      </text>
      <text x={54} y={24} fontSize={6} fill={stroke}>
        R
      </text>
      <text x={40} y={30} textAnchor="middle" fontSize={6} fill={stroke}>
        base
      </text>
      {/* Rect labels */}
      <text
        x={72}
        y={52}
        fontSize={7}
        fill={stroke}
        textAnchor="middle"
        transform="rotate(-90 72 52)"
      >
        H
      </text>
      <text x={40} y={78} textAnchor="middle" fontSize={7} fill={stroke}>
        W
      </text>
    </svg>
  );
}

export function WallShapePicker({ value, onChange }: WallShapePickerProps) {
  return (
    <div>
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
        Wall shape
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onChange("rect")}
          className={`flex flex-col items-center gap-1 rounded-xl border p-2 text-left transition ${
            value === "rect"
              ? "border-amber-400 bg-amber-50"
              : "border-neutral-200 bg-white hover:border-neutral-300"
          }`}
        >
          <RectDiagram active={value === "rect"} />
          <div className="w-full">
            <div className="text-[12px] font-semibold text-neutral-900">
              Rectangle
            </div>
            <div className="text-[10px] leading-tight text-neutral-600">
              Front / back / side wall · no gable
            </div>
          </div>
        </button>
        <button
          type="button"
          onClick={() => onChange("rect_gable")}
          className={`flex flex-col items-center gap-1 rounded-xl border p-2 text-left transition ${
            value === "rect_gable"
              ? "border-amber-400 bg-amber-50"
              : "border-neutral-200 bg-white hover:border-neutral-300"
          }`}
        >
          <RectGableDiagram active={value === "rect_gable"} />
          <div className="w-full">
            <div className="text-[12px] font-semibold text-neutral-900">
              Rectangle + gable
            </div>
            <div className="text-[10px] leading-tight text-neutral-600">
              Enter 3 triangle sides + rect W×H below
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
