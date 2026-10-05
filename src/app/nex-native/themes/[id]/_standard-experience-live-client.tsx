"use client";

// src/app/nex-native/themes/[id]/_standard-experience-live-client.tsx
//
// Live-chat surface for Standard-Experience-backed themes.
//
// Mounts the full Standard Experience chrome (header icons + bubbles
// + composer + shop sheet + call actions + + menu + ambient layer)
// for the given world, filling the viewport so the user sees exactly
// what they will see as the live chat.
//
// Rule (sealed 2026-10-05): visiting `/nex-native/themes/<world-id>`
// where `world-id` is a Standard-Experience world opens the live chat
// with that theme applied. Current scope: Botanical / Midnight /
// French (and Ocean / Coffee which share the same engine).
//
// No DB writes · peer and products are fixture data for the preview.
// Real session wiring is Phase 2A.1 work.

import * as React from "react";
import { createEngine } from "../../chat-standard/_engine/theme-engine";
import type { ThemePackage } from "../../chat-standard/_engine/types";
import {
  StandardExperience,
  type StandardExperienceSeedMessage,
} from "../../chat-standard/_standard-experience";

const PEER = {
  accountId: "fx-maria",
  displayName: "Maria Santos",
  tagline: "Footwear Designer · Lisbon",
  avatarUrl: null,
  isOnline: true,
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

export function StandardExperienceLiveClient({
  pkg,
}: {
  pkg: ThemePackage;
}): React.JSX.Element {
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

  // The live-chat surface is a true full-viewport mount · no phone-
  // frame border, no header strip, no chip row. The Standard
  // Experience owns the entire viewport so what the user sees IS the
  // live theme.
  return (
    <div
      data-nex-standard-experience-live
      style={{
        position: "fixed",
        inset: 0,
        width: "100dvw",
        height: "100dvh",
        overflow: "hidden",
        background: "#000",
      }}
    >
      <StandardExperience
        engine={engine}
        peer={PEER}
        seedMessages={SEED_MESSAGES}
        products={PRODUCTS}
        onSendLocalMessage={handleSend}
        localMessages={localMessages}
        wallpaperFallback="theme-gradient"
      />
    </div>
  );
}
