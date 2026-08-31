// src/lib/nex/brain/compare-from-world.ts
//
// Stage 3.35 · Phase B · Structured comparison over live WorldRecords
// (Philip 2026-08-31).
//
// CONSTITUTIONAL: Comparison MUST NEVER manufacture a winner.
//
// The existing comparison.ts (Stage 3.16) compares business entities
// from the session window (name + area only). This module operates on
// live WorldRecord[] directly and produces a structured table that
// honestly renders "Unavailable" for every field the schema doesn't
// publish for a given candidate.
//
// Doctrine:
//   · Table shows EVERY relevant field per vertical
//   · Missing values render as "—" or "Unavailable" · never blank ·
//     never fabricated · never substituted from another record
//   · Observations list only claim-defensible statements
//     (e.g. "Indonesia Hotel is closest at 0.14km") — never a global
//     "best" claim without evidence backing it
//   · pickHint (partial winner) attaches ONLY when at least one
//     evidence field permits a defensible partial claim ·
//     `hedged: true` when the claim is only partial (e.g. closest but
//     not overall best)
//   · When ZERO evidence fields are available across all candidates,
//     the reply is completely honest: "I can compare these but the
//     directory doesn't publish rating, price, or distance data ·
//     I can only tell you their names and locations"

import type { WorldRecord, WorldVertical } from "./world-adapters/types";

// Reuse the area centroids from recommend-from-world · single source
// of truth for distance calculations across the Brain.
const AREA_CENTROIDS: Record<string, { lat: number; lng: number }> = {
  malioboro:    { lat: -7.7929, lng: 110.3660 },
  prawirotaman: { lat: -7.8155, lng: 110.3650 },
  kraton:       { lat: -7.8050, lng: 110.3644 },
  kotagede:     { lat: -7.8271, lng: 110.4001 },
  tugu:         { lat: -7.7828, lng: 110.3671 },
  gondomanan:   { lat: -7.8010, lng: 110.3673 },
};

function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/**
 * Field kinds that can appear as columns in a comparison table.
 * Per-vertical relevance is decided by `columnsForVertical()` below.
 */
export type ComparisonField =
  | "rating"
  | "reviewCount"
  | "starRating"
  | "distance"       // computed from slotArea + record coords
  | "price"
  | "availability"
  | "whatsapp"
  | "phone"
  | "website"
  | "amenities"
  | "verified"
  | "category";

export type ComparisonCell = {
  column: ComparisonField;
  /** Raw value from the WorldRecord (or computed) · null when absent. */
  value: string | number | boolean | null;
  /** Rendered display string · "—" or "Unavailable" when null · formatted otherwise. */
  display: string;
  /** True when this cell has a real value (drives observation eligibility). */
  present: boolean;
};

export type ComparisonRow = {
  recordId: string;
  name: string;
  cells: readonly ComparisonCell[];
};

export type ComparisonColumn = {
  field: ComparisonField;
  label: string;
  /** True when EVERY candidate has this field populated. */
  availableForAll: boolean;
  /** True when at least ONE candidate has it. */
  availableForSome: boolean;
  /** When availableForAll=false, human-readable reason for the gap. */
  unavailableReason?: string;
};

export type ComparisonObservation = {
  /** One-liner claim NEX can defend. */
  claim: string;
  /** Field the claim is based on. */
  field: ComparisonField;
  /** Which candidate the claim is about. */
  recordId: string;
  /** In ID for bilingual reply. */
  claimId: string;
};

export type WorldComparison =
  | {
      compared: true;
      vertical: WorldVertical;
      candidates: readonly WorldRecord[];
      columns: readonly ComparisonColumn[];
      rows: readonly ComparisonRow[];
      observations: readonly ComparisonObservation[];
      /** Fields that couldn't be compared at all (no candidate has data). */
      unavailable: readonly { field: ComparisonField; reason: string }[];
      /**
       * Partial hint · attaches ONLY when at least one field-level claim
       * exists AND it wouldn't be misleading to hedge-name a leader on
       * that dimension. Always `hedged:true` unless every relevant field
       * consistently points at the same record.
       */
      pickHint?: {
        recordId: string;
        reason: string;
        hedged: boolean;
      };
      replyText: { en: string; id: string };
    }
  | {
      compared: false;
      reason: "insufficient_candidates" | "no_candidates";
      message: { en: string; id: string };
    };

