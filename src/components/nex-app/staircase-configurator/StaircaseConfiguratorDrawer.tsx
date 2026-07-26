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
  /** When false, the drawer shows a "coming soon" badge and the 3D preview
   *  won't visibly change on selection. Prevents overpromising. Default true. */
  previewSupported?: boolean;
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
  onReset,
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
  /** Called when the user taps "Reset". Parent should restore the default
   *  configuration. Falsy hides the button. */
  onReset?: () => void;
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

      {/* Drawer panel — full-screen on all breakpoints per Philip's request.
          Slides in from the right so the transition still reads as a "drawer
          opening" rather than a hard page replacement. The inner content is
          capped to max-w-2xl and centred so the option list stays readable
          at desktop widths (a 100vw-wide option list would look absurd on
          a large monitor). */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="staircase-configurator-title"
        className={[
          "fixed inset-0 z-50 flex flex-col",
          "bg-card text-foreground shadow-2xl",
          "transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
          open ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
      >
        {/* Header — full-width bar with border, inner content centred so
            the title + close button don't drift to opposite edges of a wide monitor. */}
        <header className="border-b border-border">
          <div className="max-w-3xl w-full mx-auto px-5 py-4 flex items-center justify-between">
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
          </div>
        </header>

        {/* Category accordion list — inner container capped to 3xl so options
            stay readable on wide displays. */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl w-full mx-auto">
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
                                <div className="flex items-center gap-2">
                                  <span className="text-body-sm">{opt.label}</span>
                                  {opt.previewSupported === false && (
                                    <span className="text-caption uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                                      Soon
                                    </span>
                                  )}
                                </div>
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
        </div>

        {/* Footer — same max-width centring so buttons sit under the option list. */}
        <footer className="border-t border-border">
          <div className="max-w-3xl w-full mx-auto px-5 py-4 flex items-center gap-2">
            {onReset && (
              <button
                type="button"
                onClick={onReset}
                className="h-11 px-4 rounded-md border border-border text-body-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                Reset
              </button>
            )}
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
          </div>
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
    description: "Overall staircase shape and direction (UK / Ireland standards)",
    options: [
      { id: "straight",          label: "Straight flight",              description: "Single run, no turns · most common domestic layout" },
      { id: "quarter-landing",   label: "Quarter landing",              description: "90° turn using a flat landing platform · L-plan · skeleton" },
      { id: "l-shape",           label: "L-shape (winder turn)",        description: "90° turn using 3 winder wedges (no landing) · skeleton" },
      { id: "half-landing",      label: "Half landing (dogleg)",        description: "180° turn with a half-space landing · flights parallel · skeleton" },
      { id: "u-shape",           label: "U-shape (open well)",          description: "180° turn with a wider landing · gap between flights · skeleton" },
      { id: "double-winder",     label: "Double winder",                description: "Winders at both bottom and top for switch-back · skeleton" },
      { id: "winder-entry",      label: "Winder at bottom",             description: "Turn at the entry, straight above · skeleton" },
      { id: "winder-halfway",    label: "Winder halfway",               description: "Straight bottom, winder turn mid-flight, straight top · skeleton" },
      { id: "winder-top",        label: "Winder at top",                description: "Straight bottom, winder turn at the top · skeleton" },
      { id: "t-shape",           label: "T-shape (bifurcated)",         description: "Single flight splits into two at a landing · skeleton" },
      { id: "curved",            label: "Curved (arc)",                 description: "Gently curved plan without discrete landing · skeleton" },
      { id: "spiral",            label: "Spiral",                       description: "Helical treads around a central column · skeleton" },
      { id: "ladder",            label: "Ladder / space-saver",         description: "Steep alternating-tread stair for loft access · skeleton" },
    ],
  },
  {
    id: "strings",
    label: "Strings",
    description: "Side beams supporting the treads",
    options: [
      { id: "housed-closed", label: "Housed / closed string", description: "Treads slot into routed housings" },
      { id: "cut-open",      label: "Cut / open string",       description: "Tread ends visible", previewSupported: false },
      { id: "wall-string",   label: "Wall string",              description: "String against a wall", previewSupported: false },
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
      { id: "square-120",    label: "120mm Square",             description: "Heavy traditional", previewSupported: false },
      { id: "turned",        label: "Turned",                    description: "Lathe-turned traditional", previewSupported: false },
      { id: "square-cap",    label: "Square cap",               description: "Modern flat cap", previewSupported: false },
      { id: "pyramid-cap",   label: "Pyramid cap",              description: "Traditional pyramid", previewSupported: false },
    ],
  },
  {
    id: "handrails",
    label: "Handrails + Baserails",
    description: "Top rail (handrail) and bottom rail (baserail)",
    options: [
      { id: "profile-41",    label: "41mm grooved (standard UK)",  description: "Current UK / Ireland standard" },
      { id: "profile-44",    label: "44mm grooved (traditional)",  description: "Traditional profile", previewSupported: false },
      { id: "profile-50",    label: "50mm heavy",                  description: "Requires 50mm balusters", previewSupported: false },
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
      { id: "square-plain",    label: "Plain square 41mm",           description: "No chamfer", previewSupported: false },
      { id: "glass-panel",     label: "Glass panel",                 description: "Toughened 10mm", previewSupported: false },
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
