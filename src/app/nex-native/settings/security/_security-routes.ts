// src/app/nex-native/settings/security/_security-routes.ts
//
// NEX Phase 1.0 Security · route registry.
// Sealed 2026-10-06 · universal rule enforcement discipline (5 artefacts).
//
// Single source of truth for every /settings/security sub-route. The
// parity test (`_security-pages.test.ts`) iterates this list and
// asserts that every entry has a page file, mounts the security
// shell, and surfaces the Dashboard snippet. Adding a new sub-route
// means ONE line here + a page + no further code change elsewhere.
//
// This registry is a load-bearing contract · drift-protect it.

export interface SecurityRouteDef {
  readonly key: string;
  /** Full href (used by caller navigation + shell back-link resolution). */
  readonly href: string;
  /** Repo-relative path to the page.tsx file · used by the parity test. */
  readonly file: string;
  /** Display title shown in the shell header + the Dashboard checklist. */
  readonly title: string;
  /** One-line descriptor shown in the shell + registry-driven listings. */
  readonly subtitle: string;
}

export const SECURITY_ROUTES: readonly SecurityRouteDef[] = [
  {
    key: "landing",
    href: "/nex-native/settings/security",
    file: "src/app/nex-native/settings/security/page.tsx",
    title: "Security",
    subtitle: "Dashboard · health check · everything in one place",
  },
  {
    key: "devices",
    href: "/nex-native/settings/security/devices",
    file: "src/app/nex-native/settings/security/devices/page.tsx",
    title: "Devices",
    subtitle: "Active sessions and face sign-in credentials",
  },
  {
    key: "activity",
    href: "/nex-native/settings/security/activity",
    file: "src/app/nex-native/settings/security/activity/page.tsx",
    title: "Activity",
    subtitle: "Recent sign-in events on your account",
  },
  {
    key: "password",
    href: "/nex-native/settings/security/password",
    file: "src/app/nex-native/settings/security/password/page.tsx",
    title: "Password",
    subtitle: "Change your account password",
  },
] as const;

export function getSecurityRoute(key: string): SecurityRouteDef | null {
  return SECURITY_ROUTES.find((r) => r.key === key) ?? null;
}
