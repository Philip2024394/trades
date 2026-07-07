"use client";

// Add-on wrapper — AI Visualiser.
//
// Wraps <AiVisualiserSquare> (default) or Landscape/Portrait so
// merchants can drop the tile into any Studio layout. Content — which
// leaves the merchant sells + which plan they're on — lives in the
// dedicated /site-office/apps/ai-visualiser editor; Studio owns the
// tile's APPEARANCE (heading noun, background image, size variant).

import { useState } from "react";
import {
  AiVisualiserSquare,
  AiVisualiserLandscape,
  AiVisualiserPortrait,
  AiVisualiserFlow
} from "@/apps/ai-visualiser";
import { defineAddonSection } from "./_adapter";

type Config = {
  size: "square" | "landscape" | "portrait";
  headlineNoun: string;
  previewImageUrl: string;
};

type AiVisualiserAddonData = {
  merchantId: string;
  merchantDisplayName: string;
  scope: Array<{ slug: string; display_name: string; synonyms: string[] }>;
  primaryLeafSlug: string | null;
} | null;

function AiVisualiserInner({
  config,
  addonData,
  mode
}: {
  config: Config;
  data: { slug: string; merchantName: string };
  addonData: AiVisualiserAddonData;
  tokens: Record<string, unknown>;
  mode: string;
}) {
  const [open, setOpen] = useState(false);

  if (!addonData) return null;
  const preview = mode !== "published";
  const commonProps = {
    merchantId: addonData.merchantId,
    scope: addonData.scope,
    headlineNoun: config.headlineNoun || undefined,
    previewImageUrl: config.previewImageUrl || undefined,
    preview,
    onLaunch: () => setOpen(true)
  };

  const tile =
    config.size === "landscape" ? (
      <AiVisualiserLandscape {...commonProps} />
    ) : config.size === "portrait" ? (
      <AiVisualiserPortrait {...commonProps} />
    ) : (
      <AiVisualiserSquare {...commonProps} />
    );

  return (
    <div data-addon-section="ai_visualiser">
      {tile}
      {open ? (
        <AiVisualiserFlow
          merchantId={addonData.merchantId}
          merchantDisplayName={addonData.merchantDisplayName}
          primaryLeafSlug={addonData.primaryLeafSlug || undefined}
          source="merchant-page"
          onClose={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}

defineAddonSection<Config, AiVisualiserAddonData>({
  addonSlug: "ai_visualiser",
  library: "cta",
  name: "AI Visualiser",
  description:
    "Homeowners see their renovation on their own space. Every render captures a name / email / WhatsApp / postcode lead — straight to your inbox.",
  thumbnail: "/studio/thumbnails/ai-visualiser.png",
  bestForVerticals: [
    "kitchen-fitter",
    "bathroom-fitter",
    "staircase-manufacturer",
    "door-supplier",
    "window-installer",
    "flooring-installer",
    "landscaper",
    "driveway-installer",
    "fencer",
    "roofer",
    "decorator",
    "kitchen-showroom",
    "bathroom-showroom"
  ],
  animations: ["none", "fade"],
  editableFields: [
    {
      key: "size",
      label: "Tile size",
      type: {
        kind: "select",
        options: [
          { value: "square", label: "Square (grid tile)" },
          { value: "landscape", label: "Landscape (hero slot)" },
          { value: "portrait", label: "Portrait (sidebar)" }
        ]
      },
      default: "square",
      group: "Layout"
    },
    {
      key: "headlineNoun",
      label: "Headline noun",
      type: { kind: "text", maxLength: 40 },
      default: "",
      description:
        "e.g. 'kitchen', 'staircase'. Leave blank to auto-fill from your catalogue scope.",
      priority: "text",
      aiPromptable: true,
      group: "Copy"
    },
    {
      key: "previewImageUrl",
      label: "Preview background",
      type: {
        kind: "image",
        aspectRatio: "1/1",
        recommendedWidthPx: 1200
      },
      default: "",
      description:
        "A real photo of a finished install works best. Leave blank for the default gradient.",
      priority: "image",
      group: "Image"
    }
  ],
  defaultConfig: () => ({
    size: "square",
    headlineNoun: "",
    previewImageUrl: ""
  }),
  inner: AiVisualiserInner
});
