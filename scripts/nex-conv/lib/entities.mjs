// ADR-0044 MVP · staircase-brain entity ontology.
// Curated from the existing Reference Brain docs. Every entity slug + alias
// here is a genuine staircase-domain term. Aliases are the real words
// customers use. Rule: no fabrication — a term is here only if it appears in
// the source material.
//
// entity_class enum enforced by migration 050.

export const STAIRCASE_ENTITIES = [
  // ---- Materials --------------------------------------------------------
  { slug: 'oak', display_name: 'Oak', entity_class: 'material', aliases: ['oak', 'english oak', 'european oak', 'red oak', 'white oak'] },
  { slug: 'walnut', display_name: 'Walnut', entity_class: 'material', aliases: ['walnut', 'american walnut', 'european walnut'] },
  { slug: 'ash', display_name: 'Ash', entity_class: 'material', aliases: ['ash', 'ash wood'] },
  { slug: 'pine', display_name: 'Pine', entity_class: 'material', aliases: ['pine', 'redwood', 'softwood'] },
  { slug: 'beech', display_name: 'Beech', entity_class: 'material', aliases: ['beech'] },
  { slug: 'maple', display_name: 'Maple', entity_class: 'material', aliases: ['maple'] },
  { slug: 'sapele', display_name: 'Sapele', entity_class: 'material', aliases: ['sapele', 'sapelli'] },
  { slug: 'iroko', display_name: 'Iroko', entity_class: 'material', aliases: ['iroko'] },
  { slug: 'glass', display_name: 'Glass', entity_class: 'material', aliases: ['glass', 'glazed', 'glass panel', 'glass balustrade', 'glass panels', 'kaca'] },
  { slug: 'metal', display_name: 'Metal', entity_class: 'material', aliases: ['metal', 'steel', 'brushed stainless', 'stainless steel', 'matt black metal', 'black metal', 'iron', 'wrought iron', 'powder-coated', 'logam', 'besi'] },
  { slug: 'concrete', display_name: 'Concrete', entity_class: 'material', aliases: ['concrete', 'reinforced concrete', 'concrete substructure'] },
  { slug: 'carpet', display_name: 'Carpet', entity_class: 'material', aliases: ['carpet', 'stair carpet', 'carpeted', 'runner', 'stair runner'] },
  { slug: 'timber', display_name: 'Timber', entity_class: 'material', aliases: ['timber', 'wood', 'wooden', 'hardwood'] },

  // ---- Components -------------------------------------------------------
  { slug: 'tread', display_name: 'Tread', entity_class: 'component', aliases: ['tread', 'treads', 'step', 'steps'] },
  { slug: 'riser', display_name: 'Riser', entity_class: 'component', aliases: ['riser', 'risers', 'riser board'] },
  { slug: 'nosing', display_name: 'Nosing', entity_class: 'component', aliases: ['nosing', 'nose', 'tread nose', 'front edge'] },
  { slug: 'string', display_name: 'String', entity_class: 'component', aliases: ['string', 'stringer', 'strings', 'stringers'] },
  { slug: 'closed_string', display_name: 'Closed String', entity_class: 'component', aliases: ['closed string', 'housed string', 'wall string'] },
  { slug: 'cut_string', display_name: 'Cut String', entity_class: 'component', aliases: ['cut string', 'open string', 'open stringer', 'cut stringer', 'cutstring', 'openstring'] },
  { slug: 'open_riser', display_name: 'Open Riser', entity_class: 'component', aliases: ['open riser', 'open risers', 'riserless', 'no risers'] },
  { slug: 'baluster', display_name: 'Baluster', entity_class: 'component', aliases: ['baluster', 'balusters', 'spindle', 'spindles'] },
  { slug: 'balustrade', display_name: 'Balustrade', entity_class: 'component', aliases: ['balustrade', 'balustrades', 'railing', 'railings', 'rail', 'rails', 'guarding', 'guardings'] },
  { slug: 'handrail', display_name: 'Handrail', entity_class: 'component', aliases: ['handrail', 'hand rail', 'handrails', 'pegangan tangan', 'pegangan atas'] },
  { slug: 'base_rail', display_name: 'Base Rail', entity_class: 'component', aliases: ['base rail', 'shoe rail', 'sub rail', 'sub-rail'] },
  { slug: 'newel', display_name: 'Newel', entity_class: 'component', aliases: ['newel', 'newel post', 'newels', 'newel posts', 'tiang tangga'] },
  { slug: 'newel_cap', display_name: 'Newel Cap', entity_class: 'component', aliases: ['newel cap', 'post cap', 'newel top', 'cap'] },
  { slug: 'landing', display_name: 'Landing', entity_class: 'component', aliases: ['landing', 'landings', 'half landing', 'quarter landing'] },
  { slug: 'winder', display_name: 'Winder', entity_class: 'component', aliases: ['winder', 'winders', 'winding step'] },
  { slug: 'starting_step', display_name: 'Starting Step', entity_class: 'component', aliases: ['starting step', 'bottom step', 'first step', 'feature step', 'welcome step'] },
  { slug: 'bullnose', display_name: 'Bullnose Starting Step', entity_class: 'component', aliases: ['bullnose', 'bull nose', 'rounded bottom step'] },
  { slug: 'curtail', display_name: 'Curtail Starting Step', entity_class: 'component', aliases: ['curtail', 'curtail step', 'curtail volute'] },
  { slug: 'volute', display_name: 'Volute', entity_class: 'component', aliases: ['volute', 'volutes'] },
  { slug: 'tread_return', display_name: 'Tread Return', entity_class: 'component', aliases: ['tread return', 'return', 'return moulding', 'returned nose'] },
  { slug: 'wedges', display_name: 'Wedges', entity_class: 'component', aliases: ['wedges', 'stair wedges'] },

  // ---- Styles -----------------------------------------------------------
  { slug: 'traditional', display_name: 'Traditional', entity_class: 'style', aliases: ['traditional', 'classic', 'victorian', 'edwardian', 'georgian', 'period', 'tradisional', 'klasik'] },
  { slug: 'contemporary', display_name: 'Contemporary', entity_class: 'style', aliases: ['contemporary', 'modern', 'minimalist', 'architectural', 'sleek', 'kontemporer'] },
  { slug: 'transitional', display_name: 'Transitional', entity_class: 'style', aliases: ['transitional', 'hybrid', 'in-between', 'somewhere in between'] },
  { slug: 'floating_stair', display_name: 'Floating Stair', entity_class: 'style', aliases: ['floating', 'floating stair', 'cantilever', 'cantilevered'] },
  { slug: 'spiral', display_name: 'Spiral', entity_class: 'style', aliases: ['spiral', 'helical', 'spiral staircase'] },
  { slug: 'quarter_turn', display_name: 'Quarter Turn', entity_class: 'style', aliases: ['quarter turn', 'quarter-turn', 'l-shape', 'l shape'] },
  { slug: 'half_turn', display_name: 'Half Turn', entity_class: 'style', aliases: ['half turn', 'half-turn', 'u-shape', 'u shape', 'switchback'] },
  { slug: 'straight_flight', display_name: 'Straight Flight', entity_class: 'style', aliases: ['straight', 'straight flight', 'single flight'] },

  // ---- Regulations ------------------------------------------------------
  { slug: 'building_regs', display_name: 'Building Regulations', entity_class: 'regulation', aliases: ['building regulations', 'building regs', 'approved document k', 'part k', 'regs', 'code'] },
  { slug: 'sphere_rule', display_name: '100mm Sphere Rule', entity_class: 'regulation', aliases: ['100mm sphere', 'sphere rule', 'child safety gap'] },
  { slug: 'handrail_height', display_name: 'Handrail Height (900-1000mm)', entity_class: 'regulation', aliases: ['handrail height', '900mm', '1000mm'] },

  // ---- Services / Processes --------------------------------------------
  { slug: 'installation', display_name: 'Installation', entity_class: 'service', aliases: ['installation', 'install', 'fitting', 'fitted', 'installed'] },
  { slug: 'refacing', display_name: 'Refacing', entity_class: 'service', aliases: ['refacing', 'reface', 'over-cladding', 'cladding', 'stair renovation'] },
  { slug: 'design', display_name: 'Design', entity_class: 'service', aliases: ['design', 'designing', 'designer', 'bespoke design'] },
  { slug: 'delivery', display_name: 'Delivery', entity_class: 'service', aliases: ['delivery', 'delivered', 'shipping'] },
  { slug: 'quote', display_name: 'Quote', entity_class: 'service', aliases: ['quote', 'quotation', 'estimate', 'pricing'] },

  // ---- Price dimensions -------------------------------------------------
  { slug: 'price', display_name: 'Price', entity_class: 'price_dimension', aliases: ['price', 'cost', 'costs', 'how much', 'expensive', 'cheap', 'cheaper', 'budget'] },

  // ---- Locations --------------------------------------------------------
  { slug: 'against_wall', display_name: 'Against a Wall', entity_class: 'location', aliases: ['against a wall', 'against the wall', 'wall-fixed', 'wall side', 'wall-adjacent'] },
  { slug: 'both_sides_open', display_name: 'Both Sides Open', entity_class: 'location', aliases: ['both sides open', 'freestanding', 'two-sided', 'open both sides'] },
  { slug: 'interior', display_name: 'Interior', entity_class: 'location', aliases: ['interior', 'indoor', 'inside'] },
  { slug: 'garden', display_name: 'Garden', entity_class: 'location', aliases: ['garden', 'outdoor', 'deck', 'external'] },
  { slug: 'hallway', display_name: 'Hallway', entity_class: 'location', aliases: ['hallway', 'hall', 'entrance hall', 'entry hall', 'foyer', 'koridor', 'lorong'] },
  { slug: 'loft', display_name: 'Loft Conversion', entity_class: 'location', aliases: ['loft', 'loft conversion', 'attic', 'attic conversion', 'loteng'] },
  { slug: 'extension', display_name: 'Extension', entity_class: 'location', aliases: ['extension', 'rear extension', 'side extension', 'new extension', 'ekstensi'] },

  // ---- Property type ----------------------------------------------------
  { slug: 'terrace_house', display_name: 'Terraced House', entity_class: 'other', aliases: ['terrace', 'terraced', 'terraced house', 'end-of-terrace', 'end of terrace'] },
  { slug: 'semi_detached', display_name: 'Semi-Detached', entity_class: 'other', aliases: ['semi', 'semi-detached', 'semi detached'] },
  { slug: 'detached_house', display_name: 'Detached House', entity_class: 'other', aliases: ['detached', 'detached house'] },
  { slug: 'flat', display_name: 'Flat / Apartment', entity_class: 'other', aliases: ['flat', 'apartment', 'maisonette', 'duplex'] },
  { slug: 'cottage', display_name: 'Cottage', entity_class: 'other', aliases: ['cottage'] },
  { slug: 'townhouse', display_name: 'Townhouse', entity_class: 'other', aliases: ['townhouse', 'town house'] },
  { slug: 'bungalow', display_name: 'Bungalow', entity_class: 'other', aliases: ['bungalow'] },

  // ---- Project type -----------------------------------------------------
  { slug: 'renovation', display_name: 'Renovation', entity_class: 'process', aliases: ['renovate', 'renovating', 'renovation', 'refurbish', 'refurbishing', 'refurbishment', 'doing up', 'redoing'] },
  { slug: 'replacement', display_name: 'Replacement', entity_class: 'process', aliases: ['replace', 'replacing', 'replacement', 'swap out', 'swapping', 'new staircase'] },
  { slug: 'new_build', display_name: 'New Build', entity_class: 'process', aliases: ['new build', 'new-build', 'newbuild'] },
  { slug: 'renovating_hallway', display_name: 'Renovating Hallway', entity_class: 'process', aliases: ['redo my hallway', 'renovating my hallway', 'doing up the hallway'] },

  // ---- Composite topics ------------------------------------------------
  { slug: 'staircase', display_name: 'Staircase', entity_class: 'component', aliases: ['staircase', 'stair', 'stairs', 'stairway', 'flight', 'tangga'] },
];

