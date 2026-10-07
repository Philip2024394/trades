// src/app/nex-native/settings/_sections.ts
//
// NEX Settings · Information Architecture · sealed 2026-10-06.
// --------------------------------------------------------------
// Single source of truth for the Settings landing's grouped rows.
// Pure data · no React imports · so tests can read the IA without
// rendering anything and verify every route exists.
//
// Groups follow the founder-sealed Phase 1 architecture (§4):
//   · Your account
//   · Your NEX
//   · Messages
//   · Privacy & Safety
//   · Storage & Data
//   · Payments & NEX Wallet
//   · Help
//
// Each row either links to an existing route OR links to a Phase 1
// placeholder page that honestly declares "Coming soon" (per §28).
// No row is a dead link.

export interface SettingsRowDef {
  readonly key: string;
  readonly href: string | null;
  readonly emoji: string;
  readonly title: string;
  readonly subtitle: string;
  readonly comingSoon?: boolean;
  readonly highlighted?: boolean;
}

export interface SettingsGroupDef {
  readonly key: string;
  readonly label: string;
  readonly rows: readonly SettingsRowDef[];
}

export const SETTINGS_GROUPS: readonly SettingsGroupDef[] = [
  {
    key: "account",
    label: "Your account",
    rows: [
      {
        key: "profile",
        href: "/nex-native/settings/profile",
        emoji: "🪪",
        title: "Profile",
        subtitle: "Your name, profile, bio and public information",
      },
      {
        key: "plan",
        href: "/nex-native/settings/tier",
        emoji: "🎯",
        title: "Your NEX plan",
        subtitle: "Your current plan and available upgrades",
      },
      {
        key: "language",
        href: "/nex-native/settings/language",
        emoji: "🌐",
        title: "Language",
        subtitle: "Choose Bahasa Indonesia or English",
      },
    ],
  },
  {
    key: "your-nex",
    label: "Your NEX",
    rows: [
      {
        key: "nex-socials",
        href: "/nex-native/nex-socials",
        emoji: "🌃",
        title: "NEX Socials",
        subtitle:
          "Business openings · new friends · dating · nightlife partners · everyone around you",
        highlighted: true,
      },
      {
        key: "chat-world",
        href: "/nex-native/chat-themes-library",
        emoji: "🌊",
        title: "Chat World",
        subtitle: "Choose the World that shapes your chat",
      },
      {
        key: "world-intro",
        href: "/nex-native/settings/world-intro",
        emoji: "🎬",
        title: "World Intro",
        subtitle:
          "Choose whether your World Intro plays when people enter your chat",
      },
      {
        key: "custom-intro",
        href: "/nex-native/settings/custom-intro",
        emoji: "✨",
        title: "Custom Intro",
        subtitle: "Create your own paid intro video",
        highlighted: true,
      },
    ],
  },
  {
    key: "messages",
    label: "Messages",
    rows: [
      {
        key: "notifications",
        href: "/nex-native/settings/notifications",
        emoji: "🔔",
        title: "Notifications",
        subtitle: "Control message, call and other NEX notifications",
        comingSoon: true,
      },
      {
        key: "chat-settings",
        href: "/nex-native/settings/chat-settings",
        emoji: "💬",
        title: "Chat settings",
        subtitle:
          "Read receipts, online status, typing visibility and chat behaviour",
        comingSoon: true,
      },
    ],
  },
  {
    key: "privacy-safety",
    label: "Privacy & Safety",
    rows: [
      {
        key: "privacy",
        href: "/nex-native/settings/privacy",
        emoji: "🛡️",
        title: "Privacy",
        subtitle: "Who can see your information and how people contact you",
        comingSoon: true,
      },
      {
        key: "blocked",
        href: "/nex-native/settings/blocked",
        emoji: "🚫",
        title: "Blocked & restricted",
        subtitle: "Manage people you've blocked or restricted",
        comingSoon: true,
      },
      {
        key: "security",
        href: "/nex-native/settings/security",
        emoji: "🔐",
        title: "Security",
        subtitle: "Account and sign-in security",
        comingSoon: true,
      },
    ],
  },
  {
    key: "storage-data",
    label: "Storage & Data",
    rows: [
      {
        // Settings → Storage & Data → Vault · the user-facing doorway
        // into Vault. Authorised 2026-10-07 as part of the B.4 follow-
        // up because the Vault chat surface at /vault/home/chats/
        // [conversationId] was otherwise unreachable from Settings.
        //
        // The row title is deliberately "Vault" (not "Storage") and the
        // subtitle avoids any commercial reference (no GB figures, no
        // Bisnis, no pricing · those are sealed Phase E scope). The
        // older storage/page.tsx file is intentionally left on disk as
        // an orphaned route · touching it is forbidden until Phase E.
        key: "vault",
        href: "/nex-native/vault/home",
        emoji: "🔐",
        title: "Vault",
        subtitle: "Your private space for chats and files.",
        comingSoon: false,
      },
      {
        key: "data-usage",
        href: "/nex-native/settings/data-usage",
        emoji: "📶",
        title: "Data usage",
        subtitle: "Control how NEX uses your data",
        comingSoon: true,
      },
    ],
  },
  {
    key: "payments-wallet",
    label: "Payments & NEX Wallet",
    rows: [
      {
        key: "wallet",
        href: null,
        emoji: "⚡",
        title: "Power tokens & wallet",
        subtitle: "Earn · spend · tip · affiliate commissions · chat boosts",
        comingSoon: true,
      },
    ],
  },
  {
    key: "help",
    label: "Help",
    rows: [
      {
        key: "help",
        href: "/nex-native/settings/help",
        emoji: "❓",
        title: "Help & support",
        subtitle: "Get help with NEX",
        comingSoon: true,
      },
      {
        key: "about",
        href: "/nex-native/settings/about",
        emoji: "ℹ️",
        title: "About NEX",
        subtitle: "App information and version",
        comingSoon: true,
      },
    ],
  },
] as const;

/** Flat list of every settings row across every group · lets tests
 *  assert each href is reachable without walking the group tree. */
export const ALL_SETTINGS_ROWS: readonly SettingsRowDef[] =
  SETTINGS_GROUPS.flatMap((g) => g.rows);
