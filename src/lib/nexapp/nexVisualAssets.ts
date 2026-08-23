// NEX Visual Assets · transparent-background inline visuals for chat.
//
// Distinct from `foodKnowledge.ts` (which is the KNOWLEDGE layer with
// per-item confidence + uncertainty). This module stores VISUAL ASSETS
// that NEX brain can embed inline in a chat reply when a topic connects.
//
// Philip 2026-08-21 verbatim:
//   "these could be used to explain in chat or for visual for any topic
//    that connects"
//
// Architectural rule (per pinned doctrine `project_nex_visual_assets_
// 2026_08_21`):
//   • Every asset here is a transparent-background PNG on external storage
//     (ImageKit) — code holds only the URL string.
//   • Every asset carries `relatedTopics[]` so the brain can look up
//     "is there a visual for topic X?" without vision or embeddings.
//   • V1 pool is Philip-curated + Claude-vision-analysed on 2026-08-21;
//     the brain-side chooser lands in Priority 4+.
//   • NEVER attach these to a specific business/vendor. Every asset is
//     illustrative, not proof-of-ownership.
//   • NEVER build a UI surface just to display these records (per Food
//     Yogyakarta V1 Lock 13). Inline embedding in chat replies only.
//
// ═══════════════════════════════════════════════════════════════════════
// 2026-08-22 · CATEGORY_FALLBACK authorisation amendment
// Doctrine: project_nex_universal_directory_image_doctrine_2026_08_22
// ═══════════════════════════════════════════════════════════════════════
//
// Under the Universal Directory Image Doctrine (2026-08-22), these assets
// MAY additionally be referenced by the Universal Directory Image resolver
// (src/lib/nex/images/categoryFallbackLibrary.ts) as CATEGORY_FALLBACK
// only. The "never attach to a specific business/vendor" rule ABOVE stands
// and is REINFORCED — CATEGORY_FALLBACK is BY DEFINITION generic category
// imagery, not a specific-business claim. It must NEVER be labelled or
// rendered as OWNER_IMAGE or VERIFIED_REAL. The resolver + directory card
// carry an explicit image_type discriminator so this distinction stays
// honest end-to-end.

// ── Types ──────────────────────────────────────────────────

import type { ConfidenceBand } from "./foodKnowledge";

export type NexVisualAssetCategory =
  | "food-dish"        // full plated dish (Indonesian, Chinese, Japanese, Western, etc.)
  | "drink"            // hot + cold beverages
  | "dessert"          // sweets + ice cream + cakes
  | "seafood"          // seafood-specific dish
  | "healthy"          // health-forward bowls + salads (may overlap food-dish)
  | "salad"            // salad-specific
  | "fast-food"        // burger / fries / fried snacks
  | "cooking-scene"    // action shot / vendor
  | "ingredient"       // single ingredient / condiment display
  | "icon-illustrated" // illustrated / cartoon style (not photo-realistic)
  ;

export type NexVisualAsset = {
  id: string;                          // internal · never exposed
  publicRef: string;                   // stable #NVA-XXX reference
  imageUrl: string;                    // external ImageKit URL · transparent bg PNG
  transparentBackground: true;
  primarySubject: string;              // shortest human name
  category: NexVisualAssetCategory;
  cuisine?: string;
  /** Topics the brain can match this visual against · lower-case tokens. */
  relatedTopics: readonly string[];
  /** Contexts where NEX may embed this asset inline. */
  usageContext: readonly string[];
  confidence: ConfidenceBand;
  approved: boolean;
  approvedByNote: string;
  createdAt: string;
};

// ── Records · Philip-supplied 2026-08-21 · vision-analysed by Claude ──