export function compareFromWorld(input: {
  records: readonly WorldRecord[];
  vertical: WorldVertical;
  slotArea?: string;
}): WorldComparison {
  const records = input.records.slice(0, 3);   // 2-3 comparison contract

  if (records.length === 0) {
    return {
      compared: false,
      reason: "no_candidates",
      message: {
        en: "I don't have candidates to compare yet.",
        id: "Belum ada kandidat untuk dibandingkan.",
      },
    };
  }
  if (records.length < 2) {
    return {
      compared: false,
      reason: "insufficient_candidates",
      message: {
        en: "I need at least two candidates to compare. I only have one right now.",
        id: "Saya butuh minimal dua kandidat untuk dibandingkan. Saat ini hanya ada satu.",
      },
    };
  }

  const centroid = input.slotArea ? AREA_CENTROIDS[input.slotArea] : undefined;
  const columns = columnsForVertical(input.vertical, !!centroid);
  const rows = records.map((r) => buildRow(r, columns, centroid, input.slotArea));

  // Column availability audit · runs BEFORE observations so we know
  // which fields we can honestly reason about at all.
  const columnAvailability = auditColumnAvailability(columns, rows);
  const unavailable: WorldComparison extends { unavailable: infer U } ? U : never = [];
  for (const c of columnAvailability) {
    if (!c.availableForSome) {
      unavailable.push({ field: c.field, reason: c.unavailableReason ?? "no candidate publishes this field" });
    }
  }

  // Observations · one line per field where at least one candidate
  // has a defensible standout. Never a global "best" claim.
  const observations = buildObservations(rows, columnAvailability, input.slotArea);

  // Optional partial pickHint · only when a single record leads on
  // AT LEAST one meaningful field (rating · price · distance).
  const pickHint = buildPickHint(rows, columnAvailability);

  const replyText = composeReplyText({
    vertical: input.vertical,
    rows,
    observations,
    unavailable,
    pickHint,
    slotArea: input.slotArea,
  });

  return {
    compared: true,
    vertical: input.vertical,
    candidates: records,
    columns: columnAvailability,
    rows,
    observations,
    unavailable,
    pickHint,
    replyText,
  };
}

// ─── Per-vertical column selection ──────────────────────────────────

function columnsForVertical(vertical: WorldVertical, hasCentroid: boolean): readonly ComparisonColumn[] {
  const cols: ComparisonColumn[] = [];
  const push = (field: ComparisonField, label: string) => {
    cols.push({ field, label, availableForAll: false, availableForSome: false });
  };
  switch (vertical) {
    case "accommodation":
      push("rating",      "Rating");
      push("reviewCount", "Reviews");
      push("starRating",  "Star rating");
      if (hasCentroid) push("distance", "Distance");
      push("price",       "Price");
      push("whatsapp",    "WhatsApp");
      push("phone",       "Phone");
      push("amenities",   "Amenities");
      push("verified",    "Verified");
      break;
    case "food":
      push("rating",      "Rating");
      push("reviewCount", "Reviews");
      if (hasCentroid) push("distance", "Distance");
      push("price",       "Price");
      push("whatsapp",    "WhatsApp");
      push("phone",       "Phone");
      push("verified",    "Verified");
      break;
    case "commerce":
      push("price",        "Price");
      push("availability", "Availability");
      push("category",     "Condition");
      break;
    case "service":
      push("category",   "Category");
      if (hasCentroid) push("distance", "Distance");
      push("whatsapp",   "WhatsApp");
      push("phone",      "Phone");
      push("website",    "Website");
      push("verified",   "Verified");
      break;
    case "transport":
      push("rating",       "Rating");
      push("reviewCount",  "Reviews");
      push("price",        "Price");
      push("availability", "Availability");
      push("whatsapp",     "WhatsApp");
      push("amenities",    "Bike / amenities");
      break;
    case "places":
      push("category", "Category");
      if (hasCentroid) push("distance", "Distance");
      break;
  }
  return cols;
}

