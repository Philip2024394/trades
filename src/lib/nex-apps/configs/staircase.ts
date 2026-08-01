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

  // 10-tile quick-actions grid per Master Trade Template v1.1 §3.4 + canonical Staircase home mockup.
  // Tile order follows the mockup: row 1 (5 tiles), row 2 (5 tiles).
  quick_actions: [
    { label: "3D Design",           target_state: "configure", canvas_variant: "visualiser",
      chat_intro: "Let's shape it up in 3D — what style are you thinking of?" },
    { label: "Plan & Calculate",    target_state: "configure",
      chat_intro: "Rise, going, headroom — tell me the floor-to-floor height and I'll walk you through the numbers." },
    { label: "Cost Estimator",      target_state: "price",
      chat_intro: "Staircase pricing depends on a few things — let me walk you through the tiers." },
    { label: "Materials",           target_state: "compare", canvas_variant: "timbers",
      chat_intro: "Here are the timbers we work with most — tap any to shortlist, or ask me which suits your project." },
    { label: "Components",          target_state: "compare", canvas_variant: "components",
      chat_intro: "Stringers, treads, spindles, balustrades — what part are you looking at?" },
    { label: "Building Codes",      target_state: "discover", canvas_variant: "regulations",
      chat_intro: "Approved Doc K covers stair regs — I can pull the sections most relevant to your project." },
    { label: "Installation Guide",  target_state: "discover", canvas_variant: "installation",
      chat_intro: "Step-by-step from measurement to first-fit — where do you want to start?" },
    // Philip 2026-08-02 · repurposed · was "Inspiration" · now full-screen swipe gallery.
    { label: "Staircase Library",   target_state: "discover", canvas_variant: "gallery",
      href: "/nex-app/staircase-library",
      chat_intro: "Design ideas to get you thinking — anything catching your eye?" },
    { label: "AI Assistant",        target_state: "discover",
      chat_intro: "Ask me anything about staircases — designs, regs, timber, prices, or your project." },
    // Philip 2026-08-02 · repurposed · was "Suppliers" · now points at the existing Pinterest-style Trade Centre.
    { label: "Trade Centre",        target_state: "compare", canvas_variant: "suppliers",
      href: "/nex-app/centre",
      chat_intro: "Browse inspiration, products, companies, projects and professionals in the Trade Centre." }
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
