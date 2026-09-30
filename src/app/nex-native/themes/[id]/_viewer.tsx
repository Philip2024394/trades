"use client";

// src/app/nex-native/themes/[id]/_viewer.tsx
//
// Bridge 97g · Client viewer for the dynamic theme preview.
// -------------------------------------------------------------------
// Mounts PortraitBloomShell (or the resolved chrome per layout_style
// once Phase 3 lands) with mock messages so the theme's accent,
// wallpaper, animation overlay, and bubble preset all render live.
//
// Every server-side action is a no-op stub — this page is view-only.
// A pill banner in the corner reminds the visitor it's preview mode.

import * as React from "react";
import Link from "next/link";
import {
  PortraitBloomShell,
  type PortraitBloomMessage,
} from "@/app/nex-native/chat/_portrait-bloom-shell";
import type { NexChatThemeLayoutStyle } from "@/lib/nex-native/chat-theme-service";

interface ThemeViewerClientProps {
  themeId: string;
  themeName: string;
  accent: string;
  bubbleRim: string;
  composerRim: string;
  wallpaperUrl: string | null;
  wallpaperConfig:
    | {
        moonGlow?: { x: string; y: string; size: number; color?: string };
        particleDrift?: { color: string; count?: number; direction?: "up"; size?: number; speedSeconds?: number };
        sparkle?: { color: string; count?: number; size?: number; twinkleSeconds?: number };
        bubbleStyle?: { preset: "classic" | "pill" | "square" | "outlined" | "gradient" };
      }
    | null;
  layoutStyle: NexChatThemeLayoutStyle;
  /** Bridge 97g · sample-message timestamps computed on the server
   *  so SSR + client hydration see identical strings. Fixes a
   *  hydration mismatch caused by Date.now() drift. */
  sentAts: {
    m1: string;
    m2: string;
    m3: string;
    m4: string;
    m5: string;
    readEarly: string;
    readMid: string;
    readLate: string;
  };
  /** ?mode=menu flips the shop slider into venue mode · cutlery icon
   *  in the header + "Menu" eyebrow inside the modal. */
  isVenueMode: boolean;
  /** Bridge ThemeEmoji-B · this theme's emoji set from
   *  nex_theme_emoji. Threaded through PortraitBloomShell into
   *  PeerComposer's EmojiModal so the picker shows image tiles when
   *  the theme has a custom set. */
  themeEmojis?: { slug: string; imageUrl: string; label: string }[];
}

// Mock catalogue for the preview shop slider · 3 products + 2 menu
// items. Both kinds always appear in the array; PortraitBloomShell's
// ShopGridModal renders them uniformly, only the header icon +
// eyebrow copy toggle based on isVenue.
const MOCK_PREVIEW_SHOP = {
  name: "Maria's Studio",
  href: null,
  products: [
    {
      id: "preview-p1",
      kind: "product" as const,
      name: "Golden Hour Print · A3",
      description: "Signed archival print from the pier series. Cotton rag, matte.",
      price_pence: 42500000,
      currency: "IDR",
      image_url: null,
      tags: ["print", "photography", "limited"],
      stock_status: "in_stock",
    },
    {
      id: "preview-p2",
      kind: "product" as const,
      name: "Studio Session · 2hr",
      description: "Portrait session with light retouching. Digital + 6 prints included.",
      price_pence: 185000000,
      currency: "IDR",
      image_url: null,
      tags: ["service", "portrait"],
      stock_status: "in_stock",
    },
    {
      id: "preview-p3",
      kind: "product" as const,
      name: "Handmade Photo Book",
      description: "60-page linen-bound book of the sunset pier series. Limited to 20.",
      price_pence: 67500000,
      currency: "IDR",
      image_url: null,
      tags: ["book", "limited"],
      stock_status: "low_stock",
    },
    {
      id: "preview-m1",
      kind: "menu_item" as const,
      name: "Oat Latte",
      description: "Slow-poured. Cinnamon dusted on request.",
      price_pence: 3500000,
      currency: "IDR",
      image_url: null,
      tags: ["drink", "coffee"],
      stock_status: "in_stock",
    },
    {
      id: "preview-m2",
      kind: "menu_item" as const,
      name: "Nasi Goreng Spesial",
      description: "House recipe with fried egg + kerupuk. Vegetarian option.",
      price_pence: 4500000,
      currency: "IDR",
      image_url: null,
      tags: ["food", "signature"],
      stock_status: "in_stock",
    },
  ],
  context: {
    shop_id: "preview-shop",
    shop_slug: null,
    shop_owner_account_id: "preview-owner",
    shop_display_name: "Maria's Studio",
  },
};

