// General Brain — the default conversational surface used as the
// AI fallback in the Intent Router. Uses the same AppShell surface as
// specialist Brains but with a neutral quick-action set focused on
// general assistance rather than trade-specific tasks.

import type { TradeConfig } from "../_types";

export const generalConfig: TradeConfig = {
  trade_slug: "general",
  cluster: "trust_sell",   // trust-first module order fits a general-knowledge Brain best

  ai_panel: {
    headline: "I'm Nex. How can I help?",
    subhead:  "Ask me anything — I'll pick the right area of knowledge for your question."
  },

  hero_prompt: "What would you like help with?",

  quick_actions: [
    { label: "Ask a question",   target_state: "discover", chat_intro: "What's on your mind? I'll do my best to answer." },
    { label: "Write something",  target_state: "discover", chat_intro: "Sure — what would you like me to write?" },
    { label: "Translate",        target_state: "discover", chat_intro: "Paste the text and tell me the target language." },
    { label: "Explain",          target_state: "discover", chat_intro: "What would you like me to explain?" },
    { label: "Compare options",  target_state: "compare",  chat_intro: "What are you comparing? Give me the options and what matters most." },
    { label: "Plan something",   target_state: "discover", chat_intro: "What are you planning? Tell me the goal and any constraints." }
  ],

  featured_projects_title: "Popular topics",
  products_title:          "Services",
  reviews_title:           "What people say",

  placeholder_content: {
    merchant: {
      business_name: "Nex",
      tagline:       "One assistant. Endless possibilities.",
      location:      "Available everywhere",
      response_promise: "Instant response"
    },
    featured_projects: []
  }
};