// ─── Row construction ───────────────────────────────────────────────

function buildRow(
  r: WorldRecord,
  columns: readonly ComparisonColumn[],
  centroid: { lat: number; lng: number } | undefined,
  slotArea: string | undefined,
): ComparisonRow {
  const cells = columns.map<ComparisonCell>((col) => {
    const raw = extractRaw(r, col.field, centroid);
    if (raw == null) {
      return { column: col.field, value: null, display: displayForMissing(col.field), present: false };
    }
    return {
      column: col.field,
      value: raw,
      display: formatCell(col.field, raw, slotArea),
      present: true,
    };
  });
  return { recordId: r.id, name: r.name, cells };
}

function extractRaw(
  r: WorldRecord,
  field: ComparisonField,
  centroid: { lat: number; lng: number } | undefined,
): string | number | boolean | null {
  switch (field) {
    case "rating":       return r.rating ?? null;
    case "reviewCount":  return r.reviewCount ?? null;
    case "starRating":   return r.starRating ?? null;
    case "distance":
      if (!centroid || r.latitude == null || r.longitude == null) return null;
      return distanceKm({ lat: r.latitude, lng: r.longitude }, centroid);
    case "price":        return r.price ?? null;
    case "availability": return r.availability ?? null;
    case "whatsapp":     return r.whatsapp ?? null;
    case "phone":        return r.phone ?? null;
    case "website":      return r.website ?? null;
    case "amenities":    return r.amenities && r.amenities.length > 0 ? r.amenities.join(" · ") : null;
    case "verified":     return r.verified ?? null;
    case "category":     return r.category ?? null;
  }
}

function displayForMissing(field: ComparisonField): string {
  // Cells for boolean-shaped fields render "—" · cells for value-shaped
  // fields render "Unavailable" so the user sees the difference between
  // "not provided" and "definitely no".
  if (field === "verified" || field === "whatsapp" || field === "phone" || field === "website") return "—";
  return "Unavailable";
}

function formatCell(field: ComparisonField, raw: string | number | boolean, slotArea: string | undefined): string {
  switch (field) {
    case "rating":       return typeof raw === "number" ? raw.toFixed(1) : String(raw);
    case "reviewCount":  return `${raw} reviews`;
    case "starRating":   return `${raw}★`;
    case "distance":     return typeof raw === "number" ? `${raw.toFixed(2)} km${slotArea ? ` from ${slotArea}` : ""}` : String(raw);
    case "price":        return typeof raw === "number" ? `Rp ${raw.toLocaleString("id-ID")}` : String(raw);
    case "availability": return String(raw);
    case "whatsapp":
    case "phone":        return "Yes";
    case "website":      return typeof raw === "string" && raw.length > 40 ? raw.slice(0, 37) + "..." : String(raw);
    case "amenities":    return String(raw);
    case "verified":     return raw === true ? "Verified" : "—";
    case "category":     return String(raw);
  }
}

// ─── Column availability audit ──────────────────────────────────────

function auditColumnAvailability(
  columns: readonly ComparisonColumn[],
  rows: readonly ComparisonRow[],
): readonly ComparisonColumn[] {
  return columns.map((col) => {
    const cellsForCol = rows.map((r) => r.cells.find((c) => c.column === col.field)!);
    const availableForSome = cellsForCol.some((c) => c.present);
    const availableForAll = cellsForCol.every((c) => c.present);
    const unavailableReason = !availableForSome
      ? `no candidate publishes ${col.label.toLowerCase()}`
      : !availableForAll
        ? `not published for every candidate`
        : undefined;
    return { ...col, availableForSome, availableForAll, unavailableReason };
  });
}

// ─── Observations · defensible per-field claims ─────────────────────

