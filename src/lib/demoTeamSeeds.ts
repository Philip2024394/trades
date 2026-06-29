// Demo "Meet the team" rosters for Xrated Trade Off — UK 2026.
//
// Each demo profile in DEMO_TRADE_SEEDS gets a 3-4 person team here, keyed
// by trade_slug. The seed script (`scripts/seed-demo-trades.mjs`) writes
// this into hammerex_trade_off_listings.team_members (jsonb column added
// by migration 20260628060000_xrated_team_members.sql).
//
// Gender balance: aim for ~40% female across all rosters (industry is
// male-skewed but visible female representation matters for the demo).
// Names are realistic-but-not-famous and reflect the trade's region
// (e.g. Glaswegian crew = MacGregor/Sinclair, Belfast = Kavanagh/Rooney,
// Cardiff = Llewellyn/Pritchard, etc.).
//
// Avatar URLs use randomuser.me's deterministic portrait endpoints:
//   male   -> https://randomuser.me/api/portraits/men/{1-99}.jpg
//   female -> https://randomuser.me/api/portraits/women/{1-99}.jpg
// Numbers are varied within and across rosters to avoid the same face
// appearing twice on one demo page.

export type DemoTeamMember = {
  name: string;
  role: string;
  years_experience: number | null;
  avatar_url: string | null;
  skills: string[];
};

