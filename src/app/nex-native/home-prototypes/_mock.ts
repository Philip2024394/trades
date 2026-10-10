// Mock data used by every /nex-native/home-prototypes/* page.
// Pink Dream theme values so the prototypes render in a known identity
// without touching the real theme-loading pipeline.

export const PROTO = {
  userName: "Philip",
  themeName: "Pink Dream",
  themeAccent: "#FF4FA5",
  themeAccentSoft: "#FFB3D2",
  themePeach: "#FFBF8E",
  bg: "#120A14",
  panel: "#1A0E1B",
  textPrimary: "#FAF2F7",
  textSecondary: "#B38EA2",
  slides: [
    { id: "cover-a", label: "Cover · Minimal", kind: "A" },
    { id: "cover-b", label: "Cover · Grid", kind: "B" },
    { id: "cover-c", label: "Cover · Story", kind: "C" },
    { id: "cover-d", label: "Cover · Portrait", kind: "D" },
  ],
  navTiles: [
    { href: "/nex-native/chat", emoji: "💬", title: "Chat", caption: "15 new messages", count: 15 },
    { href: "/nex-native/manage/shop", emoji: "🛍", title: "Shop", caption: "3 pending orders", count: 3 },
    { href: "/nex-native/friends", emoji: "👥", title: "Friends", caption: "2 new requests", count: 2 },
  ],
};