function buildObservations(
  rows: readonly ComparisonRow[],
  columns: readonly ComparisonColumn[],
  slotArea: string | undefined,
): readonly ComparisonObservation[] {
  const obs: ComparisonObservation[] = [];

  for (const col of columns) {
    const cells = rows.map((r) => r.cells.find((c) => c.column === col.field)!);
    // Numeric extremes only defensible when EVERY candidate has the value
    // (otherwise the "cheapest" claim would be false-negative for the
    // candidate whose price is unpublished). Presence-based observations
    // (whatsapp/phone/website) run OUTSIDE this availableForAll gate.
    if (col.availableForAll && (col.field === "distance" || col.field === "price" || col.field === "rating" || col.field === "reviewCount" || col.field === "starRating")) {
      const wantMin = col.field === "distance" || col.field === "price";
      const values = cells.map((c, i) => ({ value: c.value as number, row: rows[i] }));
      const sorted = [...values].sort((a, b) => wantMin ? a.value - b.value : b.value - a.value);
      const winner = sorted[0];
      // Only make a claim when the winner is clearly ahead (avoid ties
      // that would need "essentially tied" hedging).
      const gap = Math.abs(winner.value - sorted[1].value);
      const threshold = col.field === "distance" ? 0.1 : col.field === "rating" ? 0.15 : col.field === "starRating" ? 0.5 : col.field === "price" ? 1 : 1;
      if (gap < threshold) continue; // essentially tied · no claim
      const superlativeEn =
        col.field === "distance"    ? `${winner.row.name} is closest at ${(winner.value).toFixed(2)}km${slotArea ? ` from ${slotArea}` : ""}`
      : col.field === "price"       ? `${winner.row.name} is cheapest at Rp ${winner.value.toLocaleString("id-ID")}`
      : col.field === "rating"      ? `${winner.row.name} has the highest rating (${(winner.value).toFixed(1)})`
      : col.field === "reviewCount" ? `${winner.row.name} has the most reviews (${winner.value})`
      : /* starRating */              `${winner.row.name} has the highest star rating (${winner.value}★)`;
      const superlativeId =
        col.field === "distance"    ? `${winner.row.name} paling dekat, ${(winner.value).toFixed(2)}km${slotArea ? ` dari ${slotArea}` : ""}`
      : col.field === "price"       ? `${winner.row.name} paling murah, Rp ${winner.value.toLocaleString("id-ID")}`
      : col.field === "rating"      ? `${winner.row.name} punya rating tertinggi (${(winner.value).toFixed(1)})`
      : col.field === "reviewCount" ? `${winner.row.name} punya ulasan terbanyak (${winner.value})`
      : /* starRating */              `${winner.row.name} punya bintang tertinggi (${winner.value}★)`;
      obs.push({
        claim: superlativeEn,
        field: col.field,
        recordId: winner.row.recordId,
        claimId: superlativeId,
      });
    }
    // Presence-based fields (whatsapp/phone/website) — comment when only
    // some candidates have it (partial availability is interesting).
    if (col.field === "whatsapp" || col.field === "phone" || col.field === "website") {
      const withField = rows.filter((r) => r.cells.find((c) => c.column === col.field)!.present);
      if (withField.length > 0 && withField.length < rows.length) {
        const names = withField.map((r) => r.name).join(" · ");
        const label = col.field === "whatsapp" ? "WhatsApp" : col.field === "phone" ? "phone" : "website";
        obs.push({
          claim: `Only ${names} publish${withField.length === 1 ? "es" : ""} a ${label}`,
          field: col.field,
          recordId: withField[0].recordId,
          claimId: `Hanya ${names} yang mencantumkan ${label}`,
        });
      }
    }
  }
  return obs;
}

// ─── pickHint · partial · never overall "best" ──────────────────────

