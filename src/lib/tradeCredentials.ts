// Per-trade UK qualifications + universal trade-membership map used by the
// Premium Customisation panel and the public "What to know" section.
//
// Sources: NICEIC, NAPIT, Gas Safe Register, CITB / CSCS card scheme,
// CISRS scaffolding card scheme, NFRC, FMB, NVQ qualification frameworks
// and the OFTEC / WaterSafe / F-Gas competent-person schemes.
//
// Mirrors `src/lib/tradePricingUnits.ts` — same shape, same per-trade map
// approach, with a `qualificationsForTrade` helper that falls back to
// `GENERIC_QUALIFICATIONS` when the slug isn't in the map.

export type CredentialOption = { value: string; label: string };

export const TRADE_QUALIFICATIONS: Record<string, CredentialOption[]> = {
  drywaller: [
    { value: "NVQ Level 2 Drylining", label: "NVQ Level 2 Drylining" },
    { value: "NVQ Level 3 Drylining", label: "NVQ Level 3 Drylining" },
    { value: "CSCS Gold Card", label: "CSCS Gold Card" },
    { value: "CSCS Blue Card", label: "CSCS Blue Card" },
    { value: "Site Safety Plus", label: "Site Safety Plus" }
  ],
  plasterer: [
    { value: "NVQ Level 2 Plastering", label: "NVQ Level 2 Plastering" },
    { value: "NVQ Level 3 Plastering", label: "NVQ Level 3 Plastering" },
    { value: "C&G Plastering", label: "City & Guilds Plastering" },
    { value: "CSCS Gold Card", label: "CSCS Gold Card" },
    { value: "EWI Installer", label: "EWI installer card" }
  ],
  electrician: [
    { value: "18th Edition", label: "18th Edition (BS 7671)" },
    { value: "Part P", label: "Part P registered" },
    { value: "NVQ Level 3 Electrical", label: "NVQ Level 3 Electrical Installation" },
    { value: "C&G 2391", label: "City & Guilds 2391 (testing)" },
    { value: "ECS Gold Card", label: "ECS Gold Card" },
    { value: "EV Charge Installer", label: "EV Charge Installer" }
  ],
  scaffolder: [
    { value: "CISRS Trainee", label: "CISRS Trainee card" },
    { value: "CISRS Basic", label: "CISRS Basic Scaffolder" },
    { value: "CISRS Advanced", label: "CISRS Advanced Scaffolder" },
    { value: "CISRS Inspector", label: "CISRS Scaffold Inspector" },
    { value: "CISRS Card", label: "CISRS Card holder" },
    { value: "Working at Height", label: "Working at Height trained" }
  ],
  tiler: [
    { value: "NVQ Level 2 Wall & Floor Tiling", label: "NVQ Level 2 Wall & Floor Tiling" },
    { value: "NVQ Level 3 Wall & Floor Tiling", label: "NVQ Level 3 Wall & Floor Tiling" },
    { value: "CSCS Gold Card", label: "CSCS Gold Card" },
    { value: "Wet-room Installer", label: "Wet-room installer" }
  ],
  plumber: [
    { value: "Gas Safe", label: "Gas Safe registered" },
    { value: "WaterSafe", label: "WaterSafe approved" },
    { value: "NVQ Level 3 Plumbing", label: "NVQ Level 3 Plumbing & Heating" },
    { value: "OFTEC", label: "OFTEC oil heating" },
    { value: "F-Gas", label: "F-Gas (refrigerant)" },
    { value: "Unvented Hot Water", label: "Unvented Hot Water (G3)" }
  ],
  carpenter: [
    { value: "NVQ Level 2 Site Carpentry", label: "NVQ Level 2 Site Carpentry" },
    { value: "NVQ Level 3 Site Carpentry", label: "NVQ Level 3 Site Carpentry" },
    { value: "CSCS Gold Card", label: "CSCS Gold Card" },
    { value: "CSCS Blue Card", label: "CSCS Blue Card" },
    { value: "First Aid at Work", label: "First Aid at Work" }
  ],
  joiner: [
    { value: "NVQ Level 2 Bench Joinery", label: "NVQ Level 2 Bench Joinery" },
    { value: "NVQ Level 3 Bench Joinery", label: "NVQ Level 3 Bench Joinery" },
    { value: "C&G Bench Joinery", label: "City & Guilds Bench Joinery" },
    { value: "CSCS Gold Card", label: "CSCS Gold Card" }
  ],
  painter: [
    { value: "NVQ Level 2 Painting & Decorating", label: "NVQ Level 2 Painting & Decorating" },
    { value: "NVQ Level 3 Painting & Decorating", label: "NVQ Level 3 Painting & Decorating" },
    { value: "CSCS Gold Card", label: "CSCS Gold Card" },
    { value: "PASMA", label: "PASMA (mobile towers)" }
  ],
  roofer: [
    { value: "NVQ Level 2 Roof Slating & Tiling", label: "NVQ Level 2 Roof Slating & Tiling" },
    { value: "NVQ Level 3 Roof Slating & Tiling", label: "NVQ Level 3 Roof Slating & Tiling" },
    { value: "NFRC Member", label: "NFRC member" },
    { value: "IPAF", label: "IPAF (powered access)" },
    { value: "Working at Height", label: "Working at Height trained" },
    { value: "CSCS Gold Card", label: "CSCS Gold Card" }
  ],
  bricklayer: [
    { value: "NVQ Level 2 Bricklaying", label: "NVQ Level 2 Bricklaying" },
    { value: "NVQ Level 3 Bricklaying", label: "NVQ Level 3 Bricklaying" },
    { value: "CSCS Gold Card", label: "CSCS Gold Card" },
    { value: "CSCS Blue Card", label: "CSCS Blue Card" }
  ],
  stonemason: [
    { value: "NVQ Level 2 Stonemasonry", label: "NVQ Level 2 Stonemasonry" },
    { value: "NVQ Level 3 Stonemasonry", label: "NVQ Level 3 Stonemasonry" },
    { value: "CSCS Gold Card", label: "CSCS Gold Card" },
    { value: "Heritage Conservation", label: "Heritage / Conservation trained" }
  ],
  groundworker: [
    { value: "NVQ Level 2 Construction Operations", label: "NVQ Level 2 Construction Operations" },
    { value: "NVQ Level 3 Construction Operations", label: "NVQ Level 3 Construction Operations" },
    { value: "CPCS Plant Operator", label: "CPCS Plant Operator card" },
    { value: "NRSWA Street Works", label: "NRSWA Street Works (Op + Supervisor)" },
    { value: "CSCS Gold Card", label: "CSCS Gold Card" }
  ],
  "general-builder": [
    { value: "CSCS Manager", label: "CSCS Manager (Black) card" },
    { value: "CSCS Gold Card", label: "CSCS Gold Card" },
    { value: "NVQ Site Supervision", label: "NVQ Site Supervision (SSSTS)" },
    { value: "SMSTS", label: "SMSTS site management" },
    { value: "First Aid at Work", label: "First Aid at Work" }
  ],
  "concrete-specialist": [
    { value: "NVQ Level 2 Concreting", label: "NVQ Level 2 Concreting" },
    { value: "NVQ Level 3 Concreting", label: "NVQ Level 3 Concreting" },
    { value: "CPCS Concrete Pump", label: "CPCS Concrete Pump operator" },
    { value: "CSCS Gold Card", label: "CSCS Gold Card" }
  ],
  renderer: [
    { value: "NVQ Level 2 Plastering", label: "NVQ Level 2 Plastering (solid)" },
    { value: "NVQ Level 3 Plastering", label: "NVQ Level 3 Plastering (solid)" },
    { value: "EWI Installer", label: "EWI installer card" },
    { value: "CSCS Gold Card", label: "CSCS Gold Card" },
    { value: "Silicone / K-Rend trained", label: "Silicone / K-Rend trained" }
  ],
  "taper-and-finisher": [
    { value: "NVQ Level 2 Drylining", label: "NVQ Level 2 Drylining (finishing)" },
    { value: "NVQ Level 3 Drylining", label: "NVQ Level 3 Drylining (finishing)" },
    { value: "CSCS Gold Card", label: "CSCS Gold Card" },
    { value: "C&G Drylining", label: "City & Guilds Drylining" }
  ]
};

