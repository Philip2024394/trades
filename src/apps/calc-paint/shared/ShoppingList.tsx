// ShoppingList — shows the complementary subcategories the paint
// calculator recommends buying alongside the paint itself.
//
// The subcategory slugs come from paintComplementarySubcategories().
// This component maps each to a human label + icon; a real merchant
// integration would query products in these subcategories.

import {
  Brush,
  Circle,
  Container,
  Droplet,
  FileText,
  ImageOff,
  PaintBucket,
  Scissors,
  ScrollText,
  ShieldCheck,
  Wrench
} from "lucide-react";
import type { ComponentType } from "react";

type SubcategoryMeta = {
  label: string;
  icon: ComponentType<{ className?: string }>;
};

const META: Record<string, SubcategoryMeta> = {
  paint_brush: { label: "Brushes", icon: Brush },
  paint_roller: { label: "Rollers + sleeves", icon: Circle },
  paint_tray: { label: "Trays + liners", icon: Container },
  drop_sheet: { label: "Dust sheets", icon: ImageOff },
  masking_tape: { label: "Masking tape", icon: ScrollText },
  sandpaper: { label: "Sandpaper", icon: Wrench },
  filler: { label: "Filler", icon: FileText },
  primer: { label: "Primer", icon: PaintBucket },
  scraper: { label: "Scrapers", icon: Scissors },
  exterior_paint: { label: "Exterior paint", icon: PaintBucket },
  fence_paint: { label: "Fence treatment", icon: PaintBucket },
  paint_thinner: { label: "Paint thinner", icon: Droplet }
};

export type ShoppingListProps = {
  subcategories: readonly string[];
  /** Rendering density. */
  density?: "chips" | "list";
};

export function ShoppingList({
  subcategories,
  density = "chips"
}: ShoppingListProps) {
  const items = subcategories
    .map((slug) => META[slug])
    .filter((m): m is SubcategoryMeta => Boolean(m));
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
