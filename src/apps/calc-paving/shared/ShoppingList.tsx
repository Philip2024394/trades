// ShoppingList — paving-install complementary subcategories.

import {
  Layers,
  Package,
  Scissors,
  ShieldCheck,
  Sparkles,
  Waves
} from "lucide-react";
import type { ComponentType } from "react";

type Meta = { label: string; icon: ComponentType<{ className?: string }> };

const META: Record<string, Meta> = {
  pointing_mortar: { label: "Pointing mortar", icon: Package },
  sub_base: { label: "MOT Type 1 sub-base", icon: Layers },
  sharp_sand: { label: "Sharp sand (50 mm bed)", icon: Waves },
  jointing_compound: { label: "Jointing compound", icon: Sparkles },
  weed_membrane: { label: "Weed membrane", icon: Scissors },
  lawn_edging: { label: "Lawn edging strip", icon: Scissors }
};

export type ShoppingListProps = {
  subcategories: readonly string[];
  density?: "chips" | "list";
};

export function ShoppingList({
  subcategories,
  density = "chips"
}: ShoppingListProps) {
  const items = subcategories
    .map((s) => META[s])
    .filter((m): m is Meta => Boolean(m));
  if (!items.length) return null;

  if (density === "list") {
    return (
      <div>
        <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
          <ShieldCheck className="h-3 w-3" />
          Shopping list
        </div>
        <ul className="flex flex-col gap-1">
          {items.map((m, i) => {
            const Icon = m.icon;
            return (
              <li
                key={i}
                className="flex items-center gap-2 rounded-md bg-neutral-50 px-2 py-1.5 text-[12px] text-neutral-700"
              >
                <Icon className="h-3.5 w-3.5 text-neutral-500" />
                {m.label}
              </li>
            );
          })}
        </ul>
      </div>
    );
  }
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
        <ShieldCheck className="h-3 w-3" />
        Also buy
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((m, i) => {
          const Icon = m.icon;
          return (
            <span
              key={i}
              className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-700"
            >
              <Icon className="h-3 w-3" />
              {m.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}
