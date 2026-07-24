// Plumber trade config — minimal stub for the inheritance test.
// Proves the same route + shell renders for a different trade with
// zero design changes, only config swap.
//
// Cluster B (trust_sell) — plumbers sell on response + credentials.

import type { TradeConfig } from "../_types";

export const plumberConfig: TradeConfig = {
  trade_slug: "plumber",
  cluster: "trust_sell",

  ai_panel: {
    headline: "I'm Nex. I know plumbing.",
    subhead: "Emergencies, boiler service, leak diagnosis — just ask."
  },

  hero_prompt: "What's the problem?",

  quick_actions: [
    {
      label: "Emergency call-out",
      target_state: "book",
      chat_intro: "Emergency? Tell me the postcode and I'll get the fastest available slot."
    },
    {
      label: "Boiler service",
      target_state: "book",
      chat_intro: "Regular boiler service — what make and model, and when suits you?"
    },
    {
      label: "Leak diagnosis",
      target_state: "discover",
      canvas_variant: "gallery",
      chat_intro: "Where's the leak and when did it start? I can help narrow the cause."
    },
    {
      label: "Cost & pricing",
      target_state: "price",
      chat_intro: "Plumbing pricing depends on the job — walk me through what you need and I'll explain the tiers."
    }
  ],

  featured_projects_title: "Recent jobs",
  products_title: "Services",
  reviews_title: "What clients say",

  placeholder_content: {
    merchant: {
      business_name: "Nex Plumbing",
      tagline: "Same-day response across Greater Manchester",
      location: "Manchester + 15-mile radius",
      established_year: 2018,
      service_area_miles: 15,
      response_promise: "Same-day response for emergencies",
      accreditations: ["Gas Safe #123456", "CIPHE Member"],
      phone: "+44 161 000 0001",
      email: "hello@nex-plumbing.example"
    },
    featured_projects: []
  }
};
