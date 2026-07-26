"use client";

// StaircaseConfiguratorDrawer — mobile-first slide-over drawer that lists every
// customisable component category of a Nex staircase (Layout / Strings / Steps /
// Risers / Newel Posts / Handrails + Baserails / Balusters / Sheeting / LEDs / Finish).
// Each category is an accordion row that expands to show its options. Selecting an
// option calls back to the parent so the 3D preview can update.
//
// Consumes the platform's shadcn/Tailwind semantic tokens (bg-card, bg-background,
// text-foreground, border-border, etc.) — merchants theming Nex swap the underlying
// CSS variables and this drawer picks them up automatically. No hardcoded colours.
//
// Cross-device: same component on mobile, tablet, desktop. Slide-over overlay style
// on every breakpoint (max width capped at 92vw on mobile, 400px on tablet/desktop).

import { useEffect, useState } from "react";
import { X, ChevronDown, Check } from "lucide-react";

export type ComponentOption = {
  id: string;
  label: string;
  description?: string;
  /** Optional colour swatch or thumbnail URL rendered at 32×32 next to the label. */
  swatch?: string;
  thumbnailUrl?: string;
};

export type ComponentCategory = {
  id: string;
  label: string;
  /** Short helper text under the label. */
  description?: string;
  options: ComponentOption[];
};

type SelectedValues = Record<string, string>;

