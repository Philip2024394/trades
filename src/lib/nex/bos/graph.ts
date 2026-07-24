// Construction Knowledge Graph — trade-centric lookup.
//
// Every trade is a node. Edges point at tools, materials, regulations,
// suppliers, common problems, and adjacent trades. Callers ask "what
// do I know about plumbing?" and get a structured snapshot.
//
// This is a static seed set for the trades Nex currently understands
// well. Adding a new trade = one entry here. The world/global +
// regional overrides (Phase 20/21) layer on top when the merchant
// operates outside the UK default.

import { evidenceFor, type Evidence } from "./types";

export type TradeGraphNode = {
  trade:            string;
  label:            string;
  tools:            string[];
  materials:        string[];
  regulations:      string[];
  common_suppliers: string[];
  skills:           string[];
  common_problems:  string[];
  adjacent_trades:  string[];
  evidence:         Evidence;
};

const NOW = () => new Date().toISOString();

const NODES: Omit<TradeGraphNode, "evidence">[] = [
  {
    trade: "plumbing", label: "Plumbing",
    tools: ["pipe cutter", "PEX crimper", "torch", "wrench set", "leak detector"],
    materials: ["copper 15mm", "PEX 15mm", "MDPE 25mm", "solder", "PTFE tape", "compression fittings", "waste pipe"],
    regulations: ["Part G (water)", "Part H (drainage)", "Water Fittings Regulations 1999"],
    common_suppliers: ["Plumbase", "Wolseley", "Screwfix Trade"],
    skills: ["hot/cold pressure test", "bending copper", "solder joints", "leak diagnostics"],
    common_problems: ["airlocks", "limescale", "pinhole leaks", "wrong flow direction on TRVs"],
    adjacent_trades: ["heating", "gas_safe", "bathroom_fitting"]
  },
  {
    trade: "electrical", label: "Electrical",
    tools: ["multimeter", "PAT tester", "insulation tester", "cable stripper", "torque screwdriver"],
    materials: ["6242Y T&E", "6491X singles", "consumer unit", "RCBOs", "back boxes", "socket outlets"],
    regulations: ["18th Edition BS 7671", "Part P (dwellings)", "EAWR 1989"],
    common_suppliers: ["City Electrical Factors", "Rexel", "Screwfix Trade"],
    skills: ["cable calc", "loop impedance", "insulation resistance", "certification"],
    common_problems: ["nuisance tripping", "loose neutrals", "wrong CPC size", "unbalanced ring main"],
    adjacent_trades: ["ev_charger", "solar_pv", "hvac"]
  },
  {
    trade: "carpentry", label: "Carpentry",
    tools: ["mitre saw", "circular saw", "impact driver", "block plane", "clamps"],
    materials: ["C16/C24 CLS", "OSB3", "ply 18mm", "MDF 18mm", "hardwoods", "screws #8", "nails"],
    regulations: ["Part A (structure) for joists/rafters", "TRADA Timber Frame Manual"],
    common_suppliers: ["Selco", "Jewson", "Travis Perkins", "MKM"],
    skills: ["cutting to length", "housing joints", "reading plans", "levelling floors"],
    common_problems: ["twisted timber", "wrong grade", "insufficient joist depth"],
    adjacent_trades: ["joinery", "kitchen_fitting", "roofing"]
  },
  {
    trade: "roofing", label: "Roofing",
    tools: ["slate ripper", "gauge", "hammer stapler", "aviation snips", "roof harness"],
    materials: ["slate", "concrete tiles", "underlay", "flashing", "lead", "gutter", "fascia"],
    regulations: ["Part C (weather)", "BS 5534 slating & tiling", "Working at Height Regs 2005"],
    common_suppliers: ["SIG Roofing", "JJ Roofing", "Screwfix Trade"],
    skills: ["gauging courses", "cutting slate/tiles", "flashing", "safe scaffolding"],
    common_problems: ["nail sickness", "wet valleys", "wrong pitch for chosen tile", "penetrations without proper flashing"],
    adjacent_trades: ["scaffolding", "leadwork", "solar_pv"]
  },
  {
    trade: "bricklaying", label: "Bricklaying",
    tools: ["trowel", "spirit level", "line pins", "brick jointer", "raker"],
    materials: ["facing brick", "common brick", "block dense", "mortar M4", "wall ties", "DPC"],
    regulations: ["Part A (structure)", "Part C (moisture)", "BS 5628-3 masonry"],
    common_suppliers: ["Ibstock (via merchant)", "MKM", "Travis Perkins"],
    skills: ["cavity coursing", "gauge staff", "reveals", "quoins"],
    common_problems: ["efflorescence", "wall ties missing", "wrong mortar for exposure zone"],
    adjacent_trades: ["stone_masonry", "concrete", "plastering"]
  },
  {
    trade: "plastering", label: "Plastering",
    tools: ["hawk", "trowel", "float", "mixing paddle", "corner beads"],
    materials: ["bonding coat", "multi-finish", "browning", "plasterboard 12.5mm", "scrim tape"],
    regulations: ["Part E (sound) for separating walls", "BS EN 13279 gypsum"],
    common_suppliers: ["Selco", "MKM", "Jewson"],
    skills: ["mixing consistency", "backing coat depth", "polishing", "external corners"],
    common_problems: ["blowing", "cracking at joints", "wrong mix for backing", "over-polishing"],
    adjacent_trades: ["dryliner", "painter_decorator"]
  },
  {
    trade: "tiling", label: "Tiling",
    tools: ["wet cutter", "notched trowel", "manual cutter", "spirit level"],
    materials: ["ceramic tiles", "porcelain tiles", "S1 flexible adhesive", "epoxy grout", "SLC"],
    regulations: ["BS 5385 tiling", "wet-room parts of Approved Document E"],
    common_suppliers: ["Topps Tiles trade", "CTD", "Tile Giant"],
    skills: ["setting out", "reveal cuts", "waterproofing on wet rooms", "grouting"],
    common_problems: ["hollow tiles", "grout cracking at movement joints", "wrong adhesive for substrate"],
    adjacent_trades: ["bathroom_fitting", "kitchen_fitting", "waterproofing"]
  },
  {
    trade: "heating", label: "Heating",
    tools: ["flue gas analyser", "gas manometer", "pipe bender", "torch", "PAT tester"],
    materials: ["combi boiler", "radiators", "TRVs", "buffer tanks", "22mm copper", "PEX"],
    regulations: ["Gas Safety (I&U) Regs 1998", "Part L (efficiency)", "Boiler Plus 2018"],
    common_suppliers: ["Plumbase", "City Plumbing", "Wolseley"],
    skills: ["gas tightness test", "flue location rules", "radiator balancing", "commissioning"],
    common_problems: ["oversized boilers", "wrong flue termination", "no MI on cascade"],
    adjacent_trades: ["plumbing", "gas_safe", "heat_pump"]
  }
];

/** Return the node for a trade slug (case-insensitive match on
 *  `trade` or on `label`). */
export function getTradeNode(trade: string): TradeGraphNode | null {
  const norm = trade.trim().toLowerCase();
  const found = NODES.find((n) => n.trade === norm || n.label.toLowerCase() === norm);
  if (!found) return null;
  return { ...found, evidence: evidenceFor(`bos.graph seed for ${found.trade}`, []) };
}

/** All known trade slugs. */
export function knownTrades(): string[] {
  return NODES.map((n) => n.trade);
}

/** Given a partial trade name, list matches. Used by the chat classifier. */
export function findTradesMatching(query: string): TradeGraphNode[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return NODES
    .filter((n) => n.trade.includes(q) || n.label.toLowerCase().includes(q))
    .map((n) => ({ ...n, evidence: evidenceFor(`bos.graph seed for ${n.trade}`, []) }));
}