// Universal fallback when the primary_trade doesn't appear in the map.
export const GENERIC_QUALIFICATIONS: CredentialOption[] = [
  { value: "CSCS", label: "CSCS card holder" },
  { value: "Site Safety", label: "Site Safety Plus" },
  { value: "First Aid at Work", label: "First Aid at Work" }
];

// Trade memberships are universal — any trade can be a member, so we keep
// a single list rather than per-trade overrides.
export const TRADE_MEMBERSHIPS: CredentialOption[] = [
  { value: "FMB", label: "Federation of Master Builders" },
  { value: "NICEIC", label: "NICEIC" },
  { value: "NAPIT", label: "NAPIT" },
  { value: "Gas Safe Register", label: "Gas Safe Register" },
  { value: "WaterSafe", label: "WaterSafe" },
  { value: "TrustMark", label: "TrustMark government-endorsed" },
  { value: "Which? Trusted Trader", label: "Which? Trusted Trader" },
  { value: "NFRC", label: "National Federation of Roofing Contractors" },
  { value: "NAS", label: "National Association of Scaffolding Contractors" },
  { value: "CISRS", label: "CISRS card scheme" },
  { value: "Guild of Master Craftsmen", label: "Guild of Master Craftsmen" },
  { value: "Checkatrade", label: "Checkatrade member" }
];

export const INSURANCE_AMOUNTS: { value: number; label: string }[] = [
  { value: 1000000, label: "£1 million" },
  { value: 2000000, label: "£2 million" },
  { value: 5000000, label: "£5 million" },
  { value: 10000000, label: "£10 million" }
];

export function qualificationsForTrade(
  slug: string | null | undefined
): CredentialOption[] {
  if (!slug) return GENERIC_QUALIFICATIONS;
  return TRADE_QUALIFICATIONS[slug] ?? GENERIC_QUALIFICATIONS;
}
