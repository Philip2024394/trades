// Finish The Job (R04) — job archetypes + expected materials.
//
// Every job archetype is a curated "for this kind of work you'll usually
// need X, Y, Z" spec — built from real trade knowledge, not scraped
// e-commerce data. When the trade adds materials to their Job Cost /
// Notebook / Site queue, the completer compares against the closest
// matching archetype and flags likely-forgotten items.
//
// Rock-solid rule: these are SUGGESTIONS, not requirements. Trade Center
// never blocks the trade from ordering — we surface the "small thing
// that stops the job in its tracks" and let the trade decide.

export type ArchetypeTag = "skim" | "ceiling" | "drywall" | "reveal" | "domestic" | "commercial" | "repair";

export type ArchetypeMaterial = {
  /** Canonical name — used for matching against existing materials. */
  name: string;
  /** Category tag for icon selection + grouping. */
  category: "primary" | "backing" | "consumable" | "fixing" | "safety" | "tool";
  /** How critical: "essential" (job blocked without it), "recommended"
   *  (usually needed), "situational" (sometimes needed). */
  criticality: "essential" | "recommended" | "situational";
  /** Short description shown in the suggestion card. */
  description: string;
};

export type JobArchetype = {
  id: string;
  label: string;                    // "Skim job"
  discipline: string;               // "Plastering"
  matchTags: ArchetypeTag[];        // used to detect this archetype from job tags
  matchMaterialNames: string[];     // matches archetype if these names appear in job materials
  expectedMaterials: ArchetypeMaterial[];
};

export const JOB_ARCHETYPE_FIXTURES: JobArchetype[] = [
  {
    id: "skim-domestic",
    label: "Skim job — domestic",
    discipline: "Plastering",
    matchTags: ["skim", "domestic"],
    matchMaterialNames: ["multi-finish", "multi finish", "thistle", "skim"],
    expectedMaterials: [
      { name: "Multi-Finish / Thistle plaster", category: "primary",    criticality: "essential",    description: "The actual finish coat" },
      { name: "Bonding coat",                   category: "backing",    criticality: "recommended",  description: "Undercoat on bare masonry / uneven substrate" },
      { name: "PVA",                            category: "consumable", criticality: "essential",    description: "Sealer over old plaster — without this you get suction issues" },
      { name: "Scrim tape",                     category: "consumable", criticality: "essential",    description: "Every drywall joint. 30 seconds' drive back to the merchant if you forget." },
      { name: "Corner beads",                   category: "fixing",     criticality: "recommended",  description: "External corners + reveals" },
      { name: "Water tub / bucket",             category: "tool",       criticality: "recommended",  description: "Clean water for mixing" },
      { name: "Dust sheets",                    category: "consumable", criticality: "recommended",  description: "Customer's carpet will thank you" },
      { name: "Skirting mask tape",             category: "consumable", criticality: "situational",  description: "Sharp line at the bottom of the wall" },
      { name: "Fine hand sander / sandpaper",   category: "tool",       criticality: "situational",  description: "For touch-ups after first pass" }
    ]
  },
  {
    id: "ceiling-repair",
    label: "Ceiling repair",
    discipline: "Plastering",
    matchTags: ["ceiling", "repair"],
    matchMaterialNames: ["ceiling", "artex", "patch"],
    expectedMaterials: [
      { name: "Multi-Finish plaster",           category: "primary",    criticality: "essential",    description: "Finish coat" },
      { name: "PVA",                            category: "consumable", criticality: "essential",    description: "Seals old artex / blown plaster" },
      { name: "Scrim tape",                     category: "consumable", criticality: "recommended",  description: "For patch edges" },
      { name: "Dust sheets",                    category: "consumable", criticality: "essential",    description: "Ceiling work = maximum mess" },
      { name: "Face mask (FFP3)",               category: "safety",     criticality: "essential",    description: "Especially if it's the old blown-plaster/artex era" },
      { name: "Aluminium feather edge",         category: "tool",       criticality: "recommended",  description: "Flat finish across the patch" }
    ]
  },
  {
    id: "drywall-fit",
    label: "Drywall fit-out",
    discipline: "Drywall",
    matchTags: ["drywall", "commercial"],
    matchMaterialNames: ["plasterboard", "drywall", "sheet"],
    expectedMaterials: [
      { name: "Plasterboard (12.5mm)",          category: "primary",    criticality: "essential",    description: "The sheets themselves" },
      { name: "Drywall screws (32mm)",          category: "fixing",     criticality: "essential",    description: "You'll forget a box eventually — grab an extra" },
      { name: "Scrim tape",                     category: "consumable", criticality: "essential",    description: "Every joint" },
      { name: "Corner beads",                   category: "fixing",     criticality: "essential",    description: "External corners" },
      { name: "Filler / jointing compound",     category: "consumable", criticality: "essential",    description: "Bedding the scrim + filling screw heads" },
      { name: "Fine hand sander",               category: "tool",       criticality: "recommended",  description: "For finish sanding before decoration" },
      { name: "Dust masks",                     category: "safety",     criticality: "recommended",  description: "Fine drywall dust — brutal on the lungs" }
    ]
  }
];
