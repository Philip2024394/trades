// NEX HUD · MODES (stable · never themeable).
//
// Doctrine anchor: project_nex_workspace_identity_doctrine_2026_08_25
//
// Modes are the interior state machine. The shell stays constant across
// modes; the interior (workspace content + right rail context) swaps.
// Themes may recolour a mode's LED but must not remove or rename a mode.

export type NexHudMode =
  | "idle"        // no active tool · general controls · gentle atmosphere
  | "chatting"    // conversation in the workspace · composer live in bottom pill
  | "discovering" // discovery card stack · filter/sort controls in the rail
  | "booking"     // in-progress transaction · booking controls in the rail
  | "image"       // image being worked on · image controls in the rail
  | "document";   // document being worked on · document controls in the rail

export const MODE_LABEL: Record<NexHudMode, string> = {
  idle:        "IDLE",
  chatting:    "LISTENING",
  discovering: "DISCOVERING",
  booking:     "BOOKING",
  image:       "IMAGE",
  document:    "DOCUMENT",
};
