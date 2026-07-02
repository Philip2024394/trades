// App: Meet the Team.
//
// First manifest-driven App on the platform. Reference implementation
// for every future App. Reuses the existing `TeamGrid` profile
// component; Studio owns appearance only, content lives in the
// existing dashboard editor at /trade-off/edit/{slug}/team.

import type { AppManifest } from "@/platform/manifest/types";

export const meetTheTeamManifest: AppManifest = {
  manifestVersion: 1,

  slug: "meet-the-team",
  name: "Meet the Team",
  tagline: "4-card team grid — boss pinned, others auto-rotate.",
  description:
    "Show your yard staff, counter team or crew on your public profile. Boss (or owner) is pinned in slot 1 with a highlighted card and never rotates. Slots 2-4 auto-shuffle through the rest of the roster so every team member gets airtime. Each card can show profile photo, name, position, skills, years of experience, and — optionally — a direct-dial number as a click-to-call link.",
  icon: "👥",
  category: "business",
  version: "1.0.0",

  publisher: {
    name: "Xrated Trades",
    verified: true
  },

  compatibility: {
    industries: ["*"],
    pages: ["home", "about"],
    createsPages: []
  },

  requirements: {
    plan: "free",
    dependencies: [],
    conflicts: [],
    capabilities: ["storage"],
    permissions: ["read:listing"]
  },

  studio: {
    sections: [
      {
        id: "team-grid",
        name: "Team Grid",
        library: "team",
        description:
          "Boss pinned, others auto-rotate. Appearance only — team roster lives in the dedicated editor.",
        moduleImport: "./sections/team-grid"
      }
    ],
    slotHints: ["home.body"],
    contentEditor: {
      route: "/trade-off/edit/{slug}/team",
      title: "Manage team members",
      surface: "slide-over"
    }
  },

  navigation: [],

  ai: {
    keywords: [
      "team",
      "staff",
      "employees",
      "crew",
      "yard team",
      "counter team",
      "meet",
      "who we are"
    ],
    userStories: [
      "As a merchant, I want customers to recognise my staff so they feel welcome at the counter.",
      "As a builder, I want to show off my crew so customers trust the size of the operation."
    ],
    recommendedFor: [
      "merchants with counter staff",
      "yards with a warehouse team",
      "builders with crews of 3+",
      "showrooms with sales advisors"
    ]
  },

  appStore: {
    screenshots: [],
    benefits: [
      "4 team members on-screen at once with seamless rotation across the full roster",
      "Boss card is pinned so the face of the business is always visible",
      "Each card shows photo + name + role + skills + years + optional direct dial"
    ],
    priceLabel: "Free"
  }
};
