// Editing Platform · types.
//
// Users modify the Design Document · never the image. Every edit is a
// high-level command interpreted into a Design History Operation.
//
// Doctrine: docs/brains/nex-phase-e5-e7-editing-delivery-design-memory-philip-2026-08-04.md

export type EditIntent =
  | "move"                               // "move the staircase 300mm left"
  | "resize"                             // "make the logo 15% larger"
  | "replace_material"                   // "replace oak with walnut"
  | "recolor"                            // "make the handrail darker"
  | "rotate"                             // "rotate the camera 15 degrees right"
  | "delete"                             // "remove the badge"
  | "add"                                // "add a QR code bottom right"
  | "change_camera"                      // "switch to Instagram camera"
  | "change_lighting"                    // "switch to golden hour"
  | "change_theme"                       // "use the luxury_burgundy theme"
  | "custom";

export type EditDirection = "left" | "right" | "up" | "down" | "in" | "out";

export type EditCommand = {
  intent: EditIntent;
  target_path?: string;                  // JSON-pointer into DesignDocument
  target_id?: string;                    // optional object id (e.g. "handrail")

  // Payloads (only the ones relevant to the intent are populated)
  amount_mm?: number;                    // for move · resize
  amount_pct?: number;                   // for resize
  direction?: EditDirection;
  from?: string;                         // for replace_material · recolor · change_*
  to?: string;
  hex_delta?: string;                    // e.g. "-15%" darker

  raw_text: string;                      // the original user command · always retained
  confidence: number;                    // 0..1 · parser certainty
};

export type EditParseResult = {
  commands: readonly EditCommand[];
  warnings: readonly string[];
  unrecognized_fragments: readonly string[];
};
