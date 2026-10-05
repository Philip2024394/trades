"use client";

// src/app/nex-native/dev/standard-experience-preview/_fixture-client.tsx
//
// Phase 2A.0 greenfield theme preview · dev fixture client.
//
// Mounts <StandardExperience> with a selected theme package + Maria
// Santos / Footwear Designer fixture peer. Supports toggling the
// wallpaper on/off AND switching themes so Ocean vs Coffee can be
// compared under identical fixture data.

import * as React from "react";
import { createEngine } from "../../chat-standard/_engine/theme-engine";
import { OCEAN_PACKAGE } from "../../chat-standard/packages/ocean.package";
import { COFFEE_PACKAGE } from "../../chat-standard/packages/coffee.package";
import type { ThemePackage } from "../../chat-standard/_engine/types";
import {
  StandardExperience,
  type StandardExperienceSeedMessage,
} from "../../chat-standard/_standard-experience";

const THEME_PACKAGES: Record<string, ThemePackage> = {
  ocean: OCEAN_PACKAGE,
  coffee: COFFEE_PACKAGE,
};

const PEER = {
  accountId: "fx-maria",
  displayName: "Maria Santos",
  tagline: "Footwear Designer · Lisbon",
  avatarUrl: null,
};

const SEED_MESSAGES: StandardExperienceSeedMessage[] = [
  {
    id: "s1",
    mine: false,
    body: "hey! just finished the sketches for the new sandal line 🌊",
  },
  { id: "s2", mine: true, body: "ooh — show me!" },
  { id: "s3", mine: false, body: "sending samples now, tell me what you think" },
  {
    id: "s4",
    mine: true,
    body: "love the colour palette — very underwater",
  },
];

const PRODUCTS = [
  {
    id: "p1",
    name: "Driftwood Sandal",
    tagline: "Hand-cut leather · ocean-ready",
    price: "€89",
    imageUrl: null,
  },
  {
    id: "p2",
    name: "Shell Mule",
    tagline: "Mother-of-pearl inlay",
    price: "€120",
    imageUrl: null,
  },
  {
    id: "p3",
    name: "Reef Walker",
    tagline: "Quick-dry neoprene",
    price: "€65",
    imageUrl: null,
  },
  {
    id: "p4",
    name: "Pearl Diver",
    tagline: "Minimalist leather slip-on",
    price: "€105",
    imageUrl: null,
  },
];

export function OceanPilotBody({
  wallpaperFallback,
  themeId = "ocean",
}: {
  wallpaperFallback: "theme-gradient" | "none";
  themeId?: string;
}): React.JSX.Element {
  const pkg = THEME_PACKAGES[themeId] ?? OCEAN_PACKAGE;
  const engine = React.useMemo(() => createEngine(pkg), [pkg]);
  const [localMessages, setLocalMessages] = React.useState<
    StandardExperienceSeedMessage[]
  >([]);

  const handleSend = React.useCallback((body: string) => {
    setLocalMessages((prev) => [
      ...prev,
      { id: `l-${Date.now()}-${prev.length}`, mine: true, body },
    ]);
  }, []);

  return (
    <StandardExperience
      engine={engine}
      peer={PEER}
      seedMessages={SEED_MESSAGES}
      products={PRODUCTS}
      onSendLocalMessage={handleSend}
      localMessages={localMessages}
      wallpaperFallback={wallpaperFallback}
    />
  );
}
