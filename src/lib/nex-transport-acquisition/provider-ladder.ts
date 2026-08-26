// src/lib/nex-transport-acquisition/provider-ladder.ts
//
// EXPANDABLE PROVIDER LADDER for the Transport Walker.
//
// Doctrine (Philip 2026-08-23):
//   · Don't design the whole driver strategy around any ONE provider.
//   · Every provider feeds the SAME funnel:
//       DISCOVERED → voluntary registration → verification → ACTIVE
//   · The killer record is NOT "this is a transport business" · it is
//       "Saya driver Jogja — WA 08xxxx"
//     i.e. an individual driver's publicly-advertised phone.
//   · Don't spend a big chunk of code on any provider (e.g. Facebook)
//     until we KNOW we can actually get authorised API access.
//   · Instead: keep the provider architecture EXPANDABLE, and
//     concentrate on finding sources that actually expose individual
//     driver phone numbers publicly.
//
// This file is the ARCHITECTURE — a small ordered list + a status check
// per slot. Providers are configured in but marked NOT_YET_INTEGRATED
// until authorised access is proven. The walker consults the ladder to
// render honest per-provider status in every cycle summary.

export type ProviderSlotStatus =
  | "READY"                  // fully integrated + running
  | "GATED_ENV"              // integrated but disabled by env kill-switch
  | "GATED_APPROVAL"         // env-configured but external approval (e.g. Meta app-review, Google API key) not confirmed
  | "NOT_YET_INTEGRATED"     // slot reserved · no code yet · deliberate design placeholder
  | "NOT_APPLICABLE";        // does not participate this cycle for a legitimate reason

export interface ProviderSlotDescriptor {
  id: string;
  label: string;
  ladderPosition: number;                     // 1 = first attempted, higher = later fallback
  bestFor: ("individual_driver" | "transport_business" | "operator" | "logistics")[];
  publicOnly: true;                            // constitutional · no non-public source ever added to the ladder
  activationRequirements: string[];            // human-readable list of what's needed to move to READY
  checkStatus: () => { status: ProviderSlotStatus; missing?: string[]; note?: string };
}

// ── ENV helpers ─────────────────────────────────────────────────────────

function envTrue(name: string): boolean {
  return process.env[name] === "true";
}

function envSet(name: string): boolean {
  const v = process.env[name];
  return typeof v === "string" && v.length > 0;
}

// ── The ladder ──────────────────────────────────────────────────────────

