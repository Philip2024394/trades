// TabPicker — Public view / My delivery 2-tab switch.

"use client";

import { Eye, Settings } from "lucide-react";

export type DeliveryTab = "public" | "config";

export type TabPickerProps = {
  tab: DeliveryTab;
  onChange: (t: DeliveryTab) => void;
};

export function TabPicker({ tab, onChange }: TabPickerProps) {
  return (
    <div className="flex gap-1 rounded-lg bg-neutral-100 p-1">
      <button
        type="button"
        onClick={() => onChange("public")}
        className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[12px] font-medium transition ${
          tab === "public"
            ? "bg-white text-neutral-900 shadow-sm"
            : "text-neutral-600 hover:text-neutral-900"
        }`}
      >
        <Eye className="h-3.5 w-3.5" />
        Public view
      </button>
      <button
        type="button"
        onClick={() => onChange("config")}
        className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[12px] font-medium transition ${
          tab === "config"
            ? "bg-white text-neutral-900 shadow-sm"
            : "text-neutral-600 hover:text-neutral-900"
        }`}
      >
        <Settings className="h-3.5 w-3.5" />
        My delivery
      </button>
    </div>
  );
}
