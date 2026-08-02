// Staircase trade config — the JSON schema per Master Trade Template §6.
// Cluster A (visual_sell). Consumed by the NEX Trade App at
// /apps/staircase.

import type { TradeConfig } from "../_types";

export const staircaseConfig: TradeConfig = {
  trade_slug: "staircase",
  cluster: "visual_sell",

  ai_panel: {
    headline: "I'm Nex. I know staircases.",
    subhead: "Design ideas, timber choice, regs, prices — I've got you."
  },

  hero_prompt: "What are you working on today?",

  // 6-tile quick-actions grid · Philip 2026-08-02.
  // Reduced from 10 → 6 to focus on the surfaces the Nex knowledge foundation
  // actually powers today. Order per Philip's directive: Trade Centre first,
  // Nex Chat last. Removed: Plan & Calculate · Cost Estimator · Materials ·
  // Components · Installation Guide. Renamed: Staircase Library → Stairs
  // Library · Building Codes → Stair Regulations · AI Assistant → Nex Chat.
  // NEW: Stair Terminology (surfaces the Terminology Brain content).
  quick_actions: [
    // Trade Centre · marketplace positioning (not directory).
    { label: "Trade Centre",        target_state: "compare", canvas_variant: "suppliers",
      href: "/nex-app/centre",
      chat_intro: "Browse verified trade professionals, staircase companies and premium products in the Trade Centre." },
    // Stairs Library · full-screen swipe gallery.
    { label: "Stairs Library",      target_state: "discover", canvas_variant: "gallery",
      href: "/nex-app/staircase-library",
      chat_intro: "Design ideas to get you thinking — anything catching your eye?" },
    // Was "Building Codes" · staircase-specific regulation reference
    // (regional layer applies · UK Part K, IRC, NCC etc.).
    { label: "Stair Regulations",   target_state: "discover", canvas_variant: "regulations",
      chat_intro: "Rise, going, handrail height, headroom — tell me your country and project type and I'll walk you through the relevant regulations." },
    // NEW · surfaces the Terminology Brain content (stair · stairs · staircase
    // · flight · shell · stairwell · balustrade etymology + how different
    // tradespeople speak).
    { label: "Stair Terminology",   target_state: "discover",
      chat_intro: "Ask me what a term means — dog-leg, monkey volute, base rail, stringer, balustrade — and I'll explain where the word comes from and what it does." },
    { label: "3D Design",           target_state: "configure", canvas_variant: "visualiser",
      chat_intro: "Let's shape it up in 3D — what style are you thinking of?" },
    // Was "AI Assistant" · rebranded as the Nex Chat entry point aligned
    // with the Trade Centre / merchant chat vocabulary.
    { label: "Nex Chat",            target_state: "discover",
      chat_intro: "Ask me anything about staircases — designs, regulations, timber, materials, installation, or your project." }
  ],

  featured_projects_title: "Recent staircases",
  products_title: "Range",
  reviews_title: "What clients say",

  regulatory_hooks: [
    {
      field: "rise_mm",
      operator: ">",
      value: 220,
      message: "That rise breaches Approved Doc K limits for private stairs (220mm max). Would you like me to suggest compliant options?"
    }
  ],

  compliance_module_slug: "regulations",
  defect_module_slug: "defects",
  materials_module_slug: "materials",
  workflow_module_slug: "workflow",

  placeholder_content: {
    merchant: {
      business_name: "Nex Staircases",
      tagline: "Custom staircases across the North",
      location: "Manchester + 30-mile radius",
      established_year: 2020,
      service_area_miles: 30,
      response_promise: "Replies within 4h",
      accreditations: ["BWF Stair Scheme", "FMB Member"],
      phone: "+44 161 000 0000",
      email: "hello@nex-staircases.example",
      whatsapp: "+44 7700 900000",
      social: {
        instagram: "https://instagram.com/example"
      }
    },
    featured_projects: [
      {
        id: "proj_oak_cut_string_didsbury",
        title: "Cut-string oak flight",
        location: "Didsbury, Manchester",
        trade_type: "cut string · oak · glass balustrade",
        after_image_url: "/images/staircase-samples/cut-string-oak.jpg"
      },
      {
        id: "proj_helical_walnut_altrincham",
        title: "Helical walnut with iron",
        location: "Altrincham",
        trade_type: "helical · walnut · wrought iron",
        after_image_url: "/images/staircase-samples/helical-walnut.jpg"
      },
      {
        id: "proj_loft_spacesaver_stockport",
        title: "Loft space-saver — compliant",
        location: "Stockport",
        trade_type: "alternating tread · pine · loft only",
        after_image_url: "/images/staircase-samples/spacesaver-loft.jpg"
      }
    ]
  }
};
