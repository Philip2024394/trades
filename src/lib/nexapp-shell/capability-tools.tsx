"use client";
// NEX Tools capability · Philip 2026-08-30 · Slice 1
//
// Purpose-designed NEX mobile experience: 5 trade worlds → filtered tools
// → calculator. NOT the /tools webpage compressed into the frame. Feels
// native to NEX: frosted glass, cyan accents, touch-first tiles.
//
// Categories LOCKED by Philip 2026-08-30:
//   Masonry            — bricks · concrete · mortar · paving
//   Carpentry & Flooring — decking · fencing · flooring · skirting
//   Plaster & Finish   — plasterboard · plastering · render · wallpaper · paint · tiles
//   Roofing & Insulation — roof tiles · insulation
//   Grounds & Exterior — gravel · turf · delivery
//
// Real calculator integration is deferred to a follow-up slice. This slice
// ships the entry + category surfaces plus an honest placeholder for the
// calculator view (Rule 5 · reality over demo magic).

import React from "react";
import { capabilityRegistry, type CapabilityViewProps } from "./capabilities";
import { CapabilityHeader } from "@/components/nexapp/CapabilityHeader";

interface CalcRef {
  slug: string;
  name: string;
}

interface Category {
  id: string;
  label: string;
  blurb: string;
  calcs: CalcRef[];
}

const CATEGORIES: Category[] = [
  {
    id: "masonry",
    label: "Masonry",
    blurb: "Bricks · concrete · mortar · paving",
    calcs: [
      { slug: "calc-bricks",   name: "Bricks" },
      { slug: "calc-concrete", name: "Concrete" },
      { slug: "calc-mortar",   name: "Mortar" },
      { slug: "calc-paving",   name: "Paving" },
    ],
  },
  {
    id: "carpentry",
    label: "Carpentry & Flooring",
    blurb: "Decking · fencing · flooring · skirting",
    calcs: [
      { slug: "calc-decking",  name: "Decking" },
      { slug: "calc-fencing",  name: "Fencing" },
      { slug: "calc-flooring", name: "Flooring" },
      { slug: "calc-skirting", name: "Skirting" },
    ],
  },
  {
    id: "finish",
    label: "Plaster & Finish",
    blurb: "Plasterboard · plastering · render · wallpaper · paint · tiles",
    calcs: [
      { slug: "calc-plasterboard", name: "Plasterboard" },
      { slug: "calc-plastering",   name: "Plastering" },
      { slug: "calc-render",       name: "Render" },
      { slug: "calc-wallpaper",    name: "Wallpaper" },
      { slug: "calc-paint",        name: "Paint" },
      { slug: "calc-tiles",        name: "Tiles" },
    ],
  },
  {
    id: "roofing",
    label: "Roofing & Insulation",
    blurb: "Roof tiles · insulation",
    calcs: [
      { slug: "calc-roof-tiles", name: "Roof Tiles" },
      { slug: "calc-insulation", name: "Insulation" },
    ],
  },
  {
    id: "grounds",
    label: "Grounds & Exterior",
    blurb: "Gravel · turf · delivery",
    calcs: [
      { slug: "calc-gravel",   name: "Gravel" },
      { slug: "calc-turf",     name: "Turf" },
      { slug: "calc-delivery", name: "Delivery" },
    ],
  },
];

function findCategory(id: string | undefined): Category | undefined {
  return CATEGORIES.find((c) => c.id === id);
}

function findCalc(categoryId: string | undefined, slug: string | undefined): { cat: Category; calc: CalcRef } | undefined {
  const cat = findCategory(categoryId);
  if (!cat) return undefined;
  const calc = cat.calcs.find((c) => c.slug === slug);
  if (!calc) return undefined;
  return { cat, calc };
}

