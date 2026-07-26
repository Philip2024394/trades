"use client";

// StaircaseDesignSheet — bottom sheet ("slider up") that lists Nex Designs
// (curated presets) and Saved Designs (user's own). Selecting a design applies
// its complete configuration to the state in one shot, replacing whatever the
// user had customised.
//
// Slide-up from bottom, same on mobile / tablet / desktop. Height caps at 85vh
// on mobile so the 3D preview stays partially visible above it. Backdrop with
// blur, click-to-close, ESC key, body scroll-lock.
//
// Consumes shadcn tokens throughout — merchants theme by swapping CSS variables.

import { useEffect } from "react";
import { X, Sparkles, Bookmark, Check, Pencil, Trash2 } from "lucide-react";

export type StaircaseDesign = {
  id: string;
  name: string;
  description?: string;
  thumbnailUrl?: string;
  /** Complete config: categoryId → optionId. */
  config: Record<string, string>;
  /** "nex" = curated Nex-branded preset. "saved" = user's own saved design. */
  origin: "nex" | "saved";
};

export function StaircaseDesignSheet({
  open,
  onOpenChange,
  designs,
  currentConfig,
  onApplyDesign,
  onRenameSavedDesign,
  onDeleteSavedDesign,
  title = "Choose a design",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  designs: StaircaseDesign[];
  currentConfig: Record<string, string>;
  onApplyDesign: (design: StaircaseDesign) => void;
  /** User tapped rename on a saved design. Parent handles the prompt + persistence. */
  onRenameSavedDesign?: (id: string) => void;
  /** User tapped delete on a saved design. Parent handles confirm + persistence. */
  onDeleteSavedDesign?: (id: string) => void;
  title?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onOpenChange]);

  const saved = designs.filter((d) => d.origin === "saved");
  const nex   = designs.filter((d) => d.origin === "nex");

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

      {/* Sheet panel */}
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="staircase-design-sheet-title"
        className={[
          "fixed inset-x-0 bottom-0 z-50 flex flex-col",
          "bg-card text-foreground border-t border-border shadow-2xl",
          "rounded-t-2xl",
          "max-h-[85vh] sm:max-h-[80vh]",
          "transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
          open ? "translate-y-0" : "translate-y-full",
        ].join(" ")}
      >
        {/* Drag handle affordance */}
        <div className="pt-3 pb-1 flex justify-center shrink-0">
          <span
            aria-hidden="true"
            className="w-10 h-1 rounded-full bg-border"
          />
        </div>

        {/* Header */}
        <header className="flex items-center justify-between px-5 pb-3 border-b border-border shrink-0">
          <div>
            <p className="text-eyebrow uppercase text-muted-foreground">Designs</p>
            <h2 id="staircase-design-sheet-title" className="text-heading-md font-heading">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close designs"
            className="w-9 h-9 grid place-items-center rounded-full hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* Sections */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {saved.length > 0 && (
            <DesignSection
              label="Your saved designs"
              icon={<Bookmark className="w-4 h-4" />}
              designs={saved}
              currentConfig={currentConfig}
              onApply={onApplyDesign}
              onClose={() => onOpenChange(false)}
              onRename={onRenameSavedDesign}
              onDelete={onDeleteSavedDesign}
            />
          )}

          {nex.length > 0 && (
            <DesignSection
              label="Nex Designs"
              icon={<Sparkles className="w-4 h-4 text-primary" />}
              designs={nex}
              currentConfig={currentConfig}
              onApply={onApplyDesign}
              onClose={() => onOpenChange(false)}
            />
          )}

          {designs.length === 0 && (
            <p className="text-body-sm text-muted-foreground py-8 text-center">
              No designs yet. Configure a staircase then save it here.
            </p>
          )}
        </div>
      </section>
    </>
  );
}

