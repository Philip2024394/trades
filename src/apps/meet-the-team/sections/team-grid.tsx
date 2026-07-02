"use client";

// App section: meet-the-team / team-grid.
//
// Registers `app.meet-the-team.team-grid` via defineAppSection.
// Wraps the existing TeamGrid profile component; appearance-only
// editableFields, data comes from the storefront hydrator via
// `appData.members`.

import type { HammerexTradeOffListing } from "@/lib/supabase";
import { TeamGrid } from "@/components/xrated/profile/TeamGrid";
import { defineAppSection } from "@/platform/apps/_shared/defineAppSection";
import { meetTheTeamManifest } from "../manifest";

type TeamMember = NonNullable<HammerexTradeOffListing["team_members"]>[number];

type TeamGridConfig = {
  heading: string;
  helperCopy: string;
  headingColor: string;
  helperColor: string;
  background: string;
  bossAccent: string;
  cardRadius: number;
  rotateIntervalMs: number;
  showDirectDial: boolean;
};

type TeamGridData = { members: TeamMember[] };

function TeamGridInner({
  config,
  data,
  appData
}: {
  config: TeamGridConfig;
  data: { merchantId: string; slug: string; merchantName: string };
  appData: TeamGridData;
  tokens: Record<string, unknown>;
  mode: string;
  instanceId: string;
}) {
  const members = appData.members ?? [];
  if (members.length < 2) return null;

  const listing = {
    id: data.merchantId,
    slug: data.slug,
    display_name: data.merchantName,
    team_members: members
  } as unknown as HammerexTradeOffListing;

  return (
    <section
      style={{
        background: config.background,
        borderRadius: config.cardRadius,
        padding: "8px 0"
      }}
      data-app-section="meet-the-team.team-grid"
    >
      {config.heading && (
        <header style={{ padding: "0 24px 4px" }}>
          <h2
            style={{
              color: config.headingColor,
              fontSize: 22,
              fontWeight: 800,
              margin: 0
            }}
          >
            {config.heading}
          </h2>
          {config.helperCopy && (
            <p
              style={{
                color: config.helperColor,
                fontSize: 12,
                margin: "4px 0 0"
              }}
            >
              {config.helperCopy}
            </p>
          )}
        </header>
      )}
      <TeamGrid listing={listing} />
    </section>
  );
}

defineAppSection<TeamGridConfig, TeamGridData>({
  manifest: meetTheTeamManifest,
  localId: "team-grid",
  name: "Team Grid",
  library: "team",
  description:
    "Boss pinned, others auto-rotate. Appearance only — team roster lives in the dedicated editor.",
  thumbnail: "/studio/thumbnails/team-grid.png",
  bestForVerticals: [
    "building-merchant",
    "builders-supplies",
    "tool-hire",
    "landscaper",
    "roofer",
    "carpenter",
    "plasterer"
  ],
  animations: ["none", "fade", "cross-fade"],
  editableFields: [
    {
      key: "heading",
      label: "Heading",
      type: { kind: "text", maxLength: 64 },
      default: "Meet the team",
      priority: "text",
      aiPromptable: true,
      group: "Copy"
    },
    {
      key: "helperCopy",
      label: "Helper copy",
      type: { kind: "text", maxLength: 120 },
      default: "The foundation of our daily operations.",
      priority: "text",
      aiPromptable: true,
      group: "Copy"
    },
    {
      key: "headingColor",
      label: "Heading colour",
      type: { kind: "color", brandBindable: true },
      default: "#0A0A0A",
      bindsTo: "color.ink",
      group: "Colour"
    },
    {
      key: "helperColor",
      label: "Helper text colour",
      type: { kind: "color", brandBindable: true },
      default: "#737373",
      bindsTo: "color.muted",
      group: "Colour"
    },
    {
      key: "background",
      label: "Background",
      type: { kind: "color", brandBindable: true },
      default: "#FFFFFF",
      bindsTo: "color.surface",
      group: "Colour"
    },
    {
      key: "bossAccent",
      label: "Boss card accent",
      type: { kind: "color", brandBindable: true },
      default: "#FFB300",
      bindsTo: "color.primary",
      group: "Colour"
    },
    {
      key: "cardRadius",
      label: "Card corner radius",
      type: { kind: "number", min: 0, max: 32, step: 2, unit: "px" },
      default: 16,
      bindsTo: "radius.md",
      group: "Shape"
    },
    {
      key: "rotateIntervalMs",
      label: "Rotate interval",
      type: { kind: "number", min: 800, max: 5000, step: 100, unit: "ms" },
      default: 1700,
      group: "Animation"
    },
    {
      key: "showDirectDial",
      label: "Show direct-dial numbers",
      type: { kind: "boolean" },
      default: true,
      group: "Content"
    }
  ],
  defaultConfig: () => ({
    heading: "Meet the team",
    helperCopy: "The foundation of our daily operations.",
    headingColor: "#0A0A0A",
    helperColor: "#737373",
    background: "#FFFFFF",
    bossAccent: "#FFB300",
    cardRadius: 16,
    rotateIntervalMs: 1700,
    showDirectDial: true
  }),
  inner: TeamGridInner
});
