// Universal Design Sizes registry (Philip 2026-08-04).
//
// Every design renders into every required format · dimensions live HERE and
// nowhere else. Adding a new format = adding a row here · never inventing
// dimensions ad hoc elsewhere.
//
// Doctrine: docs/brains/nex-phase-e1-universal-design-studio-philip-2026-08-04.md

export type DesignSizeCategory = "social" | "web" | "print" | "documents" | "apps";

export type DesignSize = {
  id: string;
  name: string;
  category: DesignSizeCategory;
  width_px: number;
  height_px: number;
  dpi?: number;
  aspect_ratio: string;                  // "1:1" · "9:16" · etc.
  notes?: string;
};

// ─── Social (23) ─────────────────────────────────────────────────────────
const SOCIAL: readonly DesignSize[] = [
  { id: "facebook_feed", name: "Facebook Feed", category: "social", width_px: 1200, height_px: 628, aspect_ratio: "1.91:1" },
  { id: "facebook_cover", name: "Facebook Cover", category: "social", width_px: 851, height_px: 315, aspect_ratio: "2.7:1" },
  { id: "facebook_story", name: "Facebook Story", category: "social", width_px: 1080, height_px: 1920, aspect_ratio: "9:16" },
  { id: "instagram_feed", name: "Instagram Feed", category: "social", width_px: 1080, height_px: 1080, aspect_ratio: "1:1" },
  { id: "instagram_portrait", name: "Instagram Portrait", category: "social", width_px: 1080, height_px: 1350, aspect_ratio: "4:5" },
  { id: "instagram_story", name: "Instagram Story", category: "social", width_px: 1080, height_px: 1920, aspect_ratio: "9:16" },
  { id: "instagram_reel_cover", name: "Instagram Reel Cover", category: "social", width_px: 1080, height_px: 1920, aspect_ratio: "9:16" },
  { id: "instagram_carousel", name: "Instagram Carousel", category: "social", width_px: 1080, height_px: 1080, aspect_ratio: "1:1" },
  { id: "linkedin_post", name: "LinkedIn Post", category: "social", width_px: 1200, height_px: 627, aspect_ratio: "1.91:1" },
  { id: "linkedin_cover", name: "LinkedIn Cover", category: "social", width_px: 1584, height_px: 396, aspect_ratio: "4:1" },
  { id: "linkedin_company_banner", name: "LinkedIn Company Banner", category: "social", width_px: 1128, height_px: 191, aspect_ratio: "5.9:1" },
  { id: "pinterest_pin", name: "Pinterest Pin", category: "social", width_px: 1000, height_px: 1500, aspect_ratio: "2:3" },
  { id: "pinterest_story", name: "Pinterest Story", category: "social", width_px: 1080, height_px: 1920, aspect_ratio: "9:16" },
  { id: "tiktok_cover", name: "TikTok Cover", category: "social", width_px: 1080, height_px: 1920, aspect_ratio: "9:16" },
  { id: "youtube_thumbnail", name: "YouTube Thumbnail", category: "social", width_px: 1280, height_px: 720, aspect_ratio: "16:9" },
  { id: "youtube_banner", name: "YouTube Banner", category: "social", width_px: 2560, height_px: 1440, aspect_ratio: "16:9" },
  { id: "twitter_post", name: "Twitter/X Post", category: "social", width_px: 1600, height_px: 900, aspect_ratio: "16:9" },
  { id: "twitter_header", name: "Twitter/X Header", category: "social", width_px: 1500, height_px: 500, aspect_ratio: "3:1" },
  { id: "threads_post", name: "Threads Post", category: "social", width_px: 1080, height_px: 1080, aspect_ratio: "1:1" },
  { id: "google_business", name: "Google Business Post", category: "social", width_px: 1200, height_px: 900, aspect_ratio: "4:3" },
  { id: "whatsapp_status", name: "WhatsApp Status", category: "social", width_px: 1080, height_px: 1920, aspect_ratio: "9:16" },
  { id: "telegram", name: "Telegram Post", category: "social", width_px: 1280, height_px: 720, aspect_ratio: "16:9" },
  { id: "snapchat", name: "Snapchat Ad", category: "social", width_px: 1080, height_px: 1920, aspect_ratio: "9:16" },
  { id: "reddit_post", name: "Reddit Post", category: "social", width_px: 1200, height_px: 628, aspect_ratio: "1.91:1" },
];