export const NEX_VISUAL_ASSETS: readonly NexVisualAsset[] = [
  {
    id: "nva-001", publicRef: "#NVA-001",
    imageUrl: "https://ik.imagekit.io/nepgaxllc/Untitledsdasdaaaaddddsadaddsscxcccdddddsssdaasda-removebg-preview.png?updatedAt=1777019670575",
    transparentBackground: true,
    primarySubject: "fresh orange juice glass with orange fruit",
    category: "drink",
    cuisine: "juice bar",
    relatedTopics: ["orange juice", "juice", "fresh juice", "citrus", "breakfast drink", "healthy drink"],
    usageContext: ["drink illustration", "breakfast reference", "juice-bar topic marker"],
    confidence: "very-high", approved: true,
    approvedByNote: "Philip 2026-08-21 · transparent PNG chat visual", createdAt: "2026-08-21",
  },
  {
    id: "nva-002", publicRef: "#NVA-002",
    imageUrl: "https://ik.imagekit.io/nepgaxllc/Untitledsdasdaaaaddddsadaddsscxcccdddddsssda-removebg-preview.png?updatedAt=1777019597797",
    transparentBackground: true,
    primarySubject: "cappuccino cup with latte-art heart + glass teapot with tea + lemon slice",
    category: "drink",
    cuisine: "cafe",
    relatedTopics: ["coffee", "cappuccino", "latte art", "tea", "lemon tea", "hot drinks", "cafe"],
    usageContext: ["cafe illustration", "hot-drinks topic marker", "coffee-shop reference"],
    confidence: "very-high", approved: true,
    approvedByNote: "Philip 2026-08-21", createdAt: "2026-08-21",
  },
  {
    id: "nva-003", publicRef: "#NVA-003",
    imageUrl: "https://ik.imagekit.io/nepgaxllc/Untitledsdasdaaaaddddsadaddsscxcccdddddss-removebg-preview.png?updatedAt=1777019533696",
    transparentBackground: true,
    primarySubject: "Indonesian shrimp sambal on rice with kerupuk + cucumber",
    category: "food-dish",
    cuisine: "Indonesian",
    relatedTopics: ["udang", "shrimp", "sambal", "Indonesian food", "rice dish", "kerupuk"],
    usageContext: ["Indonesian dish illustration", "shrimp topic marker"],
    confidence: "high", approved: true,
    approvedByNote: "Philip 2026-08-21", createdAt: "2026-08-21",
  },
  {
    id: "nva-004", publicRef: "#NVA-004",
    imageUrl: "https://ik.imagekit.io/nepgaxllc/Untitledsdasdaaaaddddsadaddsscxcccddddd-removebg-preview.png?updatedAt=1777019470812",
    transparentBackground: true,
    primarySubject: "bamboo steamer of dim sum dumplings with sambal",
    category: "food-dish",
    cuisine: "Chinese / dim sum",
    relatedTopics: ["dim sum", "dumplings", "bao", "siomay", "bamboo steamer", "Chinese food"],
    usageContext: ["dim sum illustration", "Chinese dumpling topic marker"],
    confidence: "very-high", approved: true,
    approvedByNote: "Philip 2026-08-21", createdAt: "2026-08-21",
  },
  {
    id: "nva-005", publicRef: "#NVA-005",
    imageUrl: "https://ik.imagekit.io/nepgaxllc/Untitledsdasdaaaaddddsadaddsscxccc-removebg-preview.png?updatedAt=1777019246498",
    transparentBackground: true,
    primarySubject: "Indonesian tempeh + tofu + noodles on banana leaf with chopsticks",
    category: "food-dish",
    cuisine: "Indonesian",
    relatedTopics: ["tempeh", "tofu", "tahu", "tempe", "noodles", "Indonesian food", "vegetarian option"],
    usageContext: ["tempeh/tofu illustration", "Indonesian vegetarian topic marker"],
    confidence: "very-high", approved: true,
    approvedByNote: "Philip 2026-08-21", createdAt: "2026-08-21",
  },
  {
    id: "nva-006", publicRef: "#NVA-006",
    imageUrl: "https://ik.imagekit.io/nepgaxllc/Untitledsdasdaaaaddddsadaddsscxc-removebg-preview.png?updatedAt=1777019171766",
    transparentBackground: true,
    primarySubject: "tom yum-style shrimp soup with chili and herbs",
    category: "food-dish",
    cuisine: "Thai / Southeast Asian",
    relatedTopics: ["tom yum", "shrimp soup", "spicy soup", "Thai food", "seafood soup"],
    usageContext: ["soup illustration", "Thai/SE-Asian topic marker"],
    confidence: "high", approved: true,
    approvedByNote: "Philip 2026-08-21 · leans Thai tom yum but could be Indonesian sup udang", createdAt: "2026-08-21",
  },
  {
    id: "nva-007", publicRef: "#NVA-007",
    imageUrl: "https://ik.imagekit.io/nepgaxllc/Untitledsdasdaaaaddddsadaddss-removebg-preview.png?updatedAt=1777019098200",
    transparentBackground: true,
    primarySubject: "whole roasted chicken with sambal bowls on black plate",
    category: "food-dish",
    cuisine: "Indonesian",
    relatedTopics: ["ayam bakar", "ayam panggang", "roasted chicken", "grilled chicken", "sambal", "Indonesian food"],
    usageContext: ["whole chicken illustration", "Indonesian chicken topic marker"],
    confidence: "very-high", approved: true,
    approvedByNote: "Philip 2026-08-21", createdAt: "2026-08-21",
  },
  {
    id: "nva-008", publicRef: "#NVA-008",
    imageUrl: "https://ik.imagekit.io/nepgaxllc/Untitledsdasdaaaaddddsada-removebg-preview.png?updatedAt=1777019033361",
    transparentBackground: true,
    primarySubject: "small sushi selection on banana leaf on black plate",
    category: "food-dish",
    cuisine: "Japanese",
    relatedTopics: ["sushi", "maki", "nigiri", "Japanese food", "wasabi", "soy sauce"],
    usageContext: ["sushi illustration", "Japanese cuisine topic marker"],
    confidence: "very-high", approved: true,
    approvedByNote: "Philip 2026-08-21", createdAt: "2026-08-21",
  },
  {
    id: "nva-009", publicRef: "#NVA-009",
    imageUrl: "https://ik.imagekit.io/nepgaxllc/Untitledsdasdaaaaddddsadadd-removebg-preview.png?updatedAt=1777019003107",
    transparentBackground: true,
    primarySubject: "whole pizza with slice being lifted showing cheese stretch",
    category: "food-dish",
    cuisine: "Italian",
    relatedTopics: ["pizza", "pepperoni", "cheese stretch", "Italian food", "pizza slice"],
    usageContext: ["pizza illustration", "Italian food topic marker"],
    confidence: "very-high", approved: true,
    approvedByNote: "Philip 2026-08-21", createdAt: "2026-08-21",
  },
  {
    id: "nva-010", publicRef: "#NVA-010",
    imageUrl: "https://ik.imagekit.io/nepgaxllc/Untitledsdasdaaaaddd-removebg-preview.png?updatedAt=1777018563954",
    transparentBackground: true,
    primarySubject: "spaghetti twirl with tomato-meat sauce and fork lifting noodles",
    category: "food-dish",
    cuisine: "Italian",
    relatedTopics: ["spaghetti", "pasta", "bolognese", "Italian food", "meat sauce"],
    usageContext: ["pasta illustration", "Italian pasta topic marker"],
    confidence: "very-high", approved: true,
    approvedByNote: "Philip 2026-08-21", createdAt: "2026-08-21",
  },
  {
    id: "nva-011", publicRef: "#NVA-011",
    imageUrl: "https://ik.imagekit.io/nepgaxllc/Untitledsdasdaaaad-removebg-preview.png?updatedAt=1777018500563",
    transparentBackground: true,
    primarySubject: "healthy grain bowl with grilled chicken, avocado, cabbage, carrot, chickpeas + green heart badge",
    category: "healthy",
    cuisine: "healthy bowl / western",
    relatedTopics: ["healthy food", "grain bowl", "buddha bowl", "grilled chicken", "avocado", "vegetables", "quinoa"],
    usageContext: ["healthy-food illustration", "diet-conscious topic marker (badge indicates 'love/healthy' tag)"],
    confidence: "very-high", approved: true,
    approvedByNote: "Philip 2026-08-21 · includes green heart badge suggesting 'healthy/loved' category tag", createdAt: "2026-08-21",
  },
  {
    id: "nva-012", publicRef: "#NVA-012",
    imageUrl: "https://ik.imagekit.io/nepgaxllc/Untitledsdasdaaaa-removebg-preview.png?updatedAt=1777018422468",
    transparentBackground: true,
    primarySubject: "fried snacks basket · fries + chicken nuggets + onion rings + ketchup",
    category: "fast-food",
    cuisine: "American / fast food",
    relatedTopics: ["fries", "chicken nuggets", "onion rings", "fast food", "fried snacks", "ketchup"],
    usageContext: ["fast-food illustration", "fried-snack topic marker"],
    confidence: "very-high", approved: true,
    approvedByNote: "Philip 2026-08-21", createdAt: "2026-08-21",
  },
  {
    id: "nva-013", publicRef: "#NVA-013",
    imageUrl: "https://ik.imagekit.io/nepgaxllc/odfssddasds-removebg-preview.png?updatedAt=1777008373375",
    transparentBackground: true,
    primarySubject: "simple breakfast plate · sausages + fried egg + scrambled egg + toast + tomato",
    category: "food-dish",
    cuisine: "Western breakfast",
    relatedTopics: ["breakfast", "sausage", "eggs", "toast", "fried egg", "scrambled egg", "English breakfast"],
    usageContext: ["breakfast illustration", "Western breakfast topic marker"],
    confidence: "very-high", approved: true,
    approvedByNote: "Philip 2026-08-21", createdAt: "2026-08-21",
  },
  {
    id: "nva-014", publicRef: "#NVA-014",
    imageUrl: "https://ik.imagekit.io/nepgaxllc/odfssddasd-removebg-preview.png?updatedAt=1777008039446",
    transparentBackground: true,
    primarySubject: "Greek salad with feta, lettuce, tomatoes, cucumber, red onion, olives + green plant badge",
    category: "salad",
    cuisine: "Mediterranean / Greek",
    relatedTopics: ["Greek salad", "feta", "vegetarian", "salad", "Mediterranean food", "healthy"],
    usageContext: ["salad illustration", "vegetarian topic marker (green plant badge)"],
    confidence: "very-high", approved: true,
    approvedByNote: "Philip 2026-08-21 · includes green plant badge suggesting 'vegetarian/vegan' category tag", createdAt: "2026-08-21",
  },
  {
    id: "nva-015", publicRef: "#NVA-015",
    imageUrl: "https://ik.imagekit.io/nepgaxllc/odfssd-removebg-preview.png?updatedAt=1777007963272",
    transparentBackground: true,
    primarySubject: "slice of layered chocolate cake with ganache and strawberry",
    category: "dessert",
    cuisine: "Western dessert",
    relatedTopics: ["chocolate cake", "cake", "dessert", "strawberry", "ganache", "sweet"],
    usageContext: ["dessert illustration", "cake topic marker"],
    confidence: "very-high", approved: true,
    approvedByNote: "Philip 2026-08-21", createdAt: "2026-08-21",
  },
  {
    id: "nva-016", publicRef: "#NVA-016",
    imageUrl: "https://ik.imagekit.io/nepgaxllc/odfss-removebg-preview.png?updatedAt=1777007894759",
    transparentBackground: true,
    primarySubject: "ice cream sundae in glass · vanilla + strawberry scoops + cherry + wafer",
    category: "dessert",
    cuisine: "ice cream parlour",
    relatedTopics: ["ice cream", "sundae", "strawberry ice cream", "vanilla ice cream", "cherry", "dessert"],
    usageContext: ["ice cream illustration", "dessert topic marker"],
    confidence: "very-high", approved: true,
    approvedByNote: "Philip 2026-08-21", createdAt: "2026-08-21",
  },
  {
    id: "nva-017", publicRef: "#NVA-017",
    imageUrl: "https://ik.imagekit.io/nepgaxllc/odfs-removebg-preview.png?updatedAt=1777007827360",
    transparentBackground: true,
    primarySubject: "Indonesian herbal drink (jamu / wedang jahe) in clay cup with pandan and ginger",
    category: "drink",
    cuisine: "Indonesian traditional",
    relatedTopics: ["jamu", "wedang jahe", "herbal drink", "ginger drink", "Indonesian traditional drink", "pandan"],
    usageContext: ["Indonesian drink illustration", "traditional herbal drink topic marker"],
    confidence: "high", approved: true,
    approvedByNote: "Philip 2026-08-21 · leans wedang jahe by ginger + clay cup", createdAt: "2026-08-21",
  },
  {
    id: "nva-018", publicRef: "#NVA-018",
    imageUrl: "https://ik.imagekit.io/nepgaxllc/odf-removebg-preview.png?updatedAt=1777007457381",
    transparentBackground: true,
    primarySubject: "iced coffee in tall plastic cup with straw and coffee beans",
    category: "drink",
    cuisine: "cafe",
    relatedTopics: ["iced coffee", "cold brew", "coffee", "cafe", "takeaway drink"],
    usageContext: ["iced coffee illustration", "cafe/coffee-shop topic marker"],
    confidence: "very-high", approved: true,
    approvedByNote: "Philip 2026-08-21", createdAt: "2026-08-21",
  },
  {
    id: "nva-019", publicRef: "#NVA-019",
    imageUrl: "https://ik.imagekit.io/nepgaxllc/od-removebg-preview.png?updatedAt=1777007394437",
    transparentBackground: true,
    primarySubject: "grilled steak with garlic butter, rosemary, carrots, green beans and tomatoes on wooden trencher",
    category: "food-dish",
    cuisine: "Western / steakhouse",
    relatedTopics: ["steak", "grilled steak", "steakhouse", "Western food", "garlic butter", "beef"],
    usageContext: ["steak illustration", "steakhouse topic marker"],
    confidence: "very-high", approved: true,
    approvedByNote: "Philip 2026-08-21", createdAt: "2026-08-21",
  },
  {
    id: "nva-020", publicRef: "#NVA-020",
    imageUrl: "https://ik.imagekit.io/nepgaxllc/Untitledasdasdaaavvvdddddasdassssddddfssdssssddffdddd-removebg-preview.png?updatedAt=1777007292974",
    transparentBackground: true,
    primarySubject: "classic cheeseburger with lettuce + tomato + cheese in sesame bun on wooden board with fries",
    category: "fast-food",
    cuisine: "American / western fast food",
    relatedTopics: ["cheeseburger", "burger", "fries", "fast food", "American food"],
    usageContext: ["burger illustration", "Fast Food category marker"],
    confidence: "very-high", approved: true,
    approvedByNote: "Philip 2026-08-21", createdAt: "2026-08-21",
  },
  {
    id: "nva-021", publicRef: "#NVA-021",
    imageUrl: "https://ik.imagekit.io/nepgaxllc/Untitledasdasdaaavvvdddddasdassssddddfssdssssddffdd-removebg-preview.png?updatedAt=1777007222019",
    transparentBackground: true,
    primarySubject: "gado-gado / ketoprak-style Indonesian plate · noodles + tofu + kerupuk with peanut sauce",
    category: "food-dish",
    cuisine: "Indonesian",
    relatedTopics: ["gado-gado", "ketoprak", "peanut sauce", "sambal kacang", "Indonesian food", "vegetarian friendly"],
    usageContext: ["Indonesian mixed-plate illustration", "peanut-sauce dish topic marker"],
    confidence: "high", approved: true,
    approvedByNote: "Philip 2026-08-21", createdAt: "2026-08-21",
  },
  {
    id: "nva-022", publicRef: "#NVA-022",
    imageUrl: "https://ik.imagekit.io/nepgaxllc/Untitledasdasdaaavvvdddddasdassssddddfssdssssddff-removebg-preview.png?updatedAt=1777007137860",
    transparentBackground: true,
    primarySubject: "Indonesian siomay-style steamed dumplings in bamboo steamer with sambal + lime",
    category: "food-dish",
    cuisine: "Indonesian / dim sum",
    relatedTopics: ["siomay", "steamed dumplings", "dim sum", "Indonesian food", "bamboo steamer", "sambal"],
    usageContext: ["dumpling illustration", "Indonesian siomay topic marker"],
    confidence: "very-high", approved: true,
    approvedByNote: "Philip 2026-08-21", createdAt: "2026-08-21",
  },
  {
    id: "nva-023", publicRef: "#NVA-023",
    imageUrl: "https://ik.imagekit.io/nepgaxllc/Untitledasdasdaaavvvdddddasdassssddddfssdssssdd-removebg-preview.png?updatedAt=1777007053100",
    transparentBackground: true,
    primarySubject: "fried tofu and tempeh cubes on banana leaf with green chilis",
    category: "food-dish",
    cuisine: "Indonesian",
    relatedTopics: ["tahu goreng", "tempeh mendoan", "fried tofu", "fried tempeh", "vegetarian", "Indonesian snack"],
    usageContext: ["tofu/tempeh illustration", "Indonesian vegetarian snack topic marker"],
    confidence: "very-high", approved: true,
    approvedByNote: "Philip 2026-08-21", createdAt: "2026-08-21",
  },
  {
    id: "nva-024", publicRef: "#NVA-024",
    imageUrl: "https://ik.imagekit.io/nepgaxllc/Untitledasdasdaaavvvdddddasdassssddddfssdssss-removebg-preview.png?updatedAt=1777006958164",
    transparentBackground: true,
    primarySubject: "grilled whole fish (ikan bakar-style) with sambal, cucumber, lime, green chilis on black plate",
    category: "food-dish",
    cuisine: "Indonesian",
    relatedTopics: ["ikan bakar", "grilled fish", "whole fish", "Indonesian seafood", "sambal", "seafood"],
    usageContext: ["grilled fish illustration", "Indonesian seafood topic marker"],
    confidence: "very-high", approved: true,
    approvedByNote: "Philip 2026-08-21", createdAt: "2026-08-21",
  },
  {
    id: "nva-025", publicRef: "#NVA-025",
    imageUrl: "https://ik.imagekit.io/nepgaxllc/Untitledasdasdaaavvvdddddasdassssddddfssdss-removebg-preview.png?updatedAt=1777006884481",
    transparentBackground: true,
    primarySubject: "whole roasted brown chicken (ayam bakar/panggang) with sambal, cucumber, lettuce, lime on black plate",
    category: "food-dish",
    cuisine: "Indonesian",
    relatedTopics: ["ayam bakar", "ayam panggang", "roasted chicken", "Indonesian chicken", "whole chicken", "sambal"],
    usageContext: ["Indonesian chicken illustration", "ayam bakar topic marker"],
    confidence: "very-high", approved: true,
    approvedByNote: "Philip 2026-08-21", createdAt: "2026-08-21",
  },
  {
    id: "nva-026", publicRef: "#NVA-026",
    imageUrl: "https://ik.imagekit.io/nepgaxllc/Untitledasdasdaaavvvdddddasdassssddddfssd-removebg-preview.png?updatedAt=1777006455158",
    transparentBackground: true,
    primarySubject: "bowl of dark braised beef rendang with chili slices and basil garnish",
    category: "food-dish",
    cuisine: "Indonesian / Padang",
    relatedTopics: ["rendang", "beef rendang", "Padang food", "Indonesian food", "slow-braised beef"],
    usageContext: ["rendang illustration", "Padang/Indonesian beef topic marker"],
    confidence: "very-high", approved: true,
    approvedByNote: "Philip 2026-08-21", createdAt: "2026-08-21",
  },
  {
    id: "nva-027", publicRef: "#NVA-027",
    imageUrl: "https://ik.imagekit.io/nepgaxllc/Untitledasdasdaaavvvdddddasdassssddddfss-removebg-preview.png?updatedAt=1777006431762",
    transparentBackground: true,
    primarySubject: "small bamboo tampah with rendang pieces, boiled egg, shredded meat and greens",
    category: "food-dish",
    cuisine: "Indonesian",
    relatedTopics: ["rendang", "tampah", "boiled egg", "Indonesian small plate", "Indonesian food"],
    usageContext: ["small Indonesian meal illustration", "tampah plating topic marker"],
    confidence: "high", approved: true,
    approvedByNote: "Philip 2026-08-21", createdAt: "2026-08-21",
  },
  {
    id: "nva-028", publicRef: "#NVA-028",
    imageUrl: "https://ik.imagekit.io/nepgaxllc/Untitledasdasdaaavvvdddddasdassssddddf-removebg-preview.png?updatedAt=1777006183312",
    transparentBackground: true,
    primarySubject: "small nasi campur plate · rice + rendang + spiced greens + chickpeas + chili",
    category: "food-dish",
    cuisine: "Indonesian",
    relatedTopics: ["nasi campur", "nasi rames", "Indonesian rice plate", "rendang", "sambal"],
    usageContext: ["nasi campur illustration", "Indonesian mixed-rice topic marker"],
    confidence: "high", approved: true,
    approvedByNote: "Philip 2026-08-21", createdAt: "2026-08-21",
  },
  {
    id: "nva-029", publicRef: "#NVA-029",
    imageUrl: "https://ik.imagekit.io/nepgaxllc/Untitledasdasdaaavvvdddddasdassssdddd-removebg-preview.png?updatedAt=1777006101833",
    transparentBackground: true,
    primarySubject: "Indonesian savoury pastry rolls (risoles/martabak-style) with meat-veg filling on black plate",
    category: "food-dish",
    cuisine: "Indonesian street food",
    relatedTopics: ["martabak", "risoles", "Indonesian pastry", "savoury pastry", "Indonesian snack", "street food"],
    usageContext: ["Indonesian pastry illustration", "martabak topic marker"],
    confidence: "high", approved: true,
    approvedByNote: "Philip 2026-08-21", createdAt: "2026-08-21",
  },
  {
    id: "nva-030", publicRef: "#NVA-030",
    imageUrl: "https://ik.imagekit.io/nepgaxllc/Untitledasdasdaaavvvdddddasdassssdd-removebg-preview.png?updatedAt=1777006023933",
    transparentBackground: true,
    primarySubject: "fresh salad bowl · lettuce, cucumber, tomato, red onion, olives",
    category: "salad",
    cuisine: "Mediterranean / Western",
    relatedTopics: ["salad", "fresh salad", "vegetarian", "olives", "healthy", "side dish"],
    usageContext: ["salad illustration", "vegetarian side-dish topic marker"],
    confidence: "very-high", approved: true,
    approvedByNote: "Philip 2026-08-21", createdAt: "2026-08-21",
  },
  {
    id: "nva-031", publicRef: "#NVA-031",
    imageUrl: "https://ik.imagekit.io/nepgaxllc/Untitledasdasdaaavvvdddddasdassss-removebg-preview.png?updatedAt=1777005925445",
    transparentBackground: true,
    primarySubject: "Indonesian bubur ayam · chicken rice porridge with fried shallots and peas",
    category: "food-dish",
    cuisine: "Indonesian",
    relatedTopics: ["bubur ayam", "chicken porridge", "rice porridge", "Indonesian breakfast", "comfort food"],
    usageContext: ["bubur ayam illustration", "Indonesian breakfast topic marker"],
    confidence: "high", approved: true,
    approvedByNote: "Philip 2026-08-21", createdAt: "2026-08-21",
  },
  {
    id: "nva-032", publicRef: "#NVA-032",
    imageUrl: "https://ik.imagekit.io/nepgaxllc/Untitledasdasdaaavvvdddddasdas-removebg-preview.png?updatedAt=1777005846135",
    transparentBackground: true,
    primarySubject: "seafood platter · whole crab, shrimp, mussels, lemon slice",
    category: "seafood",
    cuisine: "Western / international seafood",
    relatedTopics: ["seafood", "crab", "shrimp", "mussels", "seafood platter", "shellfish"],
    usageContext: ["seafood illustration", "seafood-restaurant topic marker"],
    confidence: "very-high", approved: true,
    approvedByNote: "Philip 2026-08-21", createdAt: "2026-08-21",
  },
  {
    id: "nva-033", publicRef: "#NVA-033",
    imageUrl: "https://ik.imagekit.io/nepgaxllc/Untitledasdasdaaavvvdddddasdasss-removebg-preview.png?updatedAt=1777005796156",
    transparentBackground: true,
    primarySubject: "chicken vegetable soup bowl · chicken, carrot, celery, herbs in orange broth",
    category: "food-dish",
    cuisine: "Western / Indonesian soto-adjacent",
    relatedTopics: ["chicken soup", "vegetable soup", "soto", "soup", "comfort food"],
    usageContext: ["soup illustration", "chicken-soup topic marker"],
    confidence: "very-high", approved: true,
    approvedByNote: "Philip 2026-08-21", createdAt: "2026-08-21",
  },
  {
    id: "nva-034", publicRef: "#NVA-034",
    imageUrl: "https://ik.imagekit.io/nepgaxllc/Untitledasdasdaaavvvdddddasda-removebg-preview.png?updatedAt=1777005352896",
    transparentBackground: true,
    primarySubject: "fried Indian-style samosas and spring rolls with red chutney on black plate",
    category: "food-dish",
    cuisine: "Indian / South Asian",
    relatedTopics: ["samosa", "spring rolls", "Indian snacks", "fried snacks", "chutney", "South Asian food"],
    usageContext: ["Indian snack illustration", "samosa topic marker"],
    confidence: "very-high", approved: true,
    approvedByNote: "Philip 2026-08-21", createdAt: "2026-08-21",
  },
  {
    id: "nva-035", publicRef: "#NVA-035",
    imageUrl: "https://ik.imagekit.io/nepgaxllc/Untitledasdasdaaavvvdddd-removebg-preview.png?updatedAt=1777005286525",
    transparentBackground: true,
    primarySubject: "chicken satay skewers on black plate with peanut sauce, cucumber, red onion",
    category: "food-dish",
    cuisine: "Indonesian",
    relatedTopics: ["sate ayam", "chicken satay", "satay", "peanut sauce", "Indonesian food", "skewers"],
    usageContext: ["satay illustration", "Indonesian chicken-satay topic marker"],
    confidence: "very-high", approved: true,
    approvedByNote: "Philip 2026-08-21", createdAt: "2026-08-21",
  },
  {
    id: "nva-036", publicRef: "#NVA-036",
    imageUrl: "https://ik.imagekit.io/nepgaxllc/Untitledasdasdaaavvvd-removebg-preview.png?updatedAt=1777005204904",
    transparentBackground: true,
    primarySubject: "whole roasted golden chicken on lettuce on black plate",
    category: "food-dish",
    cuisine: "Western / international",
    relatedTopics: ["roast chicken", "whole chicken", "rotisserie chicken", "Western food"],
    usageContext: ["whole roast-chicken illustration", "roast-chicken topic marker"],
    confidence: "very-high", approved: true,
    approvedByNote: "Philip 2026-08-21", createdAt: "2026-08-21",
  },
  {
    id: "nva-037", publicRef: "#NVA-037",
    imageUrl: "https://ik.imagekit.io/nepgaxllc/Untitledasdasdaaavvv-removebg-preview.png?updatedAt=1777005130878",
    transparentBackground: true,
    primarySubject: "Chinese-style stir-fried noodles in black bowl with chopsticks lifting noodles",
    category: "food-dish",
    cuisine: "Chinese / Indonesian",
    relatedTopics: ["mie goreng", "stir-fried noodles", "chow mein", "Chinese noodles", "Indonesian noodles"],
    usageContext: ["noodle illustration", "stir-fried noodles topic marker"],
    confidence: "very-high", approved: true,
    approvedByNote: "Philip 2026-08-21", createdAt: "2026-08-21",
  },
  {
    id: "nva-038", publicRef: "#NVA-038",
    imageUrl: "https://ik.imagekit.io/nepgaxllc/Untitledfsdfsssssdss-removebg-preview.png?updatedAt=1777225952838",
    transparentBackground: true,
    primarySubject: "plain steamed white rice in black bowl with parsley garnish",
    category: "ingredient",
    cuisine: "universal staple",
    relatedTopics: ["rice", "steamed rice", "white rice", "nasi", "staple", "side dish"],
    usageContext: ["rice illustration", "staple/side-dish topic marker"],
    confidence: "very-high", approved: true,
    approvedByNote: "Philip 2026-08-21", createdAt: "2026-08-21",
  },
  {
    id: "nva-039", publicRef: "#NVA-039",
    imageUrl: "https://ik.imagekit.io/nepgaxllc/Untitledfsdfsssssds-removebg-preview.png?updatedAt=1777225868236",
    transparentBackground: true,
    primarySubject: "illustrated fast food · red carton of fries + bowl of coleslaw + onion rings + ketchup ramekin",
    category: "icon-illustrated",
    cuisine: "American fast food",
    relatedTopics: ["fast food", "fries", "coleslaw", "onion rings", "fast-food icon"],
    usageContext: ["fast-food icon illustration (cartoon style)", "quick visual marker for Fast Food category chip"],
    confidence: "very-high", approved: true,
    approvedByNote: "Philip 2026-08-21 · CARTOON/ILLUSTRATED STYLE (not photo-realistic) · suitable as icon in category chip", createdAt: "2026-08-21",
  },
  {
    id: "nva-040", publicRef: "#NVA-040",
    imageUrl: "https://ik.imagekit.io/nepgaxllc/Untitledfsdfssss-removebg-preview.png?updatedAt=1777225782983",
    transparentBackground: true,
    primarySubject: "illustrated drinks trio · dark cola + amber beer + green cocktail with lime",
    category: "icon-illustrated",
    cuisine: "bar / cafe",
    relatedTopics: ["drinks", "cola", "beer", "cocktail", "beverages", "bar", "drinks icon"],
    usageContext: ["drinks icon illustration (cartoon style)", "quick visual marker for drinks category"],
    confidence: "very-high", approved: true,
    approvedByNote: "Philip 2026-08-21 · CARTOON/ILLUSTRATED STYLE · suitable as icon", createdAt: "2026-08-21",
  },
  {
    id: "nva-041", publicRef: "#NVA-041",
    imageUrl: "https://ik.imagekit.io/nepgaxllc/vcc.png?updatedAt=1778670367419",
    transparentBackground: true,
    primarySubject: "illustrated condiments · red ketchup in bowl + squeeze bottle + white mayo + red chili + garlic",
    category: "icon-illustrated",
    cuisine: "universal condiments",
    relatedTopics: ["ketchup", "mayo", "chili sauce", "condiments", "sauces", "sambal"],
    usageContext: ["condiment illustration (cartoon style)", "sauce/condiment topic marker"],
    confidence: "very-high", approved: true,
    approvedByNote: "Philip 2026-08-21 · CARTOON/ILLUSTRATED STYLE · condiment icon", createdAt: "2026-08-21",
  },
];

