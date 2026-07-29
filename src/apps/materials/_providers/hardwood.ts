// Hardwood provider — the founding material provider
//
// Domain rules:
//   · Boards are measured as a rectangular volume estimated from length +
//     three width samples (end A · centre · end B) + three thickness
//     samples. Averaging captures cup/twist without requiring the worker
//     to enter volume directly.
//   · Volume in board-feet uses the trade convention:
//       bf = (length_inches × width_inches × thickness_inches) / 144
//     which is the standard US/UK hardwood measure.
//   · All dimensions arrive in mm from the worker portal. mm → inches
//     via /25.4 · no rounding until final display.

import { MaterialProvider, type NewMeasurementInput } from "./_base";
import { MaterialsError, type BoardMeasurementRow, type BoardVolume } from "../_schema/types";

const MM_PER_INCH = 25.4;

export class HardwoodProvider extends MaterialProvider {
  readonly category = "hardwood" as const;
  readonly displayName = "Hardwood";

  validateMeasurement(input: NewMeasurementInput): void {
    const numericFields: [string, number][] = [
      ["length_mm",           input.length_mm],
      ["width_end_a_mm",      input.width_end_a_mm],
      ["width_centre_mm",     input.width_centre_mm],
      ["width_end_b_mm",      input.width_end_b_mm],
      ["thickness_end_a_mm",  input.thickness_end_a_mm],
      ["thickness_centre_mm", input.thickness_centre_mm],
      ["thickness_end_b_mm",  input.thickness_end_b_mm],
    ];

    for (const [name, value] of numericFields) {
      if (!Number.isFinite(value)) {
        throw new MaterialsError("invalid_input", `${name} must be a finite number`, 422);
      }
      if (value <= 0) {
        throw new MaterialsError("invalid_input", `${name} must be positive (mm)`, 422);
      }
      if (!Number.isInteger(value)) {
        throw new MaterialsError("invalid_input", `${name} must be an integer (mm)`, 422);
      }
    }

    // Sanity guards to catch mis-entered units.
    if (input.length_mm < 200 || input.length_mm > 8000) {
      throw new MaterialsError("invalid_input", `length_mm ${input.length_mm} outside plausible range 200–8000 · check units`, 422);
    }
    const widths = [input.width_end_a_mm, input.width_centre_mm, input.width_end_b_mm];
    for (const w of widths) {
      if (w < 20 || w > 1200) {
        throw new MaterialsError("invalid_input", `width ${w}mm outside plausible range 20–1200 · check units`, 422);
      }
    }
    const thicknesses = [input.thickness_end_a_mm, input.thickness_centre_mm, input.thickness_end_b_mm];
    for (const t of thicknesses) {
      if (t < 5 || t > 300) {
        throw new MaterialsError("invalid_input", `thickness ${t}mm outside plausible range 5–300 · check units`, 422);
      }
    }

    if (input.moisture_content_pct != null) {
      if (input.moisture_content_pct < 0 || input.moisture_content_pct > 100) {
        throw new MaterialsError("invalid_input", "moisture_content_pct must be 0–100", 422);
      }
    }
  }

  computeVolume(m: BoardMeasurementRow): BoardVolume {
    const avgWidth     = (m.width_end_a_mm + m.width_centre_mm + m.width_end_b_mm) / 3;
    const avgThickness = (m.thickness_end_a_mm + m.thickness_centre_mm + m.thickness_end_b_mm) / 3;
    const volume_mm3   = m.length_mm * avgWidth * avgThickness;
    const volume_m3    = volume_mm3 / 1_000_000_000;

    const length_in    = m.length_mm    / MM_PER_INCH;
    const width_in     = avgWidth       / MM_PER_INCH;
    const thickness_in = avgThickness   / MM_PER_INCH;
    const volume_bf    = (length_in * width_in * thickness_in) / 144;

    return {
      board_id: m.board_id,
      volume_mm3,
      volume_m3,
      volume_board_feet: volume_bf,
      from_measurement_id: m.id,
    };
  }
}