// ─── Web (11) ────────────────────────────────────────────────────────────
const WEB: readonly DesignSize[] = [
  { id: "web_homepage_hero", name: "Homepage Hero", category: "web", width_px: 1920, height_px: 900, aspect_ratio: "2.13:1" },
  { id: "web_landing_hero", name: "Landing Hero", category: "web", width_px: 1920, height_px: 800, aspect_ratio: "2.4:1" },
  { id: "web_blog_hero", name: "Blog Hero", category: "web", width_px: 1600, height_px: 640, aspect_ratio: "2.5:1" },
  { id: "web_product_hero", name: "Product Hero", category: "web", width_px: 1600, height_px: 900, aspect_ratio: "16:9" },
  { id: "web_category_hero", name: "Category Hero", category: "web", width_px: 1600, height_px: 500, aspect_ratio: "3.2:1" },
  { id: "web_feature_banner", name: "Feature Banner", category: "web", width_px: 1200, height_px: 400, aspect_ratio: "3:1" },
  { id: "web_popup_banner", name: "Popup Banner", category: "web", width_px: 800, height_px: 600, aspect_ratio: "4:3" },
  { id: "web_sidebar_banner", name: "Sidebar Banner", category: "web", width_px: 300, height_px: 600, aspect_ratio: "1:2" },
  { id: "web_email_header", name: "Email Header", category: "web", width_px: 600, height_px: 200, aspect_ratio: "3:1" },
  { id: "web_cta_strip", name: "CTA Strip", category: "web", width_px: 1920, height_px: 200, aspect_ratio: "9.6:1" },
  { id: "web_footer_banner", name: "Footer Banner", category: "web", width_px: 1920, height_px: 300, aspect_ratio: "6.4:1" },
];

// ─── Print (14) · assumes 300 DPI ────────────────────────────────────────
const PRINT: readonly DesignSize[] = [
  { id: "print_business_card", name: "Business Card", category: "print", width_px: 1050, height_px: 600, aspect_ratio: "7:4", dpi: 300 },
  { id: "print_flyer_a5", name: "Flyer A5", category: "print", width_px: 1748, height_px: 2480, aspect_ratio: "A5", dpi: 300 },
  { id: "print_flyer_a6", name: "Flyer A6", category: "print", width_px: 1240, height_px: 1748, aspect_ratio: "A6", dpi: 300 },
  { id: "print_leaflet_dl", name: "Leaflet DL", category: "print", width_px: 1287, height_px: 2598, aspect_ratio: "DL", dpi: 300 },
  { id: "print_brochure_a4", name: "Brochure A4", category: "print", width_px: 2480, height_px: 3508, aspect_ratio: "A4", dpi: 300 },
  { id: "print_booklet_a5", name: "Booklet A5", category: "print", width_px: 1748, height_px: 2480, aspect_ratio: "A5", dpi: 300 },
  { id: "print_rollup_banner", name: "Roll-up Banner", category: "print", width_px: 9449, height_px: 23622, aspect_ratio: "1:2.5", dpi: 300, notes: "800 × 2000 mm" },
  { id: "print_poster_a4", name: "Poster A4", category: "print", width_px: 2480, height_px: 3508, aspect_ratio: "A4", dpi: 300 },
  { id: "print_poster_a3", name: "Poster A3", category: "print", width_px: 3508, height_px: 4961, aspect_ratio: "A3", dpi: 300 },
  { id: "print_poster_a2", name: "Poster A2", category: "print", width_px: 4961, height_px: 7016, aspect_ratio: "A2", dpi: 300 },
  { id: "print_poster_a1", name: "Poster A1", category: "print", width_px: 7016, height_px: 9933, aspect_ratio: "A1", dpi: 300 },
  { id: "print_poster_a0", name: "Poster A0", category: "print", width_px: 9933, height_px: 14043, aspect_ratio: "A0", dpi: 300 },
  { id: "print_signboard", name: "Signboard", category: "print", width_px: 4724, height_px: 2362, aspect_ratio: "2:1", dpi: 150, notes: "800 × 400 mm at 150 DPI" },
  { id: "print_exhibition_panel", name: "Exhibition Panel", category: "print", width_px: 5906, height_px: 8858, aspect_ratio: "2:3", dpi: 150, notes: "1000 × 1500 mm at 150 DPI" },
];

