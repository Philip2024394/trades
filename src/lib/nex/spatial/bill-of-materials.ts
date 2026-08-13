// Spatial Intelligence · Bill of Materials.
//
// Every rendered object can produce a BOM · cutting list · packing list ·
// installation sequence. This module holds the schema · generators are phased.
//
// Doctrine: docs/brains/nex-phase-e2-unified-platforms-philip-2026-08-04.md

import type { Measurement } from "./measurement";
import type { Confidence } from "./confidence";

export type BOMLineItem = {
  id: string;
  description: string;
  quantity: number;
  unit: string;                          // "each" · "m" · "kg" · "l" · "m2" · "m3"
  material?: string;
  size?: Measurement;
  weight?: Measurement;
  cost_estimate?: { amount: number; currency: "GBP" | "USD" | "EUR"; confidence: Confidence };
  waste_estimate_pct?: number;
  supplier?: string;
};

export type BillOfMaterials = {
  object_id: string;                     // the DesignObject or GeometryObject that produced this BOM
  object_type: string;
  line_items: readonly BOMLineItem[];
  total_weight?: Measurement;
  total_cost_estimate?: { amount: number; currency: "GBP" | "USD" | "EUR"; confidence: Confidence };
  installation_sequence?: readonly string[];
  packing_list?: readonly string[];
  generated_at: string;
  provenance: string;
};

export function totalCost(bom: BillOfMaterials): number {
  return bom.line_items.reduce((sum, li) => sum + (li.cost_estimate?.amount ?? 0) * li.quantity, 0);
}

export function totalLineItems(bom: BillOfMaterials): number { return bom.line_items.length; }