function DesignSection({
  label,
  icon,
  designs,
  currentConfig,
  onApply,
  onClose,
  onRename,
  onDelete,
}: {
  label: string;
  icon: React.ReactNode;
  designs: StaircaseDesign[];
  currentConfig: Record<string, string>;
  onApply: (d: StaircaseDesign) => void;
  onClose: () => void;
  onRename?: (id: string) => void;
  onDelete?: (id: string) => void;
}) {
  const canManage = !!onRename || !!onDelete;
  return (
    <div className="mb-6 last:mb-0">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className="text-body-sm font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </h3>
      </div>
      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {designs.map((d) => {
          const isActive = matchesConfig(d.config, currentConfig);
          return (
            <li key={d.id} className="relative group">
              <button
                type="button"
                onClick={() => {
                  onApply(d);
                  onClose();
                }}
                aria-pressed={isActive}
                className={[
                  "w-full text-left rounded-lg border overflow-hidden transition-all",
                  "hover:shadow-md hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-primary",
                  isActive
                    ? "border-primary ring-1 ring-primary bg-accent/10"
                    : "border-border bg-card",
                ].join(" ")}
              >
                <div
                  className="aspect-[4/3] bg-muted bg-cover bg-center relative"
                  style={
                    d.thumbnailUrl ? { backgroundImage: `url(${d.thumbnailUrl})` } : undefined
                  }
                >
                  {!d.thumbnailUrl && (
                    <div className="absolute inset-0 grid place-items-center text-caption text-muted-foreground">
                      Preview
                    </div>
                  )}
                  {isActive && (
                    <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-primary text-primary-foreground grid place-items-center">
                      <Check className="w-3.5 h-3.5" />
                    </span>
                  )}
                </div>
                <div className="p-3">
                  <div className="text-body-sm font-medium">{d.name}</div>
                  {d.description && (
                    <div className="text-caption text-muted-foreground mt-0.5 line-clamp-2">
                      {d.description}
                    </div>
                  )}
                </div>
              </button>

              {/* Manage actions — rename + delete. Visible always on mobile
                  (no hover); fade in on hover on desktop so they don't clutter
                  the card grid. */}
              {canManage && (
                <div className="absolute top-2 left-2 flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  {onRename && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRename(d.id);
                      }}
                      aria-label={`Rename ${d.name}`}
                      className="w-8 h-8 grid place-items-center rounded-full bg-card/95 text-foreground border border-border shadow hover:bg-card"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {onDelete && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(d.id);
                      }}
                      aria-label={`Delete ${d.name}`}
                      className="w-8 h-8 grid place-items-center rounded-full bg-card/95 text-destructive border border-border shadow hover:bg-destructive/10"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function matchesConfig(a: Record<string, string>, b: Record<string, string>): boolean {
  const keys = Object.keys(a);
  if (keys.length === 0) return false;
  for (const k of keys) if (a[k] !== b[k]) return false;
  return true;
}

/** Sample Nex Designs — curated presets that exercise the SAMPLE_STAIRCASE_CATEGORIES.
 *  Replace with catalogue-driven data in production. */
export const SAMPLE_NEX_DESIGNS: StaircaseDesign[] = [
  {
    id: "nex-modern-luxury",
    name: "Modern Luxury",
    description: "Walnut treads, glass balusters, LED lighting throughout",
    origin: "nex",
    config: {
      layout:    "straight",
      strings:   "cut-open",
      steps:     "walnut-40",
      risers:    "open",
      newels:    "square-cap",
      handrails: "profile-41",
      balusters: "glass-panel",
      sheeting:  "unfinished",
      lighting:  "both",
      finish:    "oil-matte",
    },
  },
  {
    id: "nex-traditional-english",
    name: "Traditional English",
    description: "Oak throughout, turned newels, chamfered oak balusters, T&G under-stair",
    origin: "nex",
    config: {
      layout:    "l-shape",
      strings:   "housed-closed",
      steps:     "oak-40",
      risers:    "matching",
      newels:    "turned",
      handrails: "profile-44",
      balusters: "oak-chamfered",
      sheeting:  "tg",
      lighting:  "off",
      finish:    "varnish-clear",
    },
  },
  {
    id: "nex-scandinavian",
    name: "Scandinavian",
    description: "Ash treads, white risers, plain square balusters, painted white",
    origin: "nex",
    config: {
      layout:    "straight",
      strings:   "housed-closed",
      steps:     "ash-40",
      risers:    "white-paint",
      newels:    "square-90",
      handrails: "profile-41",
      balusters: "square-plain",
      sheeting:  "plasterboard",
      lighting:  "tread-nose",
      finish:    "white-painted",
    },
  },
  {
    id: "nex-country-cottage",
    name: "Country Cottage",
    description: "Warm oak, cream balusters, traditional panelling underneath",
    origin: "nex",
    config: {
      layout:    "u-shape",
      strings:   "housed-closed",
      steps:     "oak-32",
      risers:    "matching",
      newels:    "turned",
      handrails: "profile-44",
      balusters: "cream-chamfered",
      sheeting:  "panelling",
      lighting:  "off",
      finish:    "varnish-clear",
    },
  },
  {
    id: "nex-contemporary-minimal",
    name: "Contemporary Minimal",
    description: "Cut-string, open risers, walnut, glass balustrade, matte oil",
    origin: "nex",
    config: {
      layout:    "straight",
      strings:   "cut-open",
      steps:     "walnut-40",
      risers:    "open",
      newels:    "square-cap",
      handrails: "profile-41",
      balusters: "glass-panel",
      sheeting:  "unfinished",
      lighting:  "stringer",
      finish:    "oil-matte",
    },
  },
  {
    id: "nex-heritage-black",
    name: "Heritage Black",
    description: "Black-stained oak, brass fixings, statement balustrade",
    origin: "nex",
    config: {
      layout:    "straight",
      strings:   "housed-closed",
      steps:     "oak-40",
      risers:    "matching",
      newels:    "square-120",
      handrails: "profile-50",
      balusters: "square-plain",
      sheeting:  "panelling",
      lighting:  "tread-nose",
      finish:    "stain-black",
    },
  },
];