// Canonical intent taxonomy (subset — expanded from intent-patterns.md)
export const STAIRCASE_INTENTS = [
  { slug: 'ask_options', class: 'discover', display_name: 'Ask what options exist', example_phrases: ['what options do i have', 'what can i choose', 'what types are there', 'show me options'] },
  { slug: 'ask_definition', class: 'discover', display_name: 'Ask what something is', example_phrases: ['what is', 'what does', 'define', 'meaning of'] },
  { slug: 'specify_material', class: 'specify', display_name: 'State a material choice', example_phrases: ['i want oak', 'walnut please', 'in glass', 'make it in'] },
  { slug: 'specify_style', class: 'specify', display_name: 'State a style preference', example_phrases: ['traditional', 'modern', 'contemporary', 'somewhere in between'] },
  { slug: 'specify_constraint', class: 'specify', display_name: 'State a constraint', example_phrases: ['against a wall', 'under budget', 'both sides open'] },
  { slug: 'ask_price', class: 'price', display_name: 'Ask price', example_phrases: ['how much', 'what does it cost', 'what would it cost', 'price', 'cost', 'budget'] },
  { slug: 'ask_installation', class: 'discover', display_name: 'Ask about installation', example_phrases: ['installation', 'installed', 'fitting', 'fitted', 'delivery'] },
  { slug: 'compare', class: 'compare', display_name: 'Compare two things', example_phrases: ['compared to', 'versus', 'vs', 'difference between', 'or', 'better'] },
  { slug: 'ask_what_about', class: 'revisit', display_name: 'Elliptical follow-up (what about X)', example_phrases: ['what about', 'and if', 'how about'] },
  { slug: 'correct', class: 'correct', display_name: 'Correct a prior assumption', example_phrases: ['no i meant', 'actually', 'wait no', 'sorry i meant'] },
  { slug: 'confirm', class: 'confirm', display_name: 'Confirm', example_phrases: ['yes', 'that sounds right', 'sounds good', 'ok', 'okay'] },
  { slug: 'ask_recommendation', class: 'decide', display_name: 'Ask NEX to recommend', example_phrases: ['which is better', 'what do you recommend', 'which would you'] },
  { slug: 'clarify_customer', class: 'clarify', display_name: 'Customer asks NEX to clarify', example_phrases: ['what do you mean', 'huh', 'i dont understand'] },
  { slug: 'clarify_nex', class: 'clarify', display_name: 'NEX asks customer to clarify', example_phrases: [] },
  { slug: 'close', class: 'close', display_name: 'End conversation', example_phrases: ['thanks', 'thank you', 'thats all', 'bye'] },
  { slug: 'statement', class: 'discover', display_name: 'Generic statement (default)', example_phrases: [] },
  // Meta / conversational intents — customer is not talking about staircases,
  // they're saying hi, checking someone's there, or asking about NEX itself.
  // These MUST bypass staircase retrieval so the reply is conversational,
  // not a forced staircase answer.
  { slug: 'meta_greeting', class: 'discover', display_name: 'Greeting / hello', example_phrases: ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening'] },
  { slug: 'meta_presence', class: 'discover', display_name: 'Presence check / is anyone there', example_phrases: ['anyone online', 'anyone there', 'are you there', 'you there', 'is anyone online', 'anyone here'] },
  { slug: 'meta_identity', class: 'discover', display_name: 'Who / what are you', example_phrases: ['who are you', 'what are you', 'are you human', 'are you a bot', 'are you ai'] },
  { slug: 'meta_smalltalk', class: 'discover', display_name: 'Small-talk / how are you', example_phrases: ['how are you', 'how is it going', 'how do you do', 'nice to meet you'] },
  // Backchannel · "hmm", "ok", "yeah", "right" — the customer is thinking or
  // acknowledging. NEX must NOT restart reasoning or dump options; short reply,
  // stay in current thread. No full retrieval refresh.
  { slug: 'backchannel', class: 'discover', display_name: 'Backchannel / thinking noise', example_phrases: ['hmm', 'hm', 'mhm', 'ok', 'okay', 'yeah', 'yep', 'right', 'sure', 'i see', 'ah', 'oh', 'huh', 'well', 'go on'] },
  // M1-5 · summary confirmation · customer recapped multi-item spec + wants
  // us to confirm each item matches what state has, and flag anything that
  // doesn't. Distinct from a bare "confirm" which is a yes to a single thing.
  { slug: 'confirm_summary', class: 'confirm', display_name: 'Multi-item summary confirmation', example_phrases: ['to summarise', 'to summarize', 'summary:', 'so we have', 'to recap', 'let me summarise', 'sound right', 'sound about right', 'am I on the right track', 'is that all correct', 'confirm this'] },
];
