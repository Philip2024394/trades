// EditableServicesSection — grid of service cards. Every trade page
// needs a "what we do" list. Card = { icon, title, description,
// price (optional) }. Editable inline via pencil.

"use client";

import {
  Bath,
  ChevronDown,
  ChevronUp,
  Hammer,
  HardHat,
  Home,
  Paintbrush,
  Plus,
  Trash2,
  Wrench,
  X,
  Zap
} from "lucide-react";
import type { ComponentType } from "react";
import { useEffect, useState } from "react";
import { useEditMode } from "./EditModeContext";
import { EditableSection } from "./EditableSection";
import { useSectionPlacement } from "./useSectionPlacement";

export type ServiceItem = {
  id: string;
  title: string;
  description: string;
  icon: ServiceIconKey;
  price?: string;
};

export type ServiceIconKey =
  | "hammer"
  | "wrench"
  | "paintbrush"
  | "hardhat"
  | "zap"
  | "home"
  | "bath";

const ICON_MAP: Record<ServiceIconKey, ComponentType<{ className?: string }>> = {
  hammer: Hammer,
  wrench: Wrench,
  paintbrush: Paintbrush,
  hardhat: HardHat,
  zap: Zap,
  home: Home,
  bath: Bath
};

const ICON_OPTIONS: ServiceIconKey[] = [
  "hammer",
  "wrench",
  "paintbrush",
  "hardhat",
  "zap",
  "home",
  "bath"
];

export type EditableServicesSectionProps = {
  id: string;
  initial?: {
    heading?: string;
    subhead?: string;
    services?: ServiceItem[];
  };
};

const DEFAULT_SERVICES: ServiceItem[] = [
  {
    id: "svc-1",
    icon: "hammer",
    title: "Installation",
    description: "Fitted to spec, on time, first time.",
    price: "From £249"
  },
  {
    id: "svc-2",
    icon: "wrench",
    title: "Repair",
    description: "Same-day repair for urgent issues.",
    price: "From £89"
  },
  {
    id: "svc-3",
    icon: "hardhat",
    title: "Full refurb",
    description: "End-to-end project management.",
    price: "Quote on inspection"
  }
];

function newServiceId(): string {
  return `svc-${Math.random().toString(36).slice(2, 8)}`;
}

function gridColsForVariant(variant: string): string {
  switch (variant) {
    case "2col":
      return "md:grid-cols-2";
    case "4col":
      return "md:grid-cols-2 lg:grid-cols-4";
    case "3col":
    default:
      return "md:grid-cols-3";
  }
}

