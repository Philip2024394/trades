// ShoppingList — mortar-work complementary subcategories.

import {
  Droplet,
  Layers,
  Link,
  Package,
  Scissors,
  ShieldCheck
} from "lucide-react";
import type { ComponentType } from "react";

type Meta = { label: string; icon: ComponentType<{ className?: string }> };

const META: Record<string, Meta> = {
  lime: { label: "Hydrated lime (for softer mixes)", icon: Package },
  plasticiser: { label: "Mortar plasticiser", icon: Droplet },
  wall_tie: { label: "Wall ties (retro-fit if repointing cavity)", icon: Link },
  dpc: { label: "Damp-proof course (DPC)", icon: Layers },
  scraper: { label: "Repointing scraper / chisel", icon: Scissors },
  sandpaper: { label: "Wire brush + sandpaper", icon: Package },
  drop_sheet: { label: "Dust sheets / plastic cover", icon: Layers }
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
