// TabPicker — My rates / Get a quote 2-tab switch.

"use client";

import { Calculator, Wallet } from "lucide-react";

export type TrimTab = "quote" | "rates";

export type TabPickerProps = {
  tab: TrimTab;
  onChange: (t: TrimTab) => void;
};

export function TabPicker({ tab, onChange }: TabPickerProps) {
  return (
    <div className="flex gap-1 rounded-lg bg-neutral-100 p-1">
      <button
        type="button"
        onClick={() => onChange("quote")}
        className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[12px] font-medium transition ${
          tab === "quote"
            ? "bg-white text-neutral-900 shadow-sm"
            : "text-neutral-600 hover:text-neutral-900"
        }`}
      >
        <Calculator className="h-3.5 w-3.5" />
        Get a quote
      </button>
      <button
        type="button"
        onClick={() => onChange("rates")}
        className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[12px] font-medium transition ${
          tab === "rates"
            ? "bg-white text-neutral-900 shadow-sm"
            : "text-neutral-600 hover:text-neutral-900"
        }`}
      >
        <Wallet className="h-3.5 w-3.5" />
        My rates
      </button>
    </div>
  );
}
