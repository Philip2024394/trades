// src/app/nex-native/business-setup/_shared.ts
//
// Shared brand tokens + utility for the Business NEX Activation wizard.
// Mirror of /create-account tokens so the activation flow reads as a
// continuation of the sealed brand language.

export const NEX = {
  bg: "#020914",
  panel: "#03101D",
  panelSoft: "rgba(6, 15, 28, 0.72)",
  fieldBg: "#04101F",
  textPrimary: "#F2F5F8",
  textSecondary: "#7D9BC0",
  textMute: "#526B89",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  cyanFaint: "rgba(0, 175, 255, 0.18)",
  orange: "#FF7200",
  success: "#22C55E",
  destructive: "#F97066",
};

export const FONT_STACK =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

/** Three-state chip semantics for the "Your choice" indicator
 *  (Rev 6 clarification #4). */
export type ChipState =
  | "none"           // following recommendation; nothing to show
  | "saved_on"      // override: true persisted (not recommended by subtype)
  | "saved_off"      // override: false persisted (recommended by subtype)
  | "unsaved_on"     // wizard toggle: true, not yet in DB
  | "unsaved_off"    // wizard toggle: false, not yet in DB
  | "will_remove";   // owner is reverting a saved override back to recommendation

export function computeChipState({
  recommended,
  saved_override,
  wizard_toggle,
}: {
  recommended: boolean;
  saved_override: boolean | undefined; // undefined = no saved override
  wizard_toggle: boolean | undefined;  // undefined = no wizard change this session
}): ChipState {
  // Compute what the user is currently expressing (wizard wins if present)
  const effective = wizard_toggle !== undefined ? wizard_toggle : saved_override;
  const wizardTouched = wizard_toggle !== undefined;

  // Will the final persisted override exist?
  const willHaveOverride =
    effective !== undefined && effective !== recommended;

  // Case: owner is reverting a saved override back to recommendation
  if (saved_override !== undefined && wizardTouched && wizard_toggle === recommended) {
    return "will_remove";
  }

  if (wizardTouched) {
    if (!willHaveOverride) return "none";
    return wizard_toggle ? "unsaved_on" : "unsaved_off";
  }

  if (saved_override !== undefined) {
    return saved_override ? "saved_on" : "saved_off";
  }

  return "none";
}

/** Chip label for a given state. The owner reads these on hover and in
 *  the aggregate count row at the top of Step 4. */
export function chipLabel(state: ChipState): string | null {
  switch (state) {
    case "none":        return null;
    case "saved_on":    return "Saved · your choice";
    case "saved_off":   return "Saved · you turned this off";
    case "unsaved_on":  return "Changed · will save on";
    case "unsaved_off": return "Changed · will save off";
    case "will_remove": return "Will remove saved choice";
  }
}
