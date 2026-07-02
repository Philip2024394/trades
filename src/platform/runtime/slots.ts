// Platform Runtime — slot management (v1 conventional).
//
// Slot IDs follow the convention `<pageId>.<slotName>`. Well-known
// slots per page:
//
//   hero   — first row of the page. constraint: "one"   (single-section)
//   body   — middle rows of the page. constraint: "many" (any count)
//   footer — last row of the page. constraint: "one"    (single-section)
//
// v1 slots are advisory:
//   • Apps declare `slotHints: ["home.body"]` in their manifest.
//   • The installer uses hints to decide where a newly-installed
//     App's default section lands in the layout row order.
//   • The Runtime does NOT enforce single-section constraints yet;
//     that's a v2 concern once we've measured how merchants actually
//     compose pages.
//
// `resolveSlot` reads the current published/draft layout for a page
// and returns which section instance (if any) is currently the slot's
// occupant using the convention above.

import type {
  SlotConstraint,
  SlotDefinition,
  SlotResolution
} from "./types";
import type { StudioLayoutJson } from "@/lib/studio/schema";
import { appRegistry } from "../registry";

// ─── Convention ─────────────────────────────────────────────────────

export const KNOWN_SLOT_NAMES = ["hero", "body", "footer"] as const;
export type KnownSlotName = (typeof KNOWN_SLOT_NAMES)[number];

const SLOT_CONSTRAINTS: Record<KnownSlotName, SlotConstraint> = {
  hero: "one",
  body: "many",
  footer: "one"
};

/** Return the well-known slots for any page. Every page has the same
 *  three slots in v1 — future page templates may declare custom slots
 *  in their PageDeclaration, and this list will extend to include
 *  them. */
export function slotsForPage(pageId: string): SlotDefinition[] {
  return KNOWN_SLOT_NAMES.map((name) => ({
    id: `${pageId}.${name}`,
    pageId,
    name,
    constraint: SLOT_CONSTRAINTS[name]
  }));
}

// ─── Slot ↔ layout resolution ──────────────────────────────────────

/** Which layout row indices back each slot for a given layout.
 *  Convention: first row = hero, last row = footer (when >1 row),
 *  everything in between = body. Single-row pages: the row IS the
 *  hero; body/footer are empty. */
function rowIndicesForSlot(
  layout: StudioLayoutJson,
  slotName: KnownSlotName
): number[] {
  const rowCount = layout.rows.length;
  if (rowCount === 0) return [];
  if (rowCount === 1) return slotName === "hero" ? [0] : [];
  if (slotName === "hero") return [0];
  if (slotName === "footer") return [rowCount - 1];
  // body: everything between hero and footer
  const out: number[] = [];
  for (let i = 1; i < rowCount - 1; i += 1) out.push(i);
  return out;
}

/** Find the App that contributed a given section id. Sections
 *  registered by the platform's App Registry follow the `app.<slug>.*`
 *  namespace, so we can attribute back to the manifest. Non-App
 *  sections return null. */
function attributeApp(sectionKey: string): string | null {
  if (!sectionKey.startsWith("app.")) return null;
  const slug = sectionKey.split(".")[1] ?? "";
  return appRegistry.has(slug) ? slug : null;
}

/** Resolve a single slot against a layout. Returns null occupancy
 *  when the slot is empty. For many-section slots (body), returns the
 *  first occupant — call `resolveSlotAll` for the full list. */
export function resolveSlot(
  pageId: string,
  slotName: KnownSlotName,
  layout: StudioLayoutJson
): SlotResolution {
  const slotId = `${pageId}.${slotName}`;
  const rowIdxs = rowIndicesForSlot(layout, slotName);
  const byInstance = new Map(
    layout.sections.map((s) => [s.instanceId, s])
  );
  for (const idx of rowIdxs) {
    const row = layout.rows[idx];
    if (!row) continue;
    for (const instanceId of row.columns) {
      const section = byInstance.get(instanceId);
      if (!section) continue;
      return {
        slotId,
        pageId,
        slotName,
        instanceId,
        sectionKey: section.key,
        contributedByApp: attributeApp(section.key)
      };
    }
  }
  return {
    slotId,
    pageId,
    slotName,
    instanceId: null,
    sectionKey: null,
    contributedByApp: null
  };
}

/** All occupants of a slot — meaningful for the body slot. */
export function resolveSlotAll(
  pageId: string,
  slotName: KnownSlotName,
  layout: StudioLayoutJson
): SlotResolution[] {
  const slotId = `${pageId}.${slotName}`;
  const rowIdxs = rowIndicesForSlot(layout, slotName);
  const byInstance = new Map(
    layout.sections.map((s) => [s.instanceId, s])
  );
  const out: SlotResolution[] = [];
  for (const idx of rowIdxs) {
    const row = layout.rows[idx];
    if (!row) continue;
    for (const instanceId of row.columns) {
      const section = byInstance.get(instanceId);
      if (!section) continue;
      out.push({
        slotId,
        pageId,
        slotName,
        instanceId,
        sectionKey: section.key,
        contributedByApp: attributeApp(section.key)
      });
    }
  }
  return out;
}