// ── Retrieval helpers (used by NEX brain when it lands · Priority 4+) ──

/** Look up a visual asset by its stable public reference. */
export function assetByRef(ref: string): NexVisualAsset | undefined {
  return NEX_VISUAL_ASSETS.find((a) => a.publicRef === ref);
}

/** All assets for a given category. */
export function assetsByCategory(category: NexVisualAssetCategory): NexVisualAsset[] {
  return NEX_VISUAL_ASSETS.filter((a) => a.category === category);
}

/**
 * Find visual assets whose `relatedTopics` include the queried topic.
 * NEX brain uses this at chat-reply time: "does a visual exist for topic X?"
 * If yes, the reply layer MAY embed one inline. If no, no visual is used.
 */
export function assetsForTopic(topic: string): NexVisualAsset[] {
  const q = topic.trim().toLowerCase();
  if (!q) return [];
  return NEX_VISUAL_ASSETS.filter((a) =>
    a.relatedTopics.some((t) => t.toLowerCase().includes(q) || q.includes(t.toLowerCase()))
  );
}

/**
 * Pick a single asset for a topic — deterministic (first match by insertion
 * order). Priority 4+ brain layer will replace this with confidence-ranked
 * selection.
 */
export function pickAssetForTopic(topic: string): NexVisualAsset | undefined {
  return assetsForTopic(topic)[0];
}