// ── ENTRY VIEW ── native NEX capability landing · no back
function ToolsEntryView({ navigate }: CapabilityViewProps) {
  return (
    <>
      <CapabilityHeader eyebrow="Tools" title="What are you calculating?" />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          padding: "0 20px 40px",
        }}
      >
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            aria-label={`Open ${cat.label}`}
            onClick={() => navigate("category", { id: cat.id })}
            style={{
              appearance: "none",
              textAlign: "left",
              minHeight: 80,
              padding: "18px 20px",
              borderRadius: 16,
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.02) 100%)",
              border: "1px solid rgba(255,255,255,0.10)",
              color: "inherit",
              cursor: "pointer",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              transition: "border-color 140ms ease, background 140ms ease, transform 120ms ease",
              display: "flex",
              flexDirection: "column",
              gap: 5,
              fontFamily: "inherit",
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 600, color: "rgba(245,245,245,0.95)" }}>
              {cat.label}
            </div>
            <div
              style={{
                fontSize: 12,
                color: "rgba(245,245,245,0.55)",
                lineHeight: 1.45,
              }}
            >
              {cat.blurb}
            </div>
          </button>
        ))}
      </div>
    </>
  );
}

// ── CATEGORY VIEW ── filtered calculator list · back returns to Tools entry
function ToolsCategoryView({ frame, navigate }: CapabilityViewProps) {
  const cat = findCategory(frame.params?.id);
  if (!cat) {
    return (
      <>
        <CapabilityHeader
          backLabel="Tools"
          onBack={() => navigate("entry")}
          title="Category not found"
        />
        <div style={{ padding: "0 20px 24px", color: "rgba(245,245,245,0.6)", fontSize: 13 }}>
          That category doesn&apos;t exist. Tap back to return to Tools.
        </div>
      </>
    );
  }
  return (
    <>
      <CapabilityHeader
        backLabel="Tools"
        onBack={() => navigate("entry")}
        title={cat.label}
      />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          padding: "0 20px 40px",
        }}
      >
        {cat.calcs.map((c) => (
          <button
            key={c.slug}
            type="button"
            aria-label={`Open ${c.name} calculator`}
            onClick={() => navigate("calculator", { id: `${cat.id}:${c.slug}` })}
            style={{
              appearance: "none",
              textAlign: "left",
              minHeight: 60,
              padding: "16px 18px",
              borderRadius: 12,
              background: "rgba(255,255,255,0.035)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "rgba(245,245,245,0.95)",
              fontSize: 15,
              fontWeight: 500,
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "border-color 140ms ease, background 140ms ease",
            }}
          >
            {c.name}
          </button>
        ))}
      </div>
    </>
  );
}

// ── CALCULATOR VIEW ── honest placeholder · back returns to originating category
// id param format is "<categoryId>:<calcSlug>" so we can restore the parent category on back.
function ToolsCalculatorView({ frame, navigate }: CapabilityViewProps) {
  const composite = frame.params?.id ?? "";
  const [categoryId, slug] = composite.split(":");
  const found = findCalc(categoryId, slug);
  if (!found) {
    return (
      <>
        <CapabilityHeader
          backLabel="Tools"
          onBack={() => navigate("entry")}
          title="Calculator not found"
        />
        <div style={{ padding: "0 20px 24px", color: "rgba(245,245,245,0.6)", fontSize: 13 }}>
          That calculator isn&apos;t available here. Tap back to return to Tools.
        </div>
      </>
    );
  }
  const { cat, calc } = found;
  return (
    <>
      <CapabilityHeader
        backLabel={cat.label}
        onBack={() => navigate("category", { id: cat.id })}
        title={calc.name}
      />
      <div style={{ padding: "0 20px 40px" }}>
        <div
          style={{
            padding: 20,
            borderRadius: 14,
            background: "rgba(74,201,255,0.06)",
            border: "1px solid rgba(74,201,255,0.22)",
            fontSize: 13,
            color: "rgba(245,245,245,0.75)",
            lineHeight: 1.55,
          }}
        >
          The {calc.name} calculator will render inside this NEX capability in the
          next slice. Not a webpage escape &mdash; a native NEX experience.
        </div>
      </div>
    </>
  );
}

capabilityRegistry.register({
  id: "tools",
  label: "Tools",
  entryView: "entry",
  views: {
    entry: ToolsEntryView,
    category: ToolsCategoryView,
    calculator: ToolsCalculatorView,
  },
  wants: {
    composer: false,
    orb: "default",
    railAccent: "#4ac9ff",
  },
});
