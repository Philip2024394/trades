// Materials provider — abstract base
//
// The provider pattern lets us introduce new material categories (sheet
// goods · glass · steel · fasteners) without touching the service or
// route layer. Each provider owns the domain-specific logic (what
// counts as a valid measurement · how volume is calculated · what
// statuses mean) but exposes a uniform surface.
//
// Hardwood is the founding provider (src/apps/materials/_providers/hardwood.ts).
// Future providers register themselves via src/apps/materials/_providers/index.ts.

import type {
  BoardMeasurementRow,
  BoardVolume,
  BoardWithCurrentMeasurement,
  HardwoodPackRow,
  MaterialCategory,
  PackWithBoards,
} from "../_schema/types";

export type NewMeasurementInput = {
  board_id: string;
  length_mm: number;
  width_end_a_mm: number;
  width_centre_mm: number;
  width_end_b_mm: number;
  thickness_end_a_mm: number;
  thickness_centre_mm: number;
  thickness_end_b_mm: number;
  moisture_content_pct?: number | null;
  photo_url?: string | null;
  notes?: string | null;
  measured_by_kind: "user" | "worker_link";
  measured_by_ref: string;
};

export abstract class MaterialProvider {
  abstract readonly category: MaterialCategory;
  abstract readonly displayName: string;

  /** Validate a measurement input. Throws MaterialsError on failure. */
  abstract validateMeasurement(input: NewMeasurementInput): void;

  /** Compute volume in mm³ / m³ / board-feet from a stored measurement. */
  abstract computeVolume(measurement: BoardMeasurementRow): BoardVolume;

  /** Compute a pack-level volume roll-up from its currently-measured boards. */
  computePackVolumeM3(pack: PackWithBoards): number {
    let total = 0;
    for (const b of pack.boards) {
      if (b.current_measurement) {
        total += this.computeVolume(b.current_measurement).volume_m3;
      }
    }
    return total;
  }

  /** Human-friendly pack progress label ("14 of 60 measured"). */
  packProgressLabel(pack: PackWithBoards): string {
    const measured = pack.boards.filter(b => b.current_measurement).length;
    const total    = pack.boards.length;
    return `${measured} of ${total} measured`;
  }

  /** Derive the next pack status given the current pack + boards. */
  deriveNextPackStatus(current: HardwoodPackRow["status"], boards: BoardWithCurrentMeasurement[]): HardwoodPackRow["status"] {
    if (current === "consumed" || current === "retired" || current === "allocated") {
      return current;
    }
    if (boards.length === 0) return "pending";
    const measured = boards.filter(b => b.current_measurement).length;
    if (measured === 0) return "pending";
    if (measured === boards.length) return "complete";
    return "measuring";
  }
}
