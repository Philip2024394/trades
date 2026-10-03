// src/app/nex-native/vault/home/_room-icons.tsx
//
// Vault icon set · Lucide-based for a consistent modern stroke.
// Keep the IconFoo wrapper exports stable so consumers (home card,
// EmptyState) don't need to change when the underlying icon changes.

import {
  MessagesSquare,
  FileText,
  Image as LucideImage,
  Film,
  ScrollText,
  Lock,
  Archive,
  type LucideProps,
} from "lucide-react";

const base: LucideProps = {
  // 24 reads clean inside a 42px row-avatar AND a 72px empty-state bubble.
  size: 24,
  strokeWidth: 1.6,
  "aria-hidden": true,
};

export function IconChats() {
  return <MessagesSquare {...base} />;
}
export function IconDocument() {
  return <FileText {...base} />;
}
export function IconImage() {
  return <LucideImage {...base} />;
}
export function IconVideo() {
  return <Film {...base} />;
}
export function IconBlueprint() {
  return <ScrollText {...base} />;
}
export function IconLock() {
  return <Lock {...base} />;
}
export function IconArchive() {
  return <Archive {...base} />;
}