export function StaircaseConfiguratorDrawer({
  open,
  onOpenChange,
  categories,
  selected,
  onChange,
  onSaveDesign,
  title = "Customise Staircase",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: ComponentCategory[];
  selected: SelectedValues;
  onChange: (categoryId: string, optionId: string) => void;
  /** Called when the user taps "Save Design" in the footer. Parent should
   *  snapshot the current selection and persist it. */
  onSaveDesign?: () => void;
  title?: string;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(
    categories[0]?.id ?? null
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    // Scroll-lock body while drawer is open (mobile UX).
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onOpenChange]);

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden={!open}
        onClick={() => onOpenChange(false)}
        className={[
          "fixed inset-0 z-40 bg-foreground/40 backdrop-blur-sm",
          "transition-opacity duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
          open ? "opacity-100" : "opacity-0 pointer-events-none",
        ].join(" ")}
      />

      {/* Drawer panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="staircase-configurator-title"
        className={[
          "fixed inset-y-0 right-0 z-50 flex flex-col",
          "w-[92vw] max-w-[400px] bg-card text-foreground border-l border-border shadow-2xl",
          "transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
          open ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
      >
        {/* Header */}
        <header className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <p className="text-eyebrow uppercase text-muted-foreground">Configurator</p>
            <h2 id="staircase-configurator-title" className="text-heading-md font-heading">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close configurator"
            className="w-9 h-9 grid place-items-center rounded-full hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* Category accordion list */}
        <div className="flex-1 overflow-y-auto">
          <ul className="divide-y divide-border">
            {categories.map((cat) => {
              const isExpanded = expandedId === cat.id;
              const selectedOption = cat.options.find((o) => o.id === selected[cat.id]);
              return (
                <li key={cat.id}>
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : cat.id)}
                    aria-expanded={isExpanded}
                    className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-body-md font-medium">{cat.label}</span>
                        {selectedOption && (
                          <span className="text-caption text-muted-foreground truncate">
                            · {selectedOption.label}
                          </span>
                        )}
                      </div>
                      {cat.description && !isExpanded && (
                        <p className="text-caption text-muted-foreground mt-0.5 truncate">
                          {cat.description}
                        </p>
                      )}
                    </div>
                    <ChevronDown
                      className={[
                        "w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200",
                        isExpanded ? "rotate-180" : "",
                      ].join(" ")}
                    />
                  </button>

                  {isExpanded && (
                    <ul className="pb-3">
                      {cat.options.map((opt) => {
                        const isSelected = selected[cat.id] === opt.id;
                        return (
                          <li key={opt.id}>
                            <button
                              type="button"
                              onClick={() => onChange(cat.id, opt.id)}
                              aria-pressed={isSelected}
                              className={[
                                "w-full flex items-center gap-3 pl-5 pr-4 py-2.5 text-left transition-colors",
                                isSelected ? "bg-accent/20" : "hover:bg-muted/40",
                              ].join(" ")}
                            >
                              {(opt.swatch || opt.thumbnailUrl) && (
                                <span
                                  aria-hidden="true"
                                  className="w-8 h-8 rounded-full border border-border shrink-0 bg-cover bg-center"
                                  style={{
                                    background: opt.thumbnailUrl
                                      ? `url(${opt.thumbnailUrl}) center/cover`
                                      : opt.swatch,
                                  }}
                                />
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="text-body-sm">{opt.label}</div>
                                {opt.description && (
                                  <div className="text-caption text-muted-foreground truncate">
                                    {opt.description}
                                  </div>
                                )}
                              </div>
                              {isSelected && (
                                <Check className="w-4 h-4 text-accent-foreground shrink-0" />
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        {/* Footer */}
        <footer className="px-5 py-4 border-t border-border flex items-center gap-3">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="flex-1 h-11 rounded-md border border-border text-body-sm font-medium hover:bg-muted transition-colors"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => onSaveDesign?.()}
            disabled={!onSaveDesign}
            className="flex-1 h-11 rounded-md bg-primary text-primary-foreground text-body-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Save Design
          </button>
        </footer>
      </aside>
    </>
  );
}

/** Default sample categories — replace with catalogue-driven data in production. */
export const SAMPLE_STAIRCASE_CATEGORIES: ComponentCategory[] = [
  {
    id: "layout",
    label: "Layout",
    description: "Overall staircase shape and direction",
    options: [
      { id: "straight",     label: "Straight flight",         description: "Single run, no turns" },
      { id: "l-shape",      label: "L-shape (quarter turn)",  description: "90° turn with landing" },
      { id: "u-shape",      label: "U-shape (half turn)",     description: "180° turn with landing" },
      { id: "winder",       label: "Winder",                  description: "Turn without landing" },
      { id: "spiral",       label: "Spiral",                  description: "Central column" },
    ],
  },
  {
    id: "strings",
    label: "Strings",
    description: "Side beams supporting the treads",
    options: [
      { id: "housed-closed", label: "Housed / closed string", description: "Treads slot into routed housings" },
      { id: "cut-open",      label: "Cut / open string",       description: "Tread ends visible" },
      { id: "wall-string",   label: "Wall string",              description: "String against a wall" },
    ],
  },
  {
    id: "steps",
    label: "Steps (treads)",
    description: "The walking surface",
    options: [
      { id: "oak-40",     label: "40mm American White Oak",  swatch: "#c9a878" },
      { id: "oak-32",     label: "32mm American White Oak",  swatch: "#c9a878" },
      { id: "walnut-40",  label: "40mm European Walnut",     swatch: "#5c3a1e" },
      { id: "ash-40",     label: "40mm Ash",                  swatch: "#e0cba0" },
    ],
  },
  {
    id: "risers",
    label: "Risers",
    description: "Vertical face between steps",
    options: [
      { id: "matching",     label: "Matching timber",           description: "Same species as treads" },
      { id: "white-paint",  label: "White painted",             swatch: "#f5f2ec" },
      { id: "open",         label: "Open (no risers)",          description: "Contemporary look" },
    ],
  },
  {
    id: "newels",
    label: "Newel posts",
    description: "Corner and end posts",
    options: [
      { id: "square-90",     label: "90mm Square",              description: "Standard modern" },
      { id: "square-120",    label: "120mm Square",             description: "Heavy traditional" },
      { id: "turned",        label: "Turned",                    description: "Lathe-turned traditional" },
      { id: "square-cap",    label: "Square cap",               description: "Modern flat cap" },
      { id: "pyramid-cap",   label: "Pyramid cap",              description: "Traditional pyramid" },
    ],
  },
  {
    id: "handrails",
    label: "Handrails + Baserails",
    description: "Top rail (handrail) and bottom rail (baserail)",
    options: [
      { id: "profile-41",    label: "41mm grooved (standard UK)",  description: "Current UK / Ireland standard" },
      { id: "profile-44",    label: "44mm grooved (traditional)",  description: "Traditional profile" },
      { id: "profile-50",    label: "50mm heavy",                  description: "Requires 50mm balusters" },
    ],
  },
  {
    id: "balusters",
    label: "Balusters",
    description: "Vertical spindles between rails",
    options: [
      { id: "oak-chamfered",   label: "Oak fully-chamfered 41mm",   swatch: "#c9a878" },
      { id: "white-chamfered", label: "White sprayed 41mm",         swatch: "#f5f2ec" },
      { id: "cream-chamfered", label: "Cream sprayed 41mm",         swatch: "#f0e2c1" },
      { id: "square-plain",    label: "Plain square 41mm",           description: "No chamfer" },
      { id: "glass-panel",     label: "Glass panel",                 description: "Toughened 10mm" },
    ],
  },
  {
    id: "sheeting",
    label: "Under-stair finish",
    description: "How the back / underside is closed",
    options: [
      { id: "unfinished",   label: "Unfinished",           description: "Open underside" },
      { id: "tg",           label: "T&G matching timber",   description: "Same species as staircase" },
      { id: "panelling",    label: "Traditional panelling", description: "Framed panels" },
      { id: "plasterboard", label: "Plasterboard",           description: "Ready for paint" },
    ],
  },
  {
    id: "lighting",
    label: "LED lighting",
    description: "Tread-nose or stringer lighting",
    options: [
      { id: "off",            label: "No lighting" },
      { id: "tread-nose",     label: "Tread nose strip",     description: "Under each bullnose" },
      { id: "stringer",       label: "Stringer wash",        description: "Along top of string" },
      { id: "both",           label: "Both",                  description: "Full stair lighting" },
    ],
  },
  {
    id: "finish",
    label: "Finish",
    description: "Surface treatment on exposed timber",
    options: [
      { id: "varnish-clear",  label: "Clear varnish",  description: "Natural timber tone" },
      { id: "oil-matte",      label: "Matte oil",       description: "Natural, low sheen" },
      { id: "stain-walnut",   label: "Walnut stain",    swatch: "#5c3a1e" },
      { id: "stain-black",    label: "Black stain",     swatch: "#2a2422" },
      { id: "white-painted",  label: "White painted",   swatch: "#f5f2ec" },
    ],
  },
];