export function EditableServicesSection({
  id,
  initial
}: EditableServicesSectionProps) {
  const editCtx = useEditMode();
  const [heading, setHeading] = useState(initial?.heading ?? "What we do");
  const [subhead, setSubhead] = useState(
    initial?.subhead ?? "Pick the service that fits — or ask us for a bespoke quote."
  );
  const [services, setServices] = useState<ServiceItem[]>(
    initial?.services ?? DEFAULT_SERVICES
  );
  const [editing, setEditing] = useState(false);
  const { variant } = useSectionPlacement(id, "3col");
  const gridCols = gridColsForVariant(variant);

  useEffect(() => {
    editCtx.registerSectionState(id, { heading, subhead, services });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, heading, subhead, services]);

  const patch = (field: "heading" | "subhead", v: string) => {
    if (field === "heading") setHeading(v);
    else setSubhead(v);
    editCtx.markDirty();
  };

  const patchService = (svcId: string, p: Partial<ServiceItem>) => {
    setServices((prev) =>
      prev.map((s) => (s.id === svcId ? { ...s, ...p } : s))
    );
    editCtx.markDirty();
  };

  const addService = () => {
    setServices((prev) => [
      ...prev,
      {
        id: newServiceId(),
        icon: "wrench",
        title: "New service",
        description: "Describe what you'll do.",
        price: ""
      }
    ]);
    editCtx.markDirty();
  };

  const removeService = (svcId: string) => {
    setServices((prev) => prev.filter((s) => s.id !== svcId));
    editCtx.markDirty();
  };

  const moveService = (svcId: string, direction: "up" | "down") => {
    setServices((prev) => {
      const idx = prev.findIndex((s) => s.id === svcId);
      if (idx < 0) return prev;
      const target = direction === "up" ? idx - 1 : idx + 1;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
    editCtx.markDirty();
  };

  return (
    <EditableSection
      id={id}
      type="services"
      label="Services"
      onEdit={() => setEditing(true)}
    >
      <div className="px-4 py-10">
        <div className="mb-6 text-center">
          <h2 className="text-[22px] font-bold text-neutral-900 md:text-[28px]">
            {heading}
          </h2>
          {subhead ? (
            <p className="mx-auto mt-1 max-w-2xl text-[13px] text-neutral-600 md:text-[14px]">
              {subhead}
            </p>
          ) : null}
        </div>
        <div className={`mx-auto grid max-w-5xl gap-3 ${gridCols}`}>
          {services.map((svc) => {
            const Icon = ICON_MAP[svc.icon];
            return (
              <div
                key={svc.id}
                className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm"
              >
                <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-full bg-amber-100 text-amber-800">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-[15px] font-semibold text-neutral-900">
                  {svc.title}
                </h3>
                <p className="mt-1 text-[13px] text-neutral-600">
                  {svc.description}
                </p>
                {svc.price ? (
                  <div className="mt-3 text-[12px] font-semibold text-neutral-900">
                    {svc.price}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {editing ? (
        <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center pb-4">
          <div className="pointer-events-auto w-full max-w-3xl max-h-[80vh] overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-[13px] font-semibold text-neutral-900">
                  Edit services
                </div>
                <div className="text-[10px] text-neutral-500">
                  Add, remove, or reorder the services you offer.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditing(false)}
                aria-label="Close editor"
                className="rounded-md p-1 text-neutral-500 transition hover:bg-neutral-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-4 flex flex-col gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                  Heading
                </span>
                <input
                  type="text"
                  value={heading}
                  onChange={(e) => patch("heading", e.currentTarget.value)}
                  className="rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-[13px]"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                  Subhead
                </span>
                <input
                  type="text"
                  value={subhead}
                  onChange={(e) => patch("subhead", e.currentTarget.value)}
                  className="rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-[13px]"
                />
              </label>
            </div>

            <ul className="flex flex-col gap-2">
              {services.map((svc, idx) => (
                <li
                  key={svc.id}
                  className="rounded-lg border border-neutral-200 bg-white p-2"
                >
                  <div className="flex gap-2">
                    <div className="flex flex-col gap-0.5">
                      <button
                        type="button"
                        onClick={() => moveService(svc.id, "up")}
                        disabled={idx === 0}
                        aria-label="Move up"
                        className="rounded-md border border-neutral-200 bg-white p-0.5 text-neutral-600 transition hover:bg-neutral-100 disabled:opacity-30"
                      >
                        <ChevronUp className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveService(svc.id, "down")}
                        disabled={idx === services.length - 1}
                        aria-label="Move down"
                        className="rounded-md border border-neutral-200 bg-white p-0.5 text-neutral-600 transition hover:bg-neutral-100 disabled:opacity-30"
                      >
                        <ChevronDown className="h-3 w-3" />
                      </button>
                    </div>
                    <select
                      value={svc.icon}
                      onChange={(e) =>
                        patchService(svc.id, {
                          icon: e.currentTarget.value as ServiceIconKey
                        })
                      }
                      className="rounded-md border border-neutral-200 bg-white px-1.5 py-0.5 text-[11px]"
                    >
                      {ICON_OPTIONS.map((k) => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={svc.title}
                      onChange={(e) =>
                        patchService(svc.id, { title: e.currentTarget.value })
                      }
                      placeholder="Title"
                      className="flex-1 rounded-md border border-neutral-200 bg-white px-2 py-1 text-[11px]"
                    />
                    <button
                      type="button"
                      onClick={() => removeService(svc.id)}
                      aria-label="Remove"
                      className="rounded-md border border-red-200 bg-red-50 p-1 text-red-700 transition hover:bg-red-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="mt-1 flex gap-1">
                    <input
                      type="text"
                      value={svc.description}
                      onChange={(e) =>
                        patchService(svc.id, {
                          description: e.currentTarget.value
                        })
                      }
                      placeholder="Description"
                      className="flex-1 rounded-md border border-neutral-200 bg-white px-2 py-1 text-[11px]"
                    />
                    <input
                      type="text"
                      value={svc.price ?? ""}
                      onChange={(e) =>
                        patchService(svc.id, { price: e.currentTarget.value })
                      }
                      placeholder="Price (optional)"
                      className="w-32 rounded-md border border-neutral-200 bg-white px-2 py-1 text-[11px]"
                    />
                  </div>
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={addService}
              className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-[12px] font-medium text-neutral-700 transition hover:bg-neutral-50"
            >
              <Plus className="h-3.5 w-3.5" /> Add service
            </button>
          </div>
        </div>
      ) : null}
    </EditableSection>
  );
}
