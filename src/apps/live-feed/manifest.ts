// Live Feed App — the first manifest-driven Studio App.
//
// Reference implementation showing the pattern:
//   - Declares slot (proof / gallery / cta)
//   - Registers render + editor components
//   - Uses the Runtime's storage helper — no direct DB access
//
// JSX-carrying components live in ./render.tsx + ./editor.tsx so this
// stays a pure .ts data file.

import type { StudioAppManifest } from "@/platform/studio/manifest";
import { LiveFeedAppRender } from "./render";
import { LiveFeedAppEditor } from "./editor";

export const liveFeedApp: StudioAppManifest = {
  slug: "live-feed",
  name: "Live Feed",
  tagline: "Your website updates itself as you finish jobs.",
  description:
    "Renders a fresh magazine-style feed of your recent work with SEO-optimised permalinks and auto-published case studies.",
  iconName: "Rss",
  category: "content",
  slots: ["proof", "gallery", "cta"],
  tier: "free",
  version: "1.0.0",
  render: LiveFeedAppRender,
  editor: LiveFeedAppEditor,
  async install(ctx) {
    const existing = await ctx.storage.get("default");
    if (existing) return;
    await ctx.storage.put("default", {
      heading: "Recent work",
      subhead: "Fresh jobs, straight from the site.",
      limit: 6,
      showFacetChips: true
    });
  },
  async uninstall(ctx) {
    await ctx.storage.del("default");
  }
};
