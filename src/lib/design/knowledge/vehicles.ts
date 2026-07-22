// UK van model catalog for the Design OS. Ordered by fleet share.
// Every entry carries the spec needed to prompt-engineer accurate
// renders (body length, roof height, generation years, doors config).
//
// Source: Philip's canonical UK van list (batch 2), cross-referenced
// with common trade fleet composition.

export type VanSize = "small" | "medium" | "large";

export type VehicleSpec = {
  slug:         string;
  displayName:  string;
  manufacturer: string;
  size:         VanSize;
  years:        string;                     // generation years e.g. "2013-2023"
  bodies:       string[];                   // e.g. ["L1H1", "L2H1", "L2H2"]
  sliding_door: boolean;
  rear_config:  "barn-doors" | "tailgate";
  fleet_notes:  string;                     // "most common trade van UK" etc
};

export const VEHICLE_CATALOG: VehicleSpec[] = [
  // Medium vans — the trade backbone
  { slug: "ford-transit-custom", displayName: "Ford Transit Custom", manufacturer: "Ford", size: "medium",
    years: "2013-present", bodies: ["L1H1","L2H1","L2H2"], sliding_door: true, rear_config: "barn-doors",
    fleet_notes: "Most common UK trade van" },
  { slug: "mercedes-vito", displayName: "Mercedes-Benz Vito", manufacturer: "Mercedes", size: "medium",
    years: "2014-present", bodies: ["L1","L2","L3"], sliding_door: true, rear_config: "barn-doors",
    fleet_notes: "Premium trade + service fleet" },
  { slug: "vauxhall-vivaro", displayName: "Vauxhall Vivaro", manufacturer: "Vauxhall", size: "medium",
    years: "2019-present", bodies: ["L1H1","L2H1"], sliding_door: true, rear_config: "barn-doors",
    fleet_notes: "UK fleet common alternative to Transit Custom" },
  { slug: "renault-trafic", displayName: "Renault Trafic", manufacturer: "Renault", size: "medium",
    years: "2014-present", bodies: ["L1H1","L2H1","L2H2"], sliding_door: true, rear_config: "barn-doors",
    fleet_notes: "Common trade fleet" },
  { slug: "vw-transporter-t6", displayName: "VW Transporter T6.1", manufacturer: "Volkswagen", size: "medium",
    years: "2015-2024", bodies: ["SWB","LWB"], sliding_door: true, rear_config: "barn-doors",
    fleet_notes: "Premium trade + camper conversion" },
  { slug: "peugeot-expert", displayName: "Peugeot Expert", manufacturer: "Peugeot", size: "medium",
    years: "2016-present", bodies: ["L1","L2","L3"], sliding_door: true, rear_config: "barn-doors",
    fleet_notes: "PSA group medium" },
  { slug: "citroen-dispatch", displayName: "Citroen Dispatch", manufacturer: "Citroen", size: "medium",
    years: "2016-present", bodies: ["L1","L2","L3"], sliding_door: true, rear_config: "barn-doors",
    fleet_notes: "PSA group medium (Expert sibling)" },
  { slug: "toyota-proace", displayName: "Toyota Proace", manufacturer: "Toyota", size: "medium",
    years: "2016-present", bodies: ["L1","L2"], sliding_door: true, rear_config: "barn-doors",
    fleet_notes: "Toyota-badged PSA medium" },

  // Large vans — big fleet + fit-out
  { slug: "ford-transit", displayName: "Ford Transit", manufacturer: "Ford", size: "large",
    years: "2014-present", bodies: ["L2H2","L3H2","L4H3"], sliding_door: true, rear_config: "barn-doors",
    fleet_notes: "The classic UK large van" },
  { slug: "mercedes-sprinter", displayName: "Mercedes-Benz Sprinter", manufacturer: "Mercedes", size: "large",
    years: "2018-present", bodies: ["L1H1","L2H2","L3H2","L4H3"], sliding_door: true, rear_config: "barn-doors",
    fleet_notes: "Premium large + conversion fleet standard" },
  { slug: "vw-crafter", displayName: "VW Crafter", manufacturer: "Volkswagen", size: "large",
    years: "2017-present", bodies: ["L3H2","L3H3","L4H3","L5H3"], sliding_door: true, rear_config: "barn-doors",
    fleet_notes: "MAN-related large van" },
  { slug: "renault-master", displayName: "Renault Master", manufacturer: "Renault", size: "large",
    years: "2010-present", bodies: ["L1H1","L2H2","L3H2","L3H3","L4H3"], sliding_door: true, rear_config: "barn-doors",
    fleet_notes: "Common large van, groundworks + delivery" },
  { slug: "iveco-daily", displayName: "Iveco Daily", manufacturer: "Iveco", size: "large",
    years: "2014-present", bodies: ["L2H1","L3H2","L4H3"], sliding_door: true, rear_config: "barn-doors",
    fleet_notes: "Heavy-duty large" },

  // Small vans — plumbing, electrical, mobile trades
  { slug: "ford-transit-connect", displayName: "Ford Transit Connect", manufacturer: "Ford", size: "small",
    years: "2013-present", bodies: ["L1","L2"], sliding_door: true, rear_config: "barn-doors",
    fleet_notes: "Common small trade van" },
  { slug: "citroen-berlingo", displayName: "Citroen Berlingo", manufacturer: "Citroen", size: "small",
    years: "2018-present", bodies: ["M","XL"], sliding_door: true, rear_config: "barn-doors",
    fleet_notes: "PSA small trade + mobility" },
  { slug: "peugeot-partner", displayName: "Peugeot Partner", manufacturer: "Peugeot", size: "small",
    years: "2018-present", bodies: ["Standard","Long"], sliding_door: true, rear_config: "barn-doors",
    fleet_notes: "PSA small trade" },
  { slug: "vauxhall-combo", displayName: "Vauxhall Combo", manufacturer: "Vauxhall", size: "small",
    years: "2018-present", bodies: ["L1","L2"], sliding_door: true, rear_config: "barn-doors",
    fleet_notes: "PSA small trade (Combo)" },
  { slug: "vw-caddy", displayName: "VW Caddy", manufacturer: "Volkswagen", size: "small",
    years: "2020-present", bodies: ["SWB","Maxi"], sliding_door: true, rear_config: "barn-doors",
    fleet_notes: "Premium small trade van" },
  { slug: "renault-kangoo", displayName: "Renault Kangoo", manufacturer: "Renault", size: "small",
    years: "2021-present", bodies: ["L1","L2"], sliding_door: true, rear_config: "barn-doors",
    fleet_notes: "Small trade + mobility" }
];

export function vehicleBySlug(slug: string): VehicleSpec | undefined {
  return VEHICLE_CATALOG.find((v) => v.slug === slug);
}
