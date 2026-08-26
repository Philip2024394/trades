#!/usr/bin/env node
// scripts/nex-shop/_seed-category-taxonomy.mjs
//
// Seeds the 3-level Master → L1 → L2 category hierarchy into nex.mp_category.
// Idempotent · repoints demo products from legacy flat categories to the new
// Level-2 rows before deleting the orphaned legacy rows.
//
// Level convention (mp_category.level):
//   1 · Master        (Electronics · Fashion & Apparel · ...)
//   2 · Sub-category  (Smartphones & Accessories · ...)
//   3 · Micro-niche   (Mobile Phones · ...)

import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.NEX_POSTGRES_URL, max: 3 });

// ── Slug helpers (mirror src/lib/nex-shop/taxonomy.ts) ────────────────
function slug(s) {
  return String(s).toLowerCase()
    .replace(/&/g, "and")
    .replace(/[()]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
const masterKey = (m) => slug(m);
const level1Key = (m, l1) => `${slug(m)}/${slug(l1)}`;
const level2Key = (m, l1, l2) => `${slug(m)}/${slug(l1)}/${slug(l2)}`;
const fullPath = (m, l1, l2) => [m, l1, l2].filter(Boolean).join(" > ");

// ── Taxonomy (mirror src/lib/nex-shop/taxonomy.ts TAXONOMY) ───────────
const TAXONOMY = [
  { label: "Electronics", icon: "📱", children: [
    { label: "Smartphones & Accessories", children: ["Mobile Phones","Phone Cases & Protection","Chargers & Cables","Power Banks","Mounts & Stands"] },
    { label: "Computers & Laptops", children: ["Laptops & Notebooks","Desktop Computers","Tablets & iPads","PC Components (RAM, GPU, CPU)","Storage Devices (SSD, HDD, Flash Drives)","Monitors & Displays"] },
    { label: "Audio & Headphones", children: ["Wireless Earbuds","Over-Ear Headphones","Bluetooth Speakers","Soundbars & Home Theater","Microphones & Recording"] },
    { label: "Wearable Technology", children: ["Smartwatches","Fitness Trackers","VR & AR Headsets"] },
    { label: "Smart Home Devices", children: ["Security Cameras & Doorbells","Smart Plugs & Switches","Smart Lighting","Smart Thermostats"] },
    { label: "Cameras & Photography", children: ["DSLR & Mirrorless Cameras","Action & Drone Cameras","Lenses & Flashes","Tripods & Studio Lighting"] },
    { label: "Video Games & Consoles", children: ["Gaming Consoles","Video Game Discs/Digital Codes","Gaming Controllers & Keyboards","Gaming Headsets"] },
  ]},
  { label: "Fashion & Apparel", icon: "👗", children: [
    { label: "Women's Clothing", children: ["Dresses & Jumpsuits","Tops, Blouses & Tees","Pants, Jeans & Skirts","Activewear & Athleisure","Outerwear (Coats, Jackets)","Lingerie, Sleepwear & Intimates","Swimwear"] },
    { label: "Men's Clothing", children: ["Shirts, Polos & Tees","Pants, Jeans & Chinos","Suits & Formal Wear","Activewear & Gym Clothes","Outerwear (Jackets, Hoodies)","Underwear & Socks","Swimwear"] },
    { label: "Children & Baby Apparel", children: ["Baby Bodysuits & Onesies","Toddler Clothing Sets","Boys Wear","Girls Wear","School Uniforms"] },
    { label: "Shoes & Footwear", children: ["Sneakers & Athletic Shoes","Boots","Heels & Pumps","Flats & Loafers","Sandals & Slippers"] },
    { label: "Jewelry & Watches", children: ["Fine Jewelry (Gold, Diamonds)","Fashion/Costume Jewelry","Luxury Watches","Smartwatch Bands & Accessories"] },
    { label: "Bags & Accessories", children: ["Handbags & Totes","Backpacks & Messengers","Wallets & Cardholders","Sunglasses & Eyewear","Belts, Hats & Scarves"] },
  ]},
  { label: "Home & Kitchen", icon: "🏠", children: [
    { label: "Furniture", children: ["Living Room Furniture (Sofas, Coffee Tables)","Bedroom Furniture (Beds, Mattresses, Wardrobes)","Dining Room Furniture (Tables, Chairs)","Office Furniture (Desks, Ergonomic Chairs)","Outdoor & Patio Furniture"] },
    { label: "Cookware & Kitchenware", children: ["Pots & Pans (Non-stick, Cast Iron)","Bakeware (Baking Sheets, Cake Pans)","Kitchen Knives & Cutlery Blocks","Dinnerware (Plates, Bowls)","Glassware & Drinkware","Kitchen Utensils & Gadgets"] },
    { label: "Home Decor", children: ["Rugs & Carpets","Curtains, Blinds & Window Hardware","Wall Art, Paintings & Frames","Vases, Artificial Plants & Planters","Candles, Diffusers & Essential Oils","Decorative Pillows & Throws"] },
    { label: "Bedding & Bath", children: ["Sheets & Pillowcases","Comforters, Duvets & Blankets","Bath Towels & Washcloths","Shower Curtains & Bath Mats"] },
    { label: "Household Appliances", children: ["Blenders, Juicers & Food Processors","Coffee Makers & Espresso Machines","Air Fryers, Toasters & Microwaves","Vacuum Cleaners & Robotic Vacuums","Air Purifiers, Fans & Dehumidifiers","Refrigerators, Washers & Dryers"] },
  ]},
  { label: "Beauty & Personal Care", icon: "💄", children: [
    { label: "Skincare", children: ["Face Cleansers & Toners","Moisturizers, Creams & Oils","Serums, Treatments & Face Masks","Sunscreens & Sun Protection","Eye Creams & Lip Balms"] },
    { label: "Makeup & Cosmetics", children: ["Face Makeup (Foundation, Concealer)","Eye Makeup (Mascara, Eyeshadow, Eyeliner)","Lip Makeup (Lipstick, Gloss, Liners)","Nail Polish & Manicure Kits","Makeup Brushes, Sponges & Organizers"] },
    { label: "Hair Care & Styling", children: ["Shampoos & Conditioners","Hair Masks, Oils & Leave-in Treatments","Styling Gels, Mousses & Sprays","Hair Dryers, Straighteners & Curlers","Hair Coloring Products"] },
    { label: "Fragrances", children: ["Women's Perfumes","Men's Colognes","Unisex Fragrances & Body Mists"] },
    { label: "Personal Care & Hygiene", children: ["Body Washes & Soaps","Deodorants & Antiperspirants","Oral Care (Toothpaste, Electric Toothbrushes)","Shaving & Hair Removal (Razors, Epilators)"] },
  ]},
  { label: "Health & Wellness", icon: "💊", children: [
    { label: "Vitamins & Supplements", children: ["Multivitamins & Minerals","Protein Powders & Performance Supplements","Herbal Extracts & Botanicals","Probiotics & Digestive Health"] },
    { label: "Medical Supplies & Devices", children: ["First-Aid Kits & Bandages","Thermometers & Pulse Oximeters","Blood Pressure Monitors","Face Masks & Sanitizers","Mobility Aids (Canes, Walkers)"] },
    { label: "Personal Wellness & Care", children: ["Sexual Wellness Products","Sleep Aids & Snoring Solutions","Massagers & Massage Guns","Smoking Cessation Products"] },
  ]},
  { label: "Sports & Outdoors", icon: "⚽", children: [
    { label: "Fitness & Gym Gear", children: ["Dumbbells, Barbells & Kettlebells","Yoga Mats, Blocks & Straps","Resistance Bands & Jump Ropes","Treadmills, Ellipticals & Exercise Bikes","Gym Bags & Shaker Bottles"] },
    { label: "Outdoor Recreation", children: ["Camping Tents & Sleeping Bags","Hiking Backpacks & Trekking Poles","Camping Cookware & Portable Stoves","Fishing Rods, Reels & Lures","Bicycles, Helmets & Accessories","Climbing Gear & Carabiners"] },
    { label: "Team Sports", children: ["Basketball Equipment","Soccer Balls, Cleats & Shin Guards","Tennis Rackets, Balls & Networks","Baseball Gloves, Bats & Helmets"] },
    { label: "Sportswear & Athleisure", children: ["Moisture-Wicking T-Shirts","Sports Bras & Compression Tops","Running Shorts & Leggings","Athletic Socks & Headbands"] },
  ]},
  { label: "Toys & Hobbies", icon: "🧸", children: [
    { label: "Games & Puzzles", children: ["Board Games","Card Games","Jigsaw Puzzles","Trading Card Games (TCG)"] },
    { label: "Toys & Figurines", children: ["Action Figures & Collectibles","Dolls, Fashion Dolls & Playsets","Stuffed Animals & Plush Toys","Die-Cast Vehicles & RC Cars"] },
    { label: "Educational & STEM", children: ["Science & Chemistry Kits","Building Blocks & LEGO Sets","Coding & Robotic Toys","Early Learning & Alphabet Toys"] },
    { label: "Arts & Crafts Hobbies", children: ["Model Kits (Planes, Cars)","Knitting, Crochet & Sewing Supplies","Paints, Canvas & Brushes","Scrapbooking & Paper Crafts"] },
  ]},
  { label: "Automotive", icon: "🚗", children: [
    { label: "Replacement Parts", children: ["Brake Pads & Rotors","Engine Filters (Air, Oil, Cabin)","Spark Plugs & Ignition Coils","Windshield Wiper Blades","Car Batteries & Alternators"] },
    { label: "Tools & Garage Equipment", children: ["Hydraulic Jacks & Stands","Wrench, Socket & Hand Tool Sets","OBD2 Diagnostic Scanners","Tire Inflators & Air Compressors"] },
    { label: "Car Care & Detailing", children: ["Car Wash Shampoos & Soaps","Car Waxes, Polishes & Sealants","Microfiber Towels & Wash Mitts","Interior Cleaners & Leather Conditioners"] },
    { label: "Interior & Exterior Accessories", children: ["Car Floor Mats & Seat Covers","Phone Mounts & Dash Cameras","Car Covers & Sunshades","Roof Racks & Cargo Carriers"] },
  ]},
  { label: "Groceries & Gourmet Food", icon: "🍎", children: [
    { label: "Pantry Staples", children: ["Rice, Grains & Beans","Pasta, Noodles & Sauce","Baking Flour, Sugar & Yeast","Cooking Oils, Vinegars & Ghee","Spices, Herbs & Seasonings"] },
    { label: "Snacks & Sweets", children: ["Potato Chips & Crackers","Chocolates, Candies & Toffees","Nuts, Seeds & Dried Fruits","Cookies, Biscuits & Wafers"] },
    { label: "Beverages", children: ["Coffee Beans & Ground Coffee","Tea Bags & Loose Leaf Tea","Fruit Juices & Smoothies","Sodas, Sparkling Water & Energy Drinks","Plant-Based & Dairy Milks"] },
    { label: "Fresh & Chilled (eGrocery)", children: ["Fresh Fruits & Vegetables","Meat, Poultry & Seafood","Cheese, Butter & Yogurt","Frozen Ready Meals & Ice Cream"] },
  ]},
  { label: "Pet Supplies", icon: "🐾", children: [
    { label: "Dog Supplies", children: ["Dog Kibble & Wet Food","Dog Treats & Chews","Leashes, Collars & Harnesses","Dog Beds & Crates","Dog Toys (Chew Toys, Balls)","Dog Grooming (Shampoo, Brushes)"] },
    { label: "Cat Supplies", children: ["Cat Dry Food & Pouches","Cat Litter & Litter Boxes","Cat Scratchers & Condos","Cat Toys & Catnip"] },
    { label: "Other Small Animals", children: ["Bird Food & Cages","Fish Tanks, Filters & Fish Food","Hamster, Rabbit Food & Bedding"] },
  ]},
  { label: "Office & Stationery", icon: "📎", children: [
    { label: "Writing Instruments", children: ["Gel Pens, Ballpoints & Pencils","Permanent Markers & Highlighters","Fountain Pens & Calligraphy Ink"] },
    { label: "Paper & Notebooks", children: ["Notebooks, Journals & Notepads","Printer Paper & Cardstock","Sticky Notes & Memo Pads"] },
    { label: "Desk Organization", children: ["Desk Organizers & Pen Holders","File Folders, Binders & Expanding Files","Whiteboards & Corkboards"] },
    { label: "Office Supplies", children: ["Scissors, Staplers & Hole Punchers","Calculators & Label Makers","Mailing Envelopes & Packing Tape"] },
  ]},
  { label: "Tools & Home Improvement", icon: "🛠", children: [
    { label: "Hand & Power Tools", children: ["Power Drills, Saws & Sanders","Screwdrivers, Hammers & Pliers","Toolboxes & Tool Belts","Measuring Tapes & Laser Levels"] },
    { label: "Electrical & Lighting", children: ["Light Bulbs & LED Strips","Extension Cords & Surge Protectors","Light Fixtures & Chandeliers"] },
    { label: "Plumbing & Fixtures", children: ["Kitchen & Bathroom Faucets","Shower Heads & Hoses","Plumbing Tape & Pipe Sealants"] },
    { label: "Safety & Security", children: ["Smoke & Carbon Monoxide Detectors","Safety Goggles, Gloves & Ear Protection","Fire Extinguishers"] },
  ]},
  { label: "Books, Music & Movies", icon: "📚", children: [
    { label: "Books & Literature", children: ["Fiction Novels (Mystery, Sci-Fi, Romance)","Non-Fiction (Biographies, Self-Help, History)","Children's & Teen Books","Textbooks & Academic Guides","Comic Books, Manga & Graphic Novels"] },
    { label: "Physical Media", children: ["Vinyl Records & LP Albums","Audio CDs","Blu-ray Discs & 4K Ultra HD Movies"] },
  ]},
];

// Demo product → target L2 mapping (only 5 legacy rows)
const DEMO_PRODUCT_REMAP = [
  { productSlug: "nex-premium-tshirt",  targetKey: level2Key("Fashion & Apparel", "Men's Clothing", "Shirts, Polos & Tees") },
  { productSlug: "nex-phone-a1",        targetKey: level2Key("Electronics", "Smartphones & Accessories", "Mobile Phones") },
  { productSlug: "nex-helmet-atlas",    targetKey: level2Key("Sports & Outdoors", "Outdoor Recreation", "Bicycles, Helmets & Accessories") },
  { productSlug: "nex-office-chair",    targetKey: level2Key("Home & Kitchen", "Furniture", "Office Furniture (Desks, Ergonomic Chairs)") },
  { productSlug: "nex-classic-hammer",  targetKey: level2Key("Tools & Home Improvement", "Hand & Power Tools", "Screwdrivers, Hammers & Pliers") },
];

async function upsertMaster(m, sortOrder) {
  const key = masterKey(m.label);
  const r = await pool.query(
    `INSERT INTO nex.mp_category (key, label, level, path, sort_order, parent_id)
     VALUES ($1, $2, 1, $3, $4, NULL)
     ON CONFLICT (key) DO UPDATE SET label=EXCLUDED.label, level=1, path=EXCLUDED.path, sort_order=EXCLUDED.sort_order, parent_id=NULL
     RETURNING category_id`,
    [key, m.label, fullPath(m.label), sortOrder],
  );
  return r.rows[0].category_id;
}

async function upsertLevel1(masterLabel, masterId, l1Label, sortOrder) {
  const key = level1Key(masterLabel, l1Label);
  const r = await pool.query(
    `INSERT INTO nex.mp_category (key, label, level, path, sort_order, parent_id)
     VALUES ($1, $2, 2, $3, $4, $5)
     ON CONFLICT (key) DO UPDATE SET label=EXCLUDED.label, level=2, path=EXCLUDED.path, sort_order=EXCLUDED.sort_order, parent_id=$5
     RETURNING category_id`,
    [key, l1Label, fullPath(masterLabel, l1Label), sortOrder, masterId],
  );
  return r.rows[0].category_id;
}

async function upsertLevel2(masterLabel, l1Label, l1Id, l2Label, sortOrder) {
  const key = level2Key(masterLabel, l1Label, l2Label);
  await pool.query(
    `INSERT INTO nex.mp_category (key, label, level, path, sort_order, parent_id)
     VALUES ($1, $2, 3, $3, $4, $5)
     ON CONFLICT (key) DO UPDATE SET label=EXCLUDED.label, level=3, path=EXCLUDED.path, sort_order=EXCLUDED.sort_order, parent_id=$5`,
    [key, l2Label, fullPath(masterLabel, l1Label, l2Label), sortOrder, l1Id],
  );
}

async function main() {
  const started = Date.now();
  console.log("╔══════════════════════════════════════════════════════════════════════════╗");
  console.log("║  NEX Market · 3-level category taxonomy seeder                            ║");
  console.log("╚══════════════════════════════════════════════════════════════════════════╝\n");

  let masters = 0, l1 = 0, l2 = 0;
  for (let i = 0; i < TAXONOMY.length; i++) {
    const m = TAXONOMY[i];
    const masterId = await upsertMaster(m, (i + 1) * 10);
    masters++;
    for (let j = 0; j < m.children.length; j++) {
      const l1Node = m.children[j];
      const l1Id = await upsertLevel1(m.label, masterId, l1Node.label, (j + 1) * 10);
      l1++;
      for (let k = 0; k < l1Node.children.length; k++) {
        await upsertLevel2(m.label, l1Node.label, l1Id, l1Node.children[k], (k + 1) * 10);
        l2++;
      }
    }
  }

  console.log(`Inserted/updated: ${masters} masters · ${l1} L1 · ${l2} L2 micro-niches`);

  // Repoint demo products to new L2 rows
  console.log("\n── Repointing demo products to new L2 categories ─────────────");
  for (const rep of DEMO_PRODUCT_REMAP) {
    const cat = await pool.query(`SELECT category_id FROM nex.mp_category WHERE key=$1`, [rep.targetKey]);
    if (cat.rowCount === 0) {
      console.log(`   ⚠ target key not found: ${rep.targetKey}`);
      continue;
    }
    const upd = await pool.query(
      `UPDATE nex.mp_product SET category_id=$1 WHERE slug=$2 RETURNING product_id`,
      [cat.rows[0].category_id, rep.productSlug],
    );
    console.log(`   ${rep.productSlug.padEnd(30)} → ${rep.targetKey} (${upd.rowCount} row updated)`);
  }

  // Delete legacy flat categories (level IS NULL) that have no children referencing them
  console.log("\n── Removing legacy flat categories ───────────────────────────");
  const del = await pool.query(
    `DELETE FROM nex.mp_category
      WHERE level IS NULL
        AND category_id NOT IN (SELECT parent_id FROM nex.mp_category WHERE parent_id IS NOT NULL)
        AND NOT EXISTS (SELECT 1 FROM nex.mp_product p WHERE p.category_id = nex.mp_category.category_id)`,
  );
  console.log(`   deleted ${del.rowCount} legacy flat rows`);

  console.log(`\nRuntime: ${((Date.now() - started) / 1000).toFixed(1)}s`);
  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