export const DEMO_TEAM_SEEDS: Record<string, DemoTeamMember[]> = {
  // 1. DRYWALLER — Manchester (Marcus Okafor)
  drywaller: [
    { name: "Marcus Okafor", role: "Lead Drywaller / Owner", years_experience: 14, avatar_url: "https://randomuser.me/api/portraits/men/11.jpg", skills: ["Metal frame systems", "Acoustic walls", "Soundproofing"] },
    { name: "Sasha Ahmed", role: "Senior Boarder", years_experience: 9, avatar_url: "https://randomuser.me/api/portraits/women/12.jpg", skills: ["Stud partitions", "Ceiling grids", "Edge taping"] },
    { name: "Ryan Patterson", role: "Apprentice Drywaller", years_experience: 2, avatar_url: "https://randomuser.me/api/portraits/men/13.jpg", skills: ["Board cutting", "Site clean-down"] },
    { name: "Holly Greaves", role: "Quotes & Scheduling", years_experience: 5, avatar_url: "https://randomuser.me/api/portraits/women/14.jpg", skills: ["Job pricing", "Customer comms"] },
  ],

  // 2. PLASTERER — Leeds (Emma Whitfield)
  plasterer: [
    { name: "Emma Whitfield", role: "Master Plasterer / Owner", years_experience: 12, avatar_url: "https://randomuser.me/api/portraits/women/15.jpg", skills: ["Two-coat skim", "Lime plaster", "Ceiling re-skims"] },
    { name: "Daniel Crowther", role: "Plasterer", years_experience: 8, avatar_url: "https://randomuser.me/api/portraits/men/16.jpg", skills: ["Patch repairs", "Tape & joint"] },
    { name: "Tara Hollins", role: "Apprentice Plasterer", years_experience: 1, avatar_url: "https://randomuser.me/api/portraits/women/17.jpg", skills: ["Prep work", "Bagging up"] },
  ],

  // 3. ELECTRICIAN — Edinburgh (Jamie MacLean)
  electrician: [
    { name: "Jamie MacLean", role: "Approved Electrician / Owner", years_experience: 13, avatar_url: "https://randomuser.me/api/portraits/men/18.jpg", skills: ["Full rewires", "EV chargers", "EICR inspections"] },
    { name: "Fiona Sinclair", role: "Senior Electrician", years_experience: 10, avatar_url: "https://randomuser.me/api/portraits/women/19.jpg", skills: ["Consumer units", "Fault finding", "Testing & inspection"] },
    { name: "Calum Buchan", role: "Improver Electrician", years_experience: 3, avatar_url: "https://randomuser.me/api/portraits/men/20.jpg", skills: ["Second fix", "Cable pulls"] },
    { name: "Iona Drummond", role: "Office Manager", years_experience: 6, avatar_url: "https://randomuser.me/api/portraits/women/21.jpg", skills: ["Quote follow-up", "OZEV paperwork"] },
  ],

  // 4. SCAFFOLDER — Birmingham (Billy Ahmed)
  scaffolder: [
    { name: "Billy Ahmed", role: "Yard Foreman / Owner", years_experience: 16, avatar_url: "https://randomuser.me/api/portraits/men/22.jpg", skills: ["Tube & fitting", "System scaffold", "TG20 compliance"] },
    { name: "Wayne Pickering", role: "Advanced Scaffolder", years_experience: 11, avatar_url: "https://randomuser.me/api/portraits/men/23.jpg", skills: ["Cantilever lifts", "Bridges", "Tower scaffolds"] },
    { name: "Aisha Rahim", role: "Lift Planner / H&S Lead", years_experience: 7, avatar_url: "https://randomuser.me/api/portraits/women/24.jpg", skills: ["Lift plans", "Risk assessments", "PASMA"] },
    { name: "Dean Whitmore", role: "Trainee Scaffolder", years_experience: 1, avatar_url: "https://randomuser.me/api/portraits/men/25.jpg", skills: ["Loading bays", "Hoisting"] },
  ],

  // 5. TILER — Bristol (Anya Petrova)
  tiler: [
    { name: "Anya Petrova", role: "Lead Tiler / Owner", years_experience: 11, avatar_url: "https://randomuser.me/api/portraits/women/26.jpg", skills: ["Large format porcelain", "Wet rooms", "Underfloor heating"] },
    { name: "Liam Tregenza", role: "Senior Tiler", years_experience: 9, avatar_url: "https://randomuser.me/api/portraits/men/27.jpg", skills: ["Mosaic detail", "Natural stone", "Splashbacks"] },
    { name: "Naomi Pritchard", role: "Apprentice Tiler", years_experience: 2, avatar_url: "https://randomuser.me/api/portraits/women/28.jpg", skills: ["Substrate prep", "Grouting"] },
  ],

  // 6. PLUMBER — Sheffield (Dave Thornton)
  plumber: [
    { name: "Dave Thornton", role: "Lead Plumber / Owner", years_experience: 18, avatar_url: "https://randomuser.me/api/portraits/men/29.jpg", skills: ["Bathroom installs", "Boiler swaps", "Pressurised systems"] },
    { name: "Megan Holroyd", role: "Plumber", years_experience: 7, avatar_url: "https://randomuser.me/api/portraits/women/30.jpg", skills: ["Leak detection", "First & second fix"] },
    { name: "Sam Greaves", role: "Apprentice Plumber", years_experience: 2, avatar_url: "https://randomuser.me/api/portraits/men/31.jpg", skills: ["Pipework", "Soldering"] },
    { name: "Karen Beaumont", role: "Bookings & Office", years_experience: 4, avatar_url: "https://randomuser.me/api/portraits/women/32.jpg", skills: ["Quote follow-up", "Emergency triage"] },
  ],

  // 7. CARPENTER — Newcastle (Tom Bridges)
  carpenter: [
    { name: "Tom Bridges", role: "Master Carpenter / Owner", years_experience: 15, avatar_url: "https://randomuser.me/api/portraits/men/33.jpg", skills: ["First fix", "Roof carpentry", "Stud walls"] },
    { name: "Ellie Charlton", role: "Carpenter", years_experience: 8, avatar_url: "https://randomuser.me/api/portraits/women/34.jpg", skills: ["Second fix", "Skirting & architrave"] },
    { name: "Joe Armstrong", role: "Apprentice Carpenter", years_experience: 1, avatar_url: "https://randomuser.me/api/portraits/men/35.jpg", skills: ["Timber prep", "On-site cutting"] },
  ],

  // 8. JOINER — Glasgow (Rachel O'Sullivan)
  joiner: [
    { name: "Rachel O'Sullivan", role: "Workshop Manager / Owner", years_experience: 17, avatar_url: "https://randomuser.me/api/portraits/women/36.jpg", skills: ["Bespoke staircases", "Internal doors", "Sash windows"] },
    { name: "Hamish MacGregor", role: "Bench Joiner", years_experience: 12, avatar_url: "https://randomuser.me/api/portraits/men/37.jpg", skills: ["Hardwood joinery", "Mortise & tenon"] },
    { name: "Sorcha Lennox", role: "Joiner", years_experience: 6, avatar_url: "https://randomuser.me/api/portraits/women/38.jpg", skills: ["CNC operation", "Spraying"] },
    { name: "Connor Findlay", role: "Apprentice Joiner", years_experience: 2, avatar_url: "https://randomuser.me/api/portraits/men/39.jpg", skills: ["Sanding", "Glue-ups"] },
  ],

  // 9. PAINTER — Liverpool (Mike Fitzpatrick)
  painter: [
    { name: "Mike Fitzpatrick", role: "Lead Painter / Owner", years_experience: 13, avatar_url: "https://randomuser.me/api/portraits/men/40.jpg", skills: ["Interior decorating", "Wallpaper hanging", "Spray finishing"] },
    { name: "Bernadette Rourke", role: "Decorator", years_experience: 9, avatar_url: "https://randomuser.me/api/portraits/women/41.jpg", skills: ["Heritage paintwork", "Colour matching"] },
    { name: "Owen Mahoney", role: "Painter", years_experience: 4, avatar_url: "https://randomuser.me/api/portraits/men/42.jpg", skills: ["Exterior painting", "Masonry coatings"] },
  ],

  // 10. ROOFER — Leicester (Gary Singh)
  roofer: [
    { name: "Gary Singh", role: "Lead Roofer / Owner", years_experience: 19, avatar_url: "https://randomuser.me/api/portraits/men/43.jpg", skills: ["Slate & tile", "Flat roofing", "Leadwork"] },
    { name: "Sanjay Patel", role: "Senior Roofer", years_experience: 11, avatar_url: "https://randomuser.me/api/portraits/men/44.jpg", skills: ["Chimney repairs", "Gutter renewal"] },
    { name: "Hannah Drewitt", role: "Surveyor / Quotes", years_experience: 5, avatar_url: "https://randomuser.me/api/portraits/women/45.jpg", skills: ["Roof inspections", "Drone surveys"] },
    { name: "Liam Khatri", role: "Apprentice Roofer", years_experience: 1, avatar_url: "https://randomuser.me/api/portraits/men/46.jpg", skills: ["Loading", "Battening"] },
  ],

  // 11. BRICKLAYER — Nottingham (Craig Walters)
  bricklayer: [
    { name: "Craig Walters", role: "Lead Bricklayer / Owner", years_experience: 16, avatar_url: "https://randomuser.me/api/portraits/men/47.jpg", skills: ["Cavity walls", "Brick matching", "Decorative bonds"] },
    { name: "Sienna Marsh", role: "Bricklayer", years_experience: 7, avatar_url: "https://randomuser.me/api/portraits/women/48.jpg", skills: ["Brick pointing", "Lime mortar"] },
    { name: "Ricky Pollard", role: "Hod Carrier / Labourer", years_experience: 9, avatar_url: "https://randomuser.me/api/portraits/men/49.jpg", skills: ["Material handling", "Mix prep"] },
  ],

  // 12. STONEMASON — York (George Pemberton)
  stonemason: [
    { name: "George Pemberton", role: "Master Stonemason / Owner", years_experience: 22, avatar_url: "https://randomuser.me/api/portraits/men/50.jpg", skills: ["Yorkshire stone", "Heritage repair", "Hand-carved details"] },
    { name: "Eleanor Ashworth", role: "Banker Mason", years_experience: 10, avatar_url: "https://randomuser.me/api/portraits/women/51.jpg", skills: ["Bench carving", "Restoration"] },
    { name: "Frederick Garbutt", role: "Fixer Mason", years_experience: 13, avatar_url: "https://randomuser.me/api/portraits/men/52.jpg", skills: ["On-site fitting", "Cathedral work"] },
    { name: "Beatrice Calvert", role: "Apprentice Mason", years_experience: 2, avatar_url: "https://randomuser.me/api/portraits/women/53.jpg", skills: ["Stone prep", "Hand tools"] },
  ],

  // 13. GROUNDWORKER — Belfast (Darren McCormack)
  groundworker: [
    { name: "Darren McCormack", role: "Site Foreman / Owner", years_experience: 18, avatar_url: "https://randomuser.me/api/portraits/men/54.jpg", skills: ["Foundations", "Drainage", "Concrete slabs"] },
    { name: "Niamh Kavanagh", role: "Groundworker", years_experience: 6, avatar_url: "https://randomuser.me/api/portraits/women/55.jpg", skills: ["Setting out", "Kerbs & edging"] },
    { name: "Eoin Rooney", role: "Plant Operator", years_experience: 9, avatar_url: "https://randomuser.me/api/portraits/men/56.jpg", skills: ["Mini-digger", "Dumper", "Compaction"] },
  ],

  // 14. GENERAL BUILDER — Cardiff (Paul Richardson)
  "general-builder": [
    { name: "Paul Richardson", role: "Project Manager / Owner", years_experience: 20, avatar_url: "https://randomuser.me/api/portraits/men/57.jpg", skills: ["Extensions", "Loft conversions", "Project management"] },
    { name: "Bethan Llewellyn", role: "Lead Tradesperson", years_experience: 11, avatar_url: "https://randomuser.me/api/portraits/women/58.jpg", skills: ["Carpentry", "Brickwork", "Site coordination"] },
    { name: "Rhys Pritchard", role: "Site Carpenter", years_experience: 8, avatar_url: "https://randomuser.me/api/portraits/men/59.jpg", skills: ["First & second fix", "Roof structures"] },
    { name: "Carys Davies", role: "Quotes & Client Liaison", years_experience: 6, avatar_url: "https://randomuser.me/api/portraits/women/60.jpg", skills: ["Estimating", "Customer comms"] },
  ],

  // 15. CONCRETE SPECIALIST — Coventry (Paolo Rossi)
  "concrete-specialist": [
    { name: "Paolo Rossi", role: "Lead Concrete Specialist / Owner", years_experience: 17, avatar_url: "https://randomuser.me/api/portraits/men/61.jpg", skills: ["Pumped concrete", "Polished floors", "Structural slabs"] },
    { name: "Gabriella Conti", role: "Site Engineer", years_experience: 8, avatar_url: "https://randomuser.me/api/portraits/women/62.jpg", skills: ["Setting out", "Mix specs", "Curing control"] },
    { name: "Bartek Nowak", role: "Concrete Finisher", years_experience: 10, avatar_url: "https://randomuser.me/api/portraits/men/63.jpg", skills: ["Power floating", "Sealing"] },
  ],

  // 16. RENDERER — Brighton (Sophie Blackwell)
  renderer: [
    { name: "Sophie Blackwell", role: "Lead Renderer / Owner", years_experience: 10, avatar_url: "https://randomuser.me/api/portraits/women/64.jpg", skills: ["Silicone render", "K-Rend", "EWI"] },
    { name: "Marcus Holloway", role: "Senior Renderer", years_experience: 12, avatar_url: "https://randomuser.me/api/portraits/men/65.jpg", skills: ["Sand & cement", "Pebble dash"] },
    { name: "Imogen Wickham", role: "Apprentice Renderer", years_experience: 2, avatar_url: "https://randomuser.me/api/portraits/women/66.jpg", skills: ["Mesh & beading", "Mix prep"] },
  ],

  // 17. TAPER & FINISHER — Southampton (Kevin Doyle)
  "taper-and-finisher": [
    { name: "Kevin Doyle", role: "Lead Taper / Owner", years_experience: 14, avatar_url: "https://randomuser.me/api/portraits/men/67.jpg", skills: ["Level 5 finish", "Joint banking", "Skim-to-paint"] },
    { name: "Imani Adesanya", role: "Senior Finisher", years_experience: 8, avatar_url: "https://randomuser.me/api/portraits/women/68.jpg", skills: ["Hot mud", "Sanding & dust control"] },
    { name: "Logan Crewe", role: "Apprentice Taper", years_experience: 1, avatar_url: "https://randomuser.me/api/portraits/men/69.jpg", skills: ["Tape application", "Site clean"] },
  ],

  // 18. BUILDING MERCHANT — Hull (Stuart Kingsley)
  "building-merchant": [
    { name: "Stuart Kingsley", role: "Yard Manager / Owner", years_experience: 24, avatar_url: "https://randomuser.me/api/portraits/men/85.jpg", skills: ["Trade pricing", "Stock control", "Heavy goods"] },
    { name: "Jade Easton", role: "Sales Assistant", years_experience: 5, avatar_url: "https://randomuser.me/api/portraits/women/71.jpg", skills: ["Counter sales", "Trade accounts"] },
    { name: "Wayne Hardisty", role: "Yard Foreman", years_experience: 12, avatar_url: "https://randomuser.me/api/portraits/men/72.jpg", skills: ["Forklift", "Loading & dispatch"] },
    { name: "Sophie Eccles", role: "Accounts & Credit", years_experience: 7, avatar_url: "https://randomuser.me/api/portraits/women/73.jpg", skills: ["Invoicing", "Trade credit"] },
    { name: "Lewis Marsden", role: "HGV Driver", years_experience: 9, avatar_url: "https://randomuser.me/api/portraits/men/74.jpg", skills: ["Class 1 deliveries", "Route planning"] },
    { name: "Aaliyah Sutton", role: "Counter Sales", years_experience: 3, avatar_url: "https://randomuser.me/api/portraits/women/74.jpg", skills: ["Trade quotes", "Customer comms"] },
    { name: "Connor Beckwith", role: "Warehouse Picker", years_experience: 4, avatar_url: "https://randomuser.me/api/portraits/men/75.jpg", skills: ["Order picking", "Stock rotation"] },
    { name: "Megan Ainsworth", role: "Marketing & Trade Comms", years_experience: 6, avatar_url: "https://randomuser.me/api/portraits/women/75.jpg", skills: ["Promo planning", "Social posts"] },
    { name: "Darren Wilkinson", role: "Trade Account Manager", years_experience: 11, avatar_url: "https://randomuser.me/api/portraits/men/76.jpg", skills: ["Credit terms", "Site visits"] },
    { name: "Heather Pickering", role: "Goods-In Inspector", years_experience: 8, avatar_url: "https://randomuser.me/api/portraits/women/76.jpg", skills: ["Quality checks", "Supplier liaison"] },
  ],

  // 19. METAL ENGINEER — Stoke-on-Trent (Jakub Novak)
  "metal-engineer": [
    { name: "Jakub Novak", role: "Lead Fabricator / Owner", years_experience: 16, avatar_url: "https://randomuser.me/api/portraits/men/74.jpg", skills: ["MIG/TIG welding", "Structural steel", "Architectural metalwork"] },
    { name: "Lucia Kovac", role: "CAD & Quotes", years_experience: 7, avatar_url: "https://randomuser.me/api/portraits/women/75.jpg", skills: ["Drawing prep", "Tekla", "Material take-offs"] },
    { name: "Mariusz Wozniak", role: "Welder / Fabricator", years_experience: 11, avatar_url: "https://randomuser.me/api/portraits/men/76.jpg", skills: ["Coded welding", "Plate work"] },
  ],

  // 20. HEAVY MACHINERY — Aberdeen (Charlie Armstrong)
  "heavy-machinery": [
    { name: "Charlie Armstrong", role: "Operations Manager / Owner", years_experience: 21, avatar_url: "https://randomuser.me/api/portraits/men/77.jpg", skills: ["360 excavator", "Dozer", "Plant haulage"] },
    { name: "Morag Reid", role: "Plant Coordinator", years_experience: 9, avatar_url: "https://randomuser.me/api/portraits/women/78.jpg", skills: ["Scheduling", "CPCS records"] },
    { name: "Fraser Innes", role: "Senior Plant Operator", years_experience: 14, avatar_url: "https://randomuser.me/api/portraits/men/79.jpg", skills: ["Articulated dumper", "Roller"] },
    { name: "Catriona Bain", role: "Fleet Mechanic", years_experience: 8, avatar_url: "https://randomuser.me/api/portraits/women/80.jpg", skills: ["Hydraulics", "Field service"] },
  ],

  // 21. TOOL HIRE — Derby (Rebecca Fawcett)
  "tool-hire": [
    { name: "Rebecca Fawcett", role: "Hire Manager / Owner", years_experience: 12, avatar_url: "https://randomuser.me/api/portraits/women/81.jpg", skills: ["Plant hire", "Account management", "Off-hire control"] },
    { name: "Daniel Whatmore", role: "Trade Counter Lead", years_experience: 7, avatar_url: "https://randomuser.me/api/portraits/men/82.jpg", skills: ["Customer service", "Tool spec"] },
    { name: "Lauren Hibbert", role: "Yard Coordinator", years_experience: 4, avatar_url: "https://randomuser.me/api/portraits/women/83.jpg", skills: ["PAT testing", "Inventory"] },
    { name: "Connor Bramwell", role: "Delivery Driver / Tester", years_experience: 3, avatar_url: "https://randomuser.me/api/portraits/men/84.jpg", skills: ["LGV", "Pre-hire checks"] },
  ],

  // 22. LANDSCAPER — Norwich (Grace Okonkwo)
  landscaper: [
    { name: "Grace Okonkwo", role: "Lead Landscaper / Owner", years_experience: 11, avatar_url: "https://randomuser.me/api/portraits/women/85.jpg", skills: ["Garden design", "Hard landscaping", "Planting schemes"] },
    { name: "Ollie Bensley", role: "Senior Landscaper", years_experience: 9, avatar_url: "https://randomuser.me/api/portraits/men/86.jpg", skills: ["Patios", "Retaining walls", "Decking"] },
    { name: "Annika Vestergaard", role: "Horticulturist", years_experience: 6, avatar_url: "https://randomuser.me/api/portraits/women/87.jpg", skills: ["Plant selection", "Soft landscaping"] },
  ],

  // 23. GAS ENGINEER — Reading (Stephen Baker)
  "gas-engineer": [
    { name: "Stephen Baker", role: "Lead Gas Engineer / Owner", years_experience: 19, avatar_url: "https://randomuser.me/api/portraits/men/88.jpg", skills: ["Boiler installs", "Commercial gas", "Landlord safety"] },
    { name: "Hannah Quinton", role: "Gas Engineer", years_experience: 8, avatar_url: "https://randomuser.me/api/portraits/women/89.jpg", skills: ["Service & repair", "CP12 certificates"] },
    { name: "Owen Trafford", role: "Apprentice Gas Engineer", years_experience: 2, avatar_url: "https://randomuser.me/api/portraits/men/90.jpg", skills: ["Pipework", "Bench tests"] },
    { name: "Lisa Hartwell", role: "Office Manager", years_experience: 10, avatar_url: "https://randomuser.me/api/portraits/women/91.jpg", skills: ["Annual reminders", "Gas Safe records"] },
  ],

  // 24. CONCRETE FINISHER — Bournemouth (Marco Bianchi)
  "concrete-finisher": [
    { name: "Marco Bianchi", role: "Lead Finisher / Owner", years_experience: 15, avatar_url: "https://randomuser.me/api/portraits/men/92.jpg", skills: ["Power float", "Polished concrete", "Decorative finishes"] },
    { name: "Giulia Romano", role: "Senior Finisher", years_experience: 10, avatar_url: "https://randomuser.me/api/portraits/women/93.jpg", skills: ["Acid staining", "Sealing"] },
    { name: "Tomasz Lis", role: "Slab Finisher", years_experience: 7, avatar_url: "https://randomuser.me/api/portraits/men/94.jpg", skills: ["Screeding", "Diamond grinding"] },
  ],

  // 25. STAIR FITTER — Cambridge (Ben Lawrence)
  "stair-fitter": [
    { name: "Ben Lawrence", role: "Master Stair Fitter / Owner", years_experience: 14, avatar_url: "https://randomuser.me/api/portraits/men/95.jpg", skills: ["Bespoke staircases", "Cut strings", "Glass balustrades"] },
    { name: "Rosalind Templeton", role: "Workshop Joiner", years_experience: 8, avatar_url: "https://randomuser.me/api/portraits/women/96.jpg", skills: ["Hardwood machining", "Spindle finishing"] },
    { name: "Toby Markham", role: "Apprentice Stair Fitter", years_experience: 2, avatar_url: "https://randomuser.me/api/portraits/men/97.jpg", skills: ["Site fitting", "Snagging"] },
  ],

  // 26. KITCHEN FITTER — Oxford (Laura Bennett)
  "kitchen-fitter": [
    { name: "Laura Bennett", role: "Lead Kitchen Fitter / Owner", years_experience: 13, avatar_url: "https://randomuser.me/api/portraits/women/98.jpg", skills: ["Bespoke kitchens", "Worktop fabrication", "Project coordination"] },
    { name: "Henry Pinnock", role: "Kitchen Fitter", years_experience: 9, avatar_url: "https://randomuser.me/api/portraits/men/98.jpg", skills: ["Unit assembly", "Second-fix joinery"] },
    { name: "Esme Hawthorne", role: "Design & Quotes", years_experience: 6, avatar_url: "https://randomuser.me/api/portraits/women/99.jpg", skills: ["CAD layouts", "Material specs"] },
    { name: "Jordan Cleaver", role: "Apprentice Fitter", years_experience: 2, avatar_url: "https://randomuser.me/api/portraits/men/99.jpg", skills: ["On-site cutting", "Clearouts"] },
  ],

  // 27. WINDOW FITTER — Plymouth (Noah Patel)
  "window-fitter": [
    { name: "Noah Patel", role: "Lead Window Fitter / Owner", years_experience: 11, avatar_url: "https://randomuser.me/api/portraits/men/1.jpg", skills: ["uPVC windows", "Sash restoration", "Aluminium frames"] },
    { name: "Tasha Polkinghorne", role: "Window Fitter", years_experience: 6, avatar_url: "https://randomuser.me/api/portraits/women/1.jpg", skills: ["Trickle vents", "Building Regs compliance"] },
    { name: "Adam Tregoning", role: "Apprentice Fitter", years_experience: 1, avatar_url: "https://randomuser.me/api/portraits/men/2.jpg", skills: ["Site prep", "Sealing"] },
  ],

  // 28. CRANE OPERATOR — Leeds (Callum Reed)
  "crane-operator": [
    { name: "Callum Reed", role: "Lead Crane Operator / Owner", years_experience: 17, avatar_url: "https://randomuser.me/api/portraits/men/3.jpg", skills: ["Tower cranes", "Mobile cranes", "Lift planning"] },
    { name: "Amelia Carradine", role: "Lift Supervisor", years_experience: 9, avatar_url: "https://randomuser.me/api/portraits/women/2.jpg", skills: ["Appointed person", "Safe lift planning"] },
    { name: "Jordan Hibbard", role: "Slinger / Signaller", years_experience: 5, avatar_url: "https://randomuser.me/api/portraits/men/4.jpg", skills: ["Banksman", "Load rigging"] },
  ],

  // 29. SECURITY INSTALLER — London (Priya Sharma)
  "security-installer": [
    { name: "Priya Sharma", role: "Lead Installer / Owner", years_experience: 12, avatar_url: "https://randomuser.me/api/portraits/women/3.jpg", skills: ["CCTV systems", "Alarms", "Access control"] },
    { name: "Marcus Olabode", role: "Senior Engineer", years_experience: 9, avatar_url: "https://randomuser.me/api/portraits/men/5.jpg", skills: ["IP cameras", "Network setup"] },
    { name: "Frankie Whitwell", role: "Service Engineer", years_experience: 5, avatar_url: "https://randomuser.me/api/portraits/men/6.jpg", skills: ["Fault finding", "Maintenance"] },
    { name: "Yasmin Choudhury", role: "Bookings & Compliance", years_experience: 7, avatar_url: "https://randomuser.me/api/portraits/women/4.jpg", skills: ["SSAIB records", "Customer onboarding"] },
  ],

  // 30. BUILDERS' SUPPLIES — Leeds (Richard Holt)
  "builders-supplies": [
    { name: "Richard Holt", role: "Branch Manager / Owner", years_experience: 23, avatar_url: "https://randomuser.me/api/portraits/men/7.jpg", skills: ["Heavyside materials", "Trade pricing", "Logistics"] },
    { name: "Charlotte Heseltine", role: "Trade Sales", years_experience: 6, avatar_url: "https://randomuser.me/api/portraits/women/5.jpg", skills: ["Account sales", "Quote prep"] },
    { name: "Gary Iveson", role: "Yard Foreman", years_experience: 14, avatar_url: "https://randomuser.me/api/portraits/men/8.jpg", skills: ["Stock control", "HIAB operations"] },
    { name: "Paula Sykes", role: "Accounts & Credit", years_experience: 11, avatar_url: "https://randomuser.me/api/portraits/women/6.jpg", skills: ["Invoicing", "Credit control"] },
  ],

  // 31. FORMWORKER — London (Stefan Kowalski)
  formworker: [
    { name: "Stefan Kowalski", role: "Lead Formworker / Owner", years_experience: 16, avatar_url: "https://randomuser.me/api/portraits/men/9.jpg", skills: ["Wall & column forms", "Slab decks", "PERI systems"] },
    { name: "Adriana Wisniewska", role: "Site Engineer", years_experience: 8, avatar_url: "https://randomuser.me/api/portraits/women/7.jpg", skills: ["Setting out", "Form drawings"] },
    { name: "Krzysztof Lewandowski", role: "Senior Carpenter", years_experience: 13, avatar_url: "https://randomuser.me/api/portraits/men/10.jpg", skills: ["Traditional formwork", "Bracing"] },
  ],

  // 32. INSULATION INSTALLER — Bristol (Charlotte Evans)
  "insulation-installer": [
    { name: "Charlotte Evans", role: "Lead Insulation Installer / Owner", years_experience: 10, avatar_url: "https://randomuser.me/api/portraits/women/8.jpg", skills: ["Cavity wall", "Loft top-up", "PIR boards"] },
    { name: "Ryan Castle", role: "Senior Installer", years_experience: 8, avatar_url: "https://randomuser.me/api/portraits/men/12.jpg", skills: ["EWI", "Sheep wool", "Acoustic batts"] },
    { name: "Phoebe Carlyle", role: "Surveyor", years_experience: 5, avatar_url: "https://randomuser.me/api/portraits/women/9.jpg", skills: ["PAS 2030", "U-value calcs"] },
    { name: "Ashley Pearce", role: "Apprentice Installer", years_experience: 1, avatar_url: "https://randomuser.me/api/portraits/men/14.jpg", skills: ["Material prep", "Site clean"] },
  ],

  // 33. TRIM CARPENTER — Bath (Harry Osbourne)
  "trim-carpenter": [
    { name: "Harry Osbourne", role: "Lead Trim Carpenter / Owner", years_experience: 14, avatar_url: "https://randomuser.me/api/portraits/men/15.jpg", skills: ["Architrave & skirting", "Picture rails", "Hardwood detailing"] },
    { name: "Florence Wadsworth", role: "Trim Carpenter", years_experience: 7, avatar_url: "https://randomuser.me/api/portraits/women/10.jpg", skills: ["Mitre work", "Heritage profiles"] },
    { name: "Spencer Aitken", role: "Apprentice Trim Carpenter", years_experience: 2, avatar_url: "https://randomuser.me/api/portraits/men/17.jpg", skills: ["Cutting", "Caulking & finish"] },
  ],

  // 34. BLOCK LAYER — Belfast (Michael Doherty)
  "block-layer": [
    { name: "Michael Doherty", role: "Lead Block Layer / Owner", years_experience: 18, avatar_url: "https://randomuser.me/api/portraits/men/26.jpg", skills: ["Cavity blocks", "Insulated systems", "Garden walls"] },
    { name: "Aoife McGlinchey", role: "Block Layer", years_experience: 6, avatar_url: "https://randomuser.me/api/portraits/women/11.jpg", skills: ["Internal partitions", "Lintel setting"] },
    { name: "Patrick O'Hagan", role: "Hod Carrier", years_experience: 10, avatar_url: "https://randomuser.me/api/portraits/men/28.jpg", skills: ["Mix prep", "Material handling"] },
  ],

  // 35. SITE SAFETY — Glasgow (Andrew MacKenzie)
  "site-safety": [
    { name: "Andrew MacKenzie", role: "Lead H&S Consultant / Owner", years_experience: 20, avatar_url: "https://randomuser.me/api/portraits/men/30.jpg", skills: ["CDM coordination", "RAMS", "Site audits"] },
    { name: "Catriona Sinclair", role: "Senior H&S Advisor", years_experience: 11, avatar_url: "https://randomuser.me/api/portraits/women/13.jpg", skills: ["NEBOSH inspections", "Toolbox talks"] },
    { name: "Stuart Galbraith", role: "Site Safety Officer", years_experience: 7, avatar_url: "https://randomuser.me/api/portraits/men/36.jpg", skills: ["Incident reporting", "PPE compliance"] },
    { name: "Heather Cunningham", role: "Admin & Compliance", years_experience: 8, avatar_url: "https://randomuser.me/api/portraits/women/16.jpg", skills: ["Training records", "Document control"] },
  ],

  // 36. WATER DRILLING — Exeter (Ian Fletcher)
  "water-drilling": [
    { name: "Ian Fletcher", role: "Lead Driller / Owner", years_experience: 19, avatar_url: "https://randomuser.me/api/portraits/men/41.jpg", skills: ["Borehole drilling", "Ground source", "Pump installs"] },
    { name: "Verity Cornish", role: "Hydrogeologist", years_experience: 9, avatar_url: "https://randomuser.me/api/portraits/women/18.jpg", skills: ["Site surveys", "EA permits"] },
    { name: "Lewis Stannard", role: "Drilling Operator", years_experience: 6, avatar_url: "https://randomuser.me/api/portraits/men/48.jpg", skills: ["Rig operation", "Casing installs"] },
  ],

  // 37. FASCIA & SOFFIT — Cardiff (Mark Coleman)
  "fascia-and-soffit": [
    { name: "Mark Coleman", role: "Lead Installer / Owner", years_experience: 15, avatar_url: "https://randomuser.me/api/portraits/men/58.jpg", skills: ["uPVC fascia", "Soffits", "Guttering"] },
    { name: "Catrin Vaughan", role: "Installer", years_experience: 7, avatar_url: "https://randomuser.me/api/portraits/women/20.jpg", skills: ["Rooftrim", "Dry verge systems"] },
    { name: "Iwan Bowen", role: "Apprentice Installer", years_experience: 1, avatar_url: "https://randomuser.me/api/portraits/men/64.jpg", skills: ["Cutting", "Sealing"] },
  ],

  // 38. DEMOLITION — Glasgow (Craig Buchanan)
  demolition: [
    { name: "Craig Buchanan", role: "Site Manager / Owner", years_experience: 21, avatar_url: "https://randomuser.me/api/portraits/men/66.jpg", skills: ["Soft strip", "Mechanical demolition", "Asbestos surveys"] },
    { name: "Lorna Ferguson", role: "Project Coordinator", years_experience: 10, avatar_url: "https://randomuser.me/api/portraits/women/22.jpg", skills: ["Permits", "Waste compliance"] },
    { name: "Murray Galloway", role: "Plant Operator", years_experience: 12, avatar_url: "https://randomuser.me/api/portraits/men/71.jpg", skills: ["High-reach excavator", "Crushers"] },
    { name: "Ailsa Munro", role: "H&S Officer", years_experience: 8, avatar_url: "https://randomuser.me/api/portraits/women/23.jpg", skills: ["Dust suppression", "Site inductions"] },
  ],

  // 39. SITE CANTEEN — Manchester (Debbie Rowland)
  "site-canteen": [
    { name: "Debbie Rowland", role: "Canteen Owner / Lead Cook", years_experience: 14, avatar_url: "https://randomuser.me/api/portraits/women/25.jpg", skills: ["Bulk catering", "Menu planning", "Food hygiene"] },
    { name: "Pete Kershaw", role: "Site Driver", years_experience: 9, avatar_url: "https://randomuser.me/api/portraits/men/73.jpg", skills: ["Hot delivery", "Route planning"] },
    { name: "Maria Calderon", role: "Prep Cook", years_experience: 6, avatar_url: "https://randomuser.me/api/portraits/women/27.jpg", skills: ["Breakfast service", "Salads & sides"] },
    { name: "Brendan Whittle", role: "Counter & Service", years_experience: 4, avatar_url: "https://randomuser.me/api/portraits/men/75.jpg", skills: ["Customer service", "Stock rotation"] },
  ],
};
