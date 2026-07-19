// Home Care — retention hook app. AUTO-INSTALLED for every new
// homeowner (defaultInstalled: true) so the sticky "when did I last
// service the boiler / clean the gutters" reminders show from day one.
//
// Answers ONE question: "What in the house needs looking after next?"
// Retention lever: pings the homeowner unprompted after the project
// ships. Without this app installed, month-2 usage drops off a cliff.

import type { SiteBookAppManifest } from "../_shared/manifest";

const manifest: SiteBookAppManifest = {
  slug:            "home-care",
  name:            "Home Care",
  shortName:       "Care",
  description:     "Reminders for the fitted things in your home. Boiler service, gutter clean, chimney sweep — no more silent expiries.",
  longDescription:
    "Every fitted item or seasonal chore that comes due (boiler service, gutter clean, chimney sweep, smoke-alarm batteries, gas safety check, roof inspection). SiteBook silently pings you and suggests rebooking the trade who did it last — one tap to WhatsApp. Installed by default because it's the thing that keeps SiteBook useful after the project ends.",
  icon:            "CalendarClock",
  brandColour:     "#166534",
  category:        "maintenance",
  cost:            { kind: "free" },
  defaultInstalled: true,

  slots: [
    { slot: "left-rail",     order: 30 },
    { slot: "composer-chip", order: 30 }
  ],

  badges: ["Free", "Default"]
};

export default manifest;