export const PROVIDER_LADDER: ProviderSlotDescriptor[] = [
  {
    id: "nominatim",
    label: "Nominatim (OSM search)",
    ladderPosition: 1,
    bestFor: ["transport_business", "operator"],
    publicOnly: true,
    activationRequirements: ["public endpoint · already integrated"],
    checkStatus: () => ({ status: "READY", note: "OSM Nominatim primary search · currently active in Transport Walker cycle" }),
  },
  {
    id: "overpass",
    label: "Overpass API (OSM tag query)",
    ladderPosition: 2,
    bestFor: ["transport_business", "operator"],
    publicOnly: true,
    activationRequirements: ["public endpoint · already integrated · depends on mirror availability"],
    checkStatus: () => ({ status: "READY", note: "OSM Overpass fallback · may FAIL when public mirrors are down (external)" }),
  },
  {
    id: "facebook_public",
    label: "Facebook public Pages / Graph API",
    ladderPosition: 3,
    bestFor: ["individual_driver", "transport_business"],
    publicOnly: true,
    activationRequirements: [
      "register Meta developer app",
      "submit for Meta app-review",
      "obtain pages_read_engagement + pages_show_list scopes",
      "set NEX_FACEBOOK_PROVIDER_ENABLED=true + APP_ID + APP_SECRET + ACCESS_TOKEN",
    ],
    checkStatus: () => {
      const missing: string[] = [];
      if (!envTrue("NEX_FACEBOOK_PROVIDER_ENABLED")) missing.push("NEX_FACEBOOK_PROVIDER_ENABLED=true");
      if (!envSet("NEX_FACEBOOK_APP_ID"))            missing.push("NEX_FACEBOOK_APP_ID");
      if (!envSet("NEX_FACEBOOK_APP_SECRET"))        missing.push("NEX_FACEBOOK_APP_SECRET");
      if (!envSet("NEX_FACEBOOK_ACCESS_TOKEN"))      missing.push("NEX_FACEBOOK_ACCESS_TOKEN");
      if (missing.length > 0) return { status: "GATED_ENV", missing, note: "env not configured · zero requests will be made" };
      return { status: "GATED_APPROVAL", note: "env configured but Meta app-review approval not on record" };
    },
  },
  {
    id: "google_places",
    label: "Google Places / Google Maps Platform",
    ladderPosition: 4,
    bestFor: ["transport_business", "operator"],
    publicOnly: true,
    activationRequirements: [
      "obtain Google Cloud project + billing",
      "enable Places API (New)",
      "provision restricted API key",
      "set NEX_GOOGLE_PLACES_ENABLED=true + NEX_GOOGLE_PLACES_API_KEY",
    ],
    checkStatus: () => {
      const missing: string[] = [];
      if (!envTrue("NEX_GOOGLE_PLACES_ENABLED")) missing.push("NEX_GOOGLE_PLACES_ENABLED=true");
      if (!envSet("NEX_GOOGLE_PLACES_API_KEY"))  missing.push("NEX_GOOGLE_PLACES_API_KEY");
      if (missing.length > 0) return { status: "NOT_YET_INTEGRATED", missing, note: "provider slot reserved · no integration code yet" };
      return { status: "GATED_APPROVAL", note: "env configured but implementation deliberately deferred until approved usage plan exists" };
    },
  },
  {
    id: "public_directory_indonesia",
    label: "Other permitted public Indonesian directories",
    ladderPosition: 5,
    bestFor: ["transport_business", "operator", "individual_driver"],
    publicOnly: true,
    activationRequirements: [
      "confirm directory ToS permits automated retrieval of public listings",
      "add per-directory adapter (rate-limited · robots.txt-respectful)",
      "set NEX_DIRECTORY_<slug>_ENABLED=true per adapter",
    ],
    checkStatus: () => ({ status: "NOT_YET_INTEGRATED", note: "reserved for future permitted directory adapters · each requires its own ToS check" }),
  },
  {
    id: "public_recruitment_advertisement",
    label: "Public recruitment posts (driver-wanted / driver-offering)",
    ladderPosition: 6,
    bestFor: ["individual_driver"],
    publicOnly: true,
    activationRequirements: [
      "identify legitimate public boards where drivers post their own availability",
      "confirm ToS permits automated read of public posts",
      "add adapter with strict individual_driver_social query family",
    ],
    checkStatus: () => ({ status: "NOT_YET_INTEGRATED", note: "the HIGH-VALUE slot · target for finding 'Saya driver Jogja · WA 08xxx' style public posts" }),
  },
];

// ── Ladder inspection helpers ───────────────────────────────────────────

export interface ProviderLadderStatusRow {
  id: string;
  label: string;
  ladderPosition: number;
  bestFor: string[];
  status: ProviderSlotStatus;
  missing?: string[];
  note?: string;
}

export function describeProviderLadder(): ProviderLadderStatusRow[] {
  return PROVIDER_LADDER
    .slice()
    .sort((a, b) => a.ladderPosition - b.ladderPosition)
    .map((slot) => {
      const s = slot.checkStatus();
      return {
        id: slot.id,
        label: slot.label,
        ladderPosition: slot.ladderPosition,
        bestFor: slot.bestFor.slice(),
        status: s.status,
        missing: s.missing,
        note: s.note,
      };
    });
}

/**
 * Which ladder slots are the strongest candidates to find INDIVIDUAL DRIVER
 * public records right now? Used to focus product effort.
 */
export function individualDriverSlots(): ProviderLadderStatusRow[] {
  return describeProviderLadder().filter((r) => r.bestFor.includes("individual_driver"));
}