// ─── Documents (10) ──────────────────────────────────────────────────────
const DOCUMENTS: readonly DesignSize[] = [
  { id: "doc_pdf_a4", name: "PDF A4", category: "documents", width_px: 2480, height_px: 3508, aspect_ratio: "A4", dpi: 300 },
  { id: "doc_quotation_cover", name: "Quotation Cover", category: "documents", width_px: 2480, height_px: 3508, aspect_ratio: "A4", dpi: 300 },
  { id: "doc_proposal_cover", name: "Proposal Cover", category: "documents", width_px: 2480, height_px: 3508, aspect_ratio: "A4", dpi: 300 },
  { id: "doc_invoice", name: "Invoice", category: "documents", width_px: 2480, height_px: 3508, aspect_ratio: "A4", dpi: 300 },
  { id: "doc_report", name: "Report", category: "documents", width_px: 2480, height_px: 3508, aspect_ratio: "A4", dpi: 300 },
  { id: "doc_company_profile", name: "Company Profile", category: "documents", width_px: 2480, height_px: 3508, aspect_ratio: "A4", dpi: 300 },
  { id: "doc_sales_pack", name: "Sales Pack", category: "documents", width_px: 2480, height_px: 3508, aspect_ratio: "A4", dpi: 300 },
  { id: "doc_catalogue", name: "Catalogue", category: "documents", width_px: 2480, height_px: 3508, aspect_ratio: "A4", dpi: 300 },
  { id: "doc_installation_guide", name: "Installation Guide", category: "documents", width_px: 2480, height_px: 3508, aspect_ratio: "A4", dpi: 300 },
  { id: "doc_certificate", name: "Certificate", category: "documents", width_px: 3508, height_px: 2480, aspect_ratio: "A4 landscape", dpi: 300 },
];

// ─── Apps (8) ────────────────────────────────────────────────────────────
const APPS: readonly DesignSize[] = [
  { id: "app_splash_screen", name: "Splash Screen", category: "apps", width_px: 1284, height_px: 2778, aspect_ratio: "iPhone 15 Pro Max" },
  { id: "app_login_background", name: "Login Background", category: "apps", width_px: 1284, height_px: 2778, aspect_ratio: "iPhone 15 Pro Max" },
  { id: "app_dashboard_hero", name: "Dashboard Hero", category: "apps", width_px: 1920, height_px: 480, aspect_ratio: "4:1" },
  { id: "app_wallpaper", name: "Wallpaper", category: "apps", width_px: 2880, height_px: 1800, aspect_ratio: "16:10" },
  { id: "app_chat_background", name: "Chat Background", category: "apps", width_px: 1284, height_px: 2778, aspect_ratio: "iPhone 15 Pro Max" },
  { id: "app_mobile_hero", name: "Mobile Hero", category: "apps", width_px: 750, height_px: 900, aspect_ratio: "5:6" },
  { id: "app_tablet_hero", name: "Tablet Hero", category: "apps", width_px: 2048, height_px: 1536, aspect_ratio: "4:3" },
  { id: "app_desktop_hero", name: "Desktop Hero", category: "apps", width_px: 1920, height_px: 1080, aspect_ratio: "16:9" },
];

const ALL_SIZES: readonly DesignSize[] = [...SOCIAL, ...WEB, ...PRINT, ...DOCUMENTS, ...APPS];
const SIZE_INDEX = new Map<string, DesignSize>(ALL_SIZES.map((s) => [s.id, s]));

// ─── Public API ──────────────────────────────────────────────────────────

export function listDesignSizes(): readonly DesignSize[] { return ALL_SIZES; }
export function listByCategory(category: DesignSizeCategory): readonly DesignSize[] { return ALL_SIZES.filter((s) => s.category === category); }
export function getDesignSize(id: string): DesignSize | undefined { return SIZE_INDEX.get(id); }
export function countDesignSizes(): number { return ALL_SIZES.length; }
export function listCategories(): readonly DesignSizeCategory[] { return ["social", "web", "print", "documents", "apps"]; }
