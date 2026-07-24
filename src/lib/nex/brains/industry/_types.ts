// Shared types for the UK stair-industry company registry.
//
// Every entry across the six category files uses this shape so the
// aggregator can build a single detection index while keeping each
// category file focused and independently maintainable.

export type CompanyCategory =
  | "staircase_maker"      // builds complete staircases
  | "parts_supplier"       // specialist stairparts + mouldings
  | "builders_merchant"    // trade merchant (Travis Perkins, Selco, etc)
  | "diy_retailer"         // consumer DIY (B&Q, Homebase, Wickes retail)
  | "wood_supplier"        // specialist hardwood merchant (retail-focused)
  | "timber_importer"      // wholesale timber importer / distributor
  | "trade_association";   // industry body (BWF, FIRA, etc.)

export type CompanyEntry = {
  canonical: string;
  category:  CompanyCategory;
  blurb:     string;                    // neutral factual description used in Nex responses
  patterns:  RegExp[];                  // detection patterns (name variants)
  region?:   string;                    // optional geographic focus
  is_member?: boolean;                  // Network member — future use
};