function buildPickHint(
  rows: readonly ComparisonRow[],
  columns: readonly ComparisonColumn[],
): WorldComparison extends { pickHint?: infer H } ? H | undefined : never {
  // Only construct a hint when we have a distance winner (proximity is
  // often the most direct actionable signal for the user asking to
  // compare). We ALWAYS hedge because comparison alone shouldn't
  // conclude "overall best".
  const distanceCol = columns.find((c) => c.field === "distance" && c.availableForAll);
  if (distanceCol) {
    const withDist = rows.map((r) => ({
      row: r, dist: r.cells.find((c) => c.column === "distance")!.value as number,
    }));
    withDist.sort((a, b) => a.dist - b.dist);
    const winner = withDist[0];
    const gap = Math.abs(withDist[1].dist - winner.dist);
    if (gap >= 0.1) {
      return {
        recordId: winner.row.recordId,
        reason: `closest at ${winner.dist.toFixed(2)}km`,
        hedged: true,
      };
    }
  }
  // Same for rating winner when distance not available.
  const ratingCol = columns.find((c) => c.field === "rating" && c.availableForAll);
  if (ratingCol) {
    const withRating = rows.map((r) => ({
      row: r, rating: r.cells.find((c) => c.column === "rating")!.value as number,
    }));
    withRating.sort((a, b) => b.rating - a.rating);
    const winner = withRating[0];
    const gap = Math.abs(winner.rating - withRating[1].rating);
    if (gap >= 0.15) {
      return {
        recordId: winner.row.recordId,
        reason: `highest rated at ${winner.rating.toFixed(1)}`,
        hedged: true,
      };
    }
  }
  return undefined;
}

// ─── Reply text · honest table narration ────────────────────────────

function composeReplyText(input: {
  vertical: WorldVertical;
  rows: readonly ComparisonRow[];
  observations: readonly ComparisonObservation[];
  unavailable: readonly { field: ComparisonField; reason: string }[];
  pickHint?: { recordId: string; reason: string; hedged: boolean };
  slotArea?: string;
}): { en: string; id: string } {
  const en: string[] = [];
  const id: string[] = [];

  const names = input.rows.map((r) => r.name).join(" · ");
  en.push(`Comparing ${input.rows.length} ${vertNounEn(input.vertical)}s: ${names}.`);
  id.push(`Membandingkan ${input.rows.length} ${vertNounId(input.vertical)}: ${names}.`);

  if (input.observations.length > 0) {
    for (const o of input.observations) {
      en.push(o.claim + ".");
      id.push(o.claimId + ".");
    }
  } else {
    en.push(`I can't make any defensible claim from this comparison · none of the ranking-relevant fields are published for these candidates.`);
    id.push(`Saya tidak bisa membuat klaim yang bisa dipertahankan dari perbandingan ini · tidak ada bidang peringkat yang dipublikasikan untuk kandidat-kandidat ini.`);
  }

  if (input.unavailable.length > 0) {
    const fieldsEn = input.unavailable.map((u) => u.field).join(" · ");
    en.push(`I can't compare on: ${fieldsEn} because the directory doesn't currently publish that data.`);
    const fieldsId = input.unavailable.map((u) => u.field).join(" · ");
    id.push(`Saya tidak bisa membandingkan: ${fieldsId} karena direktori belum menyimpan data itu.`);
  }

  if (input.pickHint) {
    const winnerRow = input.rows.find((r) => r.recordId === input.pickHint!.recordId);
    if (winnerRow) {
      en.push(`If you have to start somewhere, ${winnerRow.name} is ${input.pickHint.reason} · that's not the same as saying it's the best overall.`);
      id.push(`Kalau harus mulai dari salah satu, ${winnerRow.name} ${input.pickHint.reason} · itu bukan berarti dia yang paling bagus secara keseluruhan.`);
    }
  }

  return { en: en.join(" "), id: id.join(" ") };
}

function vertNounEn(v: WorldVertical): string {
  return v === "accommodation" ? "stay" : v === "food" ? "place" : v === "service" ? "provider" : v === "commerce" ? "product" : v === "transport" ? "driver" : "place";
}
function vertNounId(v: WorldVertical): string {
  return v === "accommodation" ? "tempat menginap" : v === "food" ? "tempat makan" : v === "service" ? "penyedia jasa" : v === "commerce" ? "produk" : v === "transport" ? "pengemudi" : "tempat";
}
