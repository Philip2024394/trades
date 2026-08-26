// src/lib/nex-shop/taxonomy.ts
//
// NEX Market · 3-level category taxonomy.
// Master → Sub-Category → Micro-Niche.
// Used by: category seeder · create-listing cascade · marketplace filters ·
// Market Walker keyword universe.

export interface Level2Node { label: string }
export interface Level1Node { label: string; children: Level2Node[] }
export interface MasterNode  { label: string; icon: string; children: Level1Node[] }

/** Stable key generator (folder-slash notation) · deterministic. */
export function slug(s: string): string {
  return s.toLowerCase()
    .replace(/&/g, "and")
    .replace(/[()]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function masterKey(master: string): string { return slug(master); }
export function level1Key(master: string, l1: string): string { return `${slug(master)}/${slug(l1)}`; }
export function level2Key(master: string, l1: string, l2: string): string {
  return `${slug(master)}/${slug(l1)}/${slug(l2)}`;
}
export function fullPath(master: string, l1?: string, l2?: string): string {
  return [master, l1, l2].filter(Boolean).join(" > ");
}

export const TAXONOMY: readonly MasterNode[] = [
  {
    label: "Electronics", icon: "📱",
    children: [
      { label: "Smartphones & Accessories", children: [
        { label: "Mobile Phones" }, { label: "Phone Cases & Protection" },
        { label: "Chargers & Cables" }, { label: "Power Banks" }, { label: "Mounts & Stands" },
      ] },
      { label: "Computers & Laptops", children: [
        { label: "Laptops & Notebooks" }, { label: "Desktop Computers" },
        { label: "Tablets & iPads" }, { label: "PC Components (RAM, GPU, CPU)" },
        { label: "Storage Devices (SSD, HDD, Flash Drives)" }, { label: "Monitors & Displays" },
      ] },
      { label: "Audio & Headphones", children: [
        { label: "Wireless Earbuds" }, { label: "Over-Ear Headphones" },
        { label: "Bluetooth Speakers" }, { label: "Soundbars & Home Theater" },
        { label: "Microphones & Recording" },
      ] },
      { label: "Wearable Technology", children: [
        { label: "Smartwatches" }, { label: "Fitness Trackers" }, { label: "VR & AR Headsets" },
      ] },
      { label: "Smart Home Devices", children: [
        { label: "Security Cameras & Doorbells" }, { label: "Smart Plugs & Switches" },
        { label: "Smart Lighting" }, { label: "Smart Thermostats" },
      ] },
      { label: "Cameras & Photography", children: [
        { label: "DSLR & Mirrorless Cameras" }, { label: "Action & Drone Cameras" },
        { label: "Lenses & Flashes" }, { label: "Tripods & Studio Lighting" },
      ] },
      { label: "Video Games & Consoles", children: [
        { label: "Gaming Consoles" }, { label: "Video Game Discs/Digital Codes" },
        { label: "Gaming Controllers & Keyboards" }, { label: "Gaming Headsets" },
      ] },
    ],
  },
  {
    label: "Fashion & Apparel", icon: "👗",
    children: [
      { label: "Women's Clothing", children: [
        { label: "Dresses & Jumpsuits" }, { label: "Tops, Blouses & Tees" },
        { label: "Pants, Jeans & Skirts" }, { label: "Activewear & Athleisure" },
        { label: "Outerwear (Coats, Jackets)" }, { label: "Lingerie, Sleepwear & Intimates" },
        { label: "Swimwear" },
      ] },
      { label: "Men's Clothing", children: [
        { label: "Shirts, Polos & Tees" }, { label: "Pants, Jeans & Chinos" },
        { label: "Suits & Formal Wear" }, { label: "Activewear & Gym Clothes" },
        { label: "Outerwear (Jackets, Hoodies)" }, { label: "Underwear & Socks" },
        { label: "Swimwear" },
      ] },
      { label: "Children & Baby Apparel", children: [
        { label: "Baby Bodysuits & Onesies" }, { label: "Toddler Clothing Sets" },
        { label: "Boys Wear" }, { label: "Girls Wear" }, { label: "School Uniforms" },
      ] },
      { label: "Shoes & Footwear", children: [
        { label: "Sneakers & Athletic Shoes" }, { label: "Boots" }, { label: "Heels & Pumps" },
        { label: "Flats & Loafers" }, { label: "Sandals & Slippers" },
      ] },
      { label: "Jewelry & Watches", children: [
        { label: "Fine Jewelry (Gold, Diamonds)" }, { label: "Fashion/Costume Jewelry" },
        { label: "Luxury Watches" }, { label: "Smartwatch Bands & Accessories" },
      ] },
      { label: "Bags & Accessories", children: [
        { label: "Handbags & Totes" }, { label: "Backpacks & Messengers" },
        { label: "Wallets & Cardholders" }, { label: "Sunglasses & Eyewear" },
        { label: "Belts, Hats & Scarves" },
      ] },
    ],
  },
  {
    label: "Home & Kitchen", icon: "🏠",
    children: [
      { label: "Furniture", children: [
        { label: "Living Room Furniture (Sofas, Coffee Tables)" },
        { label: "Bedroom Furniture (Beds, Mattresses, Wardrobes)" },
        { label: "Dining Room Furniture (Tables, Chairs)" },
        { label: "Office Furniture (Desks, Ergonomic Chairs)" },
        { label: "Outdoor & Patio Furniture" },
      ] },
      { label: "Cookware & Kitchenware", children: [
        { label: "Pots & Pans (Non-stick, Cast Iron)" }, { label: "Bakeware (Baking Sheets, Cake Pans)" },
        { label: "Kitchen Knives & Cutlery Blocks" }, { label: "Dinnerware (Plates, Bowls)" },
        { label: "Glassware & Drinkware" }, { label: "Kitchen Utensils & Gadgets" },
      ] },
      { label: "Home Decor", children: [
        { label: "Rugs & Carpets" }, { label: "Curtains, Blinds & Window Hardware" },
        { label: "Wall Art, Paintings & Frames" }, { label: "Vases, Artificial Plants & Planters" },
        { label: "Candles, Diffusers & Essential Oils" }, { label: "Decorative Pillows & Throws" },
      ] },
      { label: "Bedding & Bath", children: [
        { label: "Sheets & Pillowcases" }, { label: "Comforters, Duvets & Blankets" },
        { label: "Bath Towels & Washcloths" }, { label: "Shower Curtains & Bath Mats" },
      ] },
      { label: "Household Appliances", children: [
        { label: "Blenders, Juicers & Food Processors" }, { label: "Coffee Makers & Espresso Machines" },
        { label: "Air Fryers, Toasters & Microwaves" }, { label: "Vacuum Cleaners & Robotic Vacuums" },
        { label: "Air Purifiers, Fans & Dehumidifiers" }, { label: "Refrigerators, Washers & Dryers" },
      ] },
    ],
  },
  {
    label: "Beauty & Personal Care", icon: "💄",
    children: [
      { label: "Skincare", children: [
        { label: "Face Cleansers & Toners" }, { label: "Moisturizers, Creams & Oils" },
        { label: "Serums, Treatments & Face Masks" }, { label: "Sunscreens & Sun Protection" },
        { label: "Eye Creams & Lip Balms" },
      ] },
      { label: "Makeup & Cosmetics", children: [
        { label: "Face Makeup (Foundation, Concealer)" }, { label: "Eye Makeup (Mascara, Eyeshadow, Eyeliner)" },
        { label: "Lip Makeup (Lipstick, Gloss, Liners)" }, { label: "Nail Polish & Manicure Kits" },
        { label: "Makeup Brushes, Sponges & Organizers" },
      ] },
      { label: "Hair Care & Styling", children: [
        { label: "Shampoos & Conditioners" }, { label: "Hair Masks, Oils & Leave-in Treatments" },
        { label: "Styling Gels, Mousses & Sprays" }, { label: "Hair Dryers, Straighteners & Curlers" },
        { label: "Hair Coloring Products" },
      ] },
      { label: "Fragrances", children: [
        { label: "Women's Perfumes" }, { label: "Men's Colognes" }, { label: "Unisex Fragrances & Body Mists" },
      ] },
      { label: "Personal Care & Hygiene", children: [
        { label: "Body Washes & Soaps" }, { label: "Deodorants & Antiperspirants" },
        { label: "Oral Care (Toothpaste, Electric Toothbrushes)" },
        { label: "Shaving & Hair Removal (Razors, Epilators)" },
      ] },
    ],
  },
  {
    label: "Health & Wellness", icon: "💊",
    children: [
      { label: "Vitamins & Supplements", children: [
        { label: "Multivitamins & Minerals" }, { label: "Protein Powders & Performance Supplements" },
        { label: "Herbal Extracts & Botanicals" }, { label: "Probiotics & Digestive Health" },
      ] },
      { label: "Medical Supplies & Devices", children: [
        { label: "First-Aid Kits & Bandages" }, { label: "Thermometers & Pulse Oximeters" },
        { label: "Blood Pressure Monitors" }, { label: "Face Masks & Sanitizers" },
        { label: "Mobility Aids (Canes, Walkers)" },
      ] },
      { label: "Personal Wellness & Care", children: [
        { label: "Sexual Wellness Products" }, { label: "Sleep Aids & Snoring Solutions" },
        { label: "Massagers & Massage Guns" }, { label: "Smoking Cessation Products" },
      ] },
    ],
  },
  {
    label: "Sports & Outdoors", icon: "⚽",
    children: [
      { label: "Fitness & Gym Gear", children: [
        { label: "Dumbbells, Barbells & Kettlebells" }, { label: "Yoga Mats, Blocks & Straps" },
        { label: "Resistance Bands & Jump Ropes" }, { label: "Treadmills, Ellipticals & Exercise Bikes" },
        { label: "Gym Bags & Shaker Bottles" },
      ] },
      { label: "Outdoor Recreation", children: [
        { label: "Camping Tents & Sleeping Bags" }, { label: "Hiking Backpacks & Trekking Poles" },
        { label: "Camping Cookware & Portable Stoves" }, { label: "Fishing Rods, Reels & Lures" },
        { label: "Bicycles, Helmets & Accessories" }, { label: "Climbing Gear & Carabiners" },
      ] },
      { label: "Team Sports", children: [
        { label: "Basketball Equipment" }, { label: "Soccer Balls, Cleats & Shin Guards" },
        { label: "Tennis Rackets, Balls & Networks" }, { label: "Baseball Gloves, Bats & Helmets" },
      ] },
      { label: "Sportswear & Athleisure", children: [
        { label: "Moisture-Wicking T-Shirts" }, { label: "Sports Bras & Compression Tops" },
        { label: "Running Shorts & Leggings" }, { label: "Athletic Socks & Headbands" },
      ] },
    ],
  },
  {
    label: "Toys & Hobbies", icon: "🧸",
    children: [
      { label: "Games & Puzzles", children: [
        { label: "Board Games" }, { label: "Card Games" },
        { label: "Jigsaw Puzzles" }, { label: "Trading Card Games (TCG)" },
      ] },
      { label: "Toys & Figurines", children: [
        { label: "Action Figures & Collectibles" }, { label: "Dolls, Fashion Dolls & Playsets" },
        { label: "Stuffed Animals & Plush Toys" }, { label: "Die-Cast Vehicles & RC Cars" },
      ] },
      { label: "Educational & STEM", children: [
        { label: "Science & Chemistry Kits" }, { label: "Building Blocks & LEGO Sets" },
        { label: "Coding & Robotic Toys" }, { label: "Early Learning & Alphabet Toys" },
      ] },
      { label: "Arts & Crafts Hobbies", children: [
        { label: "Model Kits (Planes, Cars)" }, { label: "Knitting, Crochet & Sewing Supplies" },
        { label: "Paints, Canvas & Brushes" }, { label: "Scrapbooking & Paper Crafts" },
      ] },
    ],
  },
  {
    label: "Automotive", icon: "🚗",
    children: [
      { label: "Replacement Parts", children: [
        { label: "Brake Pads & Rotors" }, { label: "Engine Filters (Air, Oil, Cabin)" },
        { label: "Spark Plugs & Ignition Coils" }, { label: "Windshield Wiper Blades" },
        { label: "Car Batteries & Alternators" },
      ] },
      { label: "Tools & Garage Equipment", children: [
        { label: "Hydraulic Jacks & Stands" }, { label: "Wrench, Socket & Hand Tool Sets" },
        { label: "OBD2 Diagnostic Scanners" }, { label: "Tire Inflators & Air Compressors" },
      ] },
      { label: "Car Care & Detailing", children: [
        { label: "Car Wash Shampoos & Soaps" }, { label: "Car Waxes, Polishes & Sealants" },
        { label: "Microfiber Towels & Wash Mitts" }, { label: "Interior Cleaners & Leather Conditioners" },
      ] },
      { label: "Interior & Exterior Accessories", children: [
        { label: "Car Floor Mats & Seat Covers" }, { label: "Phone Mounts & Dash Cameras" },
        { label: "Car Covers & Sunshades" }, { label: "Roof Racks & Cargo Carriers" },
      ] },
    ],
  },
  {
    label: "Groceries & Gourmet Food", icon: "🍎",
    children: [
      { label: "Pantry Staples", children: [
        { label: "Rice, Grains & Beans" }, { label: "Pasta, Noodles & Sauce" },
        { label: "Baking Flour, Sugar & Yeast" }, { label: "Cooking Oils, Vinegars & Ghee" },
        { label: "Spices, Herbs & Seasonings" },
      ] },
      { label: "Snacks & Sweets", children: [
        { label: "Potato Chips & Crackers" }, { label: "Chocolates, Candies & Toffees" },
        { label: "Nuts, Seeds & Dried Fruits" }, { label: "Cookies, Biscuits & Wafers" },
      ] },
      { label: "Beverages", children: [
        { label: "Coffee Beans & Ground Coffee" }, { label: "Tea Bags & Loose Leaf Tea" },
        { label: "Fruit Juices & Smoothies" }, { label: "Sodas, Sparkling Water & Energy Drinks" },
        { label: "Plant-Based & Dairy Milks" },
      ] },
      { label: "Fresh & Chilled (eGrocery)", children: [
        { label: "Fresh Fruits & Vegetables" }, { label: "Meat, Poultry & Seafood" },
        { label: "Cheese, Butter & Yogurt" }, { label: "Frozen Ready Meals & Ice Cream" },
      ] },
    ],
  },
  {
    label: "Pet Supplies", icon: "🐾",
    children: [
      { label: "Dog Supplies", children: [
        { label: "Dog Kibble & Wet Food" }, { label: "Dog Treats & Chews" },
        { label: "Leashes, Collars & Harnesses" }, { label: "Dog Beds & Crates" },
        { label: "Dog Toys (Chew Toys, Balls)" }, { label: "Dog Grooming (Shampoo, Brushes)" },
      ] },
      { label: "Cat Supplies", children: [
        { label: "Cat Dry Food & Pouches" }, { label: "Cat Litter & Litter Boxes" },
        { label: "Cat Scratchers & Condos" }, { label: "Cat Toys & Catnip" },
      ] },
      { label: "Other Small Animals", children: [
        { label: "Bird Food & Cages" }, { label: "Fish Tanks, Filters & Fish Food" },
        { label: "Hamster, Rabbit Food & Bedding" },
      ] },
    ],
  },
  {
    label: "Office & Stationery", icon: "📎",
    children: [
      { label: "Writing Instruments", children: [
        { label: "Gel Pens, Ballpoints & Pencils" }, { label: "Permanent Markers & Highlighters" },
        { label: "Fountain Pens & Calligraphy Ink" },
      ] },
      { label: "Paper & Notebooks", children: [
        { label: "Notebooks, Journals & Notepads" }, { label: "Printer Paper & Cardstock" },
        { label: "Sticky Notes & Memo Pads" },
      ] },
      { label: "Desk Organization", children: [
        { label: "Desk Organizers & Pen Holders" }, { label: "File Folders, Binders & Expanding Files" },
        { label: "Whiteboards & Corkboards" },
      ] },
      { label: "Office Supplies", children: [
        { label: "Scissors, Staplers & Hole Punchers" }, { label: "Calculators & Label Makers" },
        { label: "Mailing Envelopes & Packing Tape" },
      ] },
    ],
  },
  {
    label: "Tools & Home Improvement", icon: "🛠",
    children: [
      { label: "Hand & Power Tools", children: [
        { label: "Power Drills, Saws & Sanders" }, { label: "Screwdrivers, Hammers & Pliers" },
        { label: "Toolboxes & Tool Belts" }, { label: "Measuring Tapes & Laser Levels" },
      ] },
      { label: "Electrical & Lighting", children: [
        { label: "Light Bulbs & LED Strips" }, { label: "Extension Cords & Surge Protectors" },
        { label: "Light Fixtures & Chandeliers" },
      ] },
      { label: "Plumbing & Fixtures", children: [
        { label: "Kitchen & Bathroom Faucets" }, { label: "Shower Heads & Hoses" },
        { label: "Plumbing Tape & Pipe Sealants" },
      ] },
      { label: "Safety & Security", children: [
        { label: "Smoke & Carbon Monoxide Detectors" }, { label: "Safety Goggles, Gloves & Ear Protection" },
        { label: "Fire Extinguishers" },
      ] },
    ],
  },
  {
    label: "Books, Music & Movies", icon: "📚",
    children: [
      { label: "Books & Literature", children: [
        { label: "Fiction Novels (Mystery, Sci-Fi, Romance)" },
        { label: "Non-Fiction (Biographies, Self-Help, History)" },
        { label: "Children's & Teen Books" }, { label: "Textbooks & Academic Guides" },
        { label: "Comic Books, Manga & Graphic Novels" },
      ] },
      { label: "Physical Media", children: [
        { label: "Vinyl Records & LP Albums" }, { label: "Audio CDs" },
        { label: "Blu-ray Discs & 4K Ultra HD Movies" },
      ] },
    ],
  },
];

/** Flatten to a per-level list for seeding. */
export function flattenTaxonomy(): {
  masters: { key: string; label: string; icon: string; sortOrder: number; path: string }[];
  level1: { key: string; label: string; parentKey: string; sortOrder: number; path: string }[];
  level2: { key: string; label: string; parentKey: string; sortOrder: number; path: string }[];
} {
  const masters: ReturnType<typeof flattenTaxonomy>["masters"] = [];
  const level1:  ReturnType<typeof flattenTaxonomy>["level1"] = [];
  const level2:  ReturnType<typeof flattenTaxonomy>["level2"] = [];
  TAXONOMY.forEach((m, i) => {
    masters.push({
      key: masterKey(m.label), label: m.label, icon: m.icon,
      sortOrder: (i + 1) * 10, path: fullPath(m.label),
    });
    m.children.forEach((l1, j) => {
      const l1Key = level1Key(m.label, l1.label);
      level1.push({
        key: l1Key, label: l1.label, parentKey: masterKey(m.label),
        sortOrder: (j + 1) * 10, path: fullPath(m.label, l1.label),
      });
      l1.children.forEach((l2, k) => {
        level2.push({
          key: level2Key(m.label, l1.label, l2.label), label: l2.label, parentKey: l1Key,
          sortOrder: (k + 1) * 10, path: fullPath(m.label, l1.label, l2.label),
        });
      });
    });
  });
  return { masters, level1, level2 };
}

/** All Level-2 micro-niche labels · used as Market Walker keyword source. */
export function allMicroNicheLabels(): string[] {
  return TAXONOMY.flatMap((m) => m.children.flatMap((l1) => l1.children.map((l2) => l2.label)));
}
