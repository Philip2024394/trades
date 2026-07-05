// Assembly Slot Registry.
//
// "Does this increase the amount of reusable knowledge inside the
//  platform? If yes, we're moving in the right direction."
//
// Named UI + Studio locations where Assembly Rules can inject content.
// The registry is a whitelist — rule actions targeting unknown slots
// throw at register time. This keeps auto-assembly inspectable and
// prevents modules from writing to arbitrary DOM locations.
//
// New slots land here first, then rules can reference them. No
// coincidental exposure.

export type SlotDefinition = {
  id: string;
  /** Where the slot lives — informational, not runtime-checked. */
  surface: "home" | "nav" | "page" | "section" | "studio";
  /** Human description shown in the merchant's install log. */
  description: string;
  /** Optional cap — if the slot only allows one action, later rules
   *  need higher priority to win. */
  maxOccupants?: number;
};

export const SLOT_REGISTRY: readonly SlotDefinition[] = [
  // ─── Home page slots ─────────────────────────────────────
  {
    id: "home.primary-cta",
    surface: "home",
    description: "The single most important call-to-action on the home page.",
    maxOccupants: 1
  },
  {
    id: "home.secondary-cta",
    surface: "home",
    description: "Backup CTA below the primary, typically WhatsApp or phone.",
    maxOccupants: 1
  },
  {
    id: "home.tool-strip",
    surface: "home",
    description: "Strip of quick tools (calculators, booking, quote form) below the hero."
  },
  {
    id: "home.trust-strip",
    surface: "home",
    description: "Verified badges + certifications row.",
    maxOccupants: 1
  },

  // ─── Navigation slots ────────────────────────────────────
  {
    id: "nav.header",
    surface: "nav",
    description: "Main header nav — 6-8 items max."
  },
  {
    id: "nav.footer",
    surface: "nav",
    description: "Footer navigation, deeper links."
  },
  {
    id: "nav.mobile-drawer",
    surface: "nav",
    description: "Slide-out drawer on mobile."
  },
  {
    id: "nav.floating-action",
    surface: "nav",
    description: "Floating action button — one only on mobile.",
    maxOccupants: 1
  },

  // ─── Page slots ──────────────────────────────────────────
  {
    id: "page.services",
    surface: "page",
    description: "The services page — where calculators, service lists live."
  },
  {
    id: "page.about",
    surface: "page",
    description: "About / meet the team page."
  },
  {
    id: "page.contact",
    surface: "page",
    description: "Contact page with form, coverage map, phone."
  },
  {
    id: "page.projects",
    surface: "page",
    description: "Portfolio / recent work page."
  },
  {
    id: "page.pricing",
    surface: "page",
    description: "Pricing / trade account page."
  },

  // ─── Studio slots (dashboard etc.) ───────────────────────
  {
    id: "studio.home.above-fold",
    surface: "studio",
    description: "Merchant's Studio dashboard, above the fold."
  },
  {
    id: "studio.growth-coach-nudge",
    surface: "studio",
    description: "Growth Coach card slot — suggestions land here."
  }
] as const;

// ─── Lookups ─────────────────────────────────────────────────

const SLOT_INDEX = new Map(SLOT_REGISTRY.map((s) => [s.id, s]));

export function getSlot(id: string): SlotDefinition | undefined {
  return SLOT_INDEX.get(id);
}

export function isKnownSlot(id: string): boolean {
  return SLOT_INDEX.has(id);
}

export function listSlotsBySurface(
  surface: SlotDefinition["surface"]
): SlotDefinition[] {
  return SLOT_REGISTRY.filter((s) => s.surface === surface);
}