// Same portrait Theme 1 uses so previews across every theme share
// one "peer" identity — makes them easy to compare side-by-side.
const MARIA_PORTRAIT =
  "https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-theme-hero/maria-santos-hero-1790481483761.png";

export default function ThemeViewerClient(
  props: ThemeViewerClientProps,
): React.JSX.Element {
  // All timestamps come from the SERVER props · no Date.now() here,
  // no hydration mismatch. Bridge 97g.
  const s = props.sentAts;
  const messages: PortraitBloomMessage[] = React.useMemo(
    () => [
      {
        id: "sample-1",
        body: "Sunset shoot went perfectly ✨\nWant to see the proofs?",
        sent_at: s.m1,
        read_at: s.readEarly,
        mine: false,
      },
      {
        id: "sample-2",
        body: "Yes please. Send whenever.",
        sent_at: s.m2,
        read_at: s.readEarly,
        mine: true,
        reactions: { "🔥": ["fake"] },
      },
      {
        id: "sample-3",
        body: "Sending the top 10 now.\nRoll #2 is my favourite.",
        sent_at: s.m3,
        read_at: s.readMid,
        mine: false,
      },
      {
        id: "sample-4",
        body: "The one with the golden hour light?\nLegendary.",
        sent_at: s.m4,
        read_at: s.readLate,
        mine: true,
      },
      {
        id: "sample-5",
        body: "Grab you a coffee on the way?",
        sent_at: s.m5,
        read_at: null,
        mine: false,
      },
    ],
    [s],
  );

  // Preview mode: every server action is a no-op stub. PortraitBloom
  // still renders the composer + long-press affordances so a designer
  // can see the interaction chrome, but nothing hits the DB.
  const noopAction = async () => {
    /* preview only · no writes */
  };

  // Bubbles is the world-class chrome and works with every theme's
  // wallpaperConfig (halo · drift · sparkle · bubbleStyle). Terminal
  // + other non-bubbles layouts have their own sealed preview page
  // for now · Phase 3 lifts them into runtime chromes.
  const effectiveLayout = props.layoutStyle === "bubbles" ? "bubbles" : "bubbles";

  return (
    <>
      {/* Founder direction 2026-10-01 · the "← Gallery", "Preview ·
          <theme>" and "Shop / Menu mode" pill cluster that used to
          live at the top-left has been removed on every theme so the
          preview reads as an untouched chat window. Header buttons
          are now identical to the real peer-chat header · same
          right-cluster (Home / Shop / Menu / Cart) on every theme.
          To flip the shop slider between Shop and Menu presentation
          use ?mode=menu on the URL · no on-screen toggle. */}

      <PortraitBloomShell
        scope="theme-preview"
        /* Founder direction 2026-10-01 · the peer display name in the
           theme deep-dive uses the THEME's name (Joker · Pink Dream ·
           Night Sky etc.) so each preview reads as its own persona.
           Falls back to "Maria" for older themes without a persona
           mapping (kept for continuity with the earlier photographer
           preview). */
        displayName={props.themeName || "Maria"}
        subtitle="Photographer"
        portraitUrl={MARIA_PORTRAIT}
        presenceKind="online"
        presenceLabel="OPEN · here now"
        rippleColor={props.accent}
        bubbleRimColor={props.bubbleRim}
        composerRimColor={props.composerRim}
        wallpaperUrl={props.wallpaperUrl}
        wallpaperConfig={props.wallpaperConfig}
        layoutStyle={effectiveLayout}
        backHref="/nex-native/themes/gallery"
        messages={messages}
        composerAction={noopAction}
        composerPlaceholder="Preview mode · sending disabled"
        contacts={[]}
        pendingInvites={[]}
        selfAccountId="preview-self"
        /* Bridge 97h · mock shop so the header shop icon appears
           and the slider (products + menu items) opens with the
           theme's colours applied. Cart-order + inquiry actions
           are noop stubs so nothing writes to the DB. */
        peerShop={{
          ...MOCK_PREVIEW_SHOP,
          isVenue: props.isVenueMode,
        }}
        sendCartOrderAction={noopAction}
        productInquiryAction={noopAction}
        uploadAction={noopAction}
        toggleReactionAction={noopAction}
        themeEmojis={props.themeEmojis}
        /* Bridge 97h · force Cart button visible in previews even
           while NEX_COMMERCE_ENABLED is false during the Indonesia
           launch. Preview shows the full [Home] [Shop] [Cart]
           cluster · Founder ask: "same buttons as dream theme". */
        forceShowCart
      />
    </>
  );
}
