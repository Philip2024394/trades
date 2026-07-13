// DEPRECATED — kept as a no-op for backwards compatibility.
//
// The /trade-off/edit/** subtree now sits inside the persistent
// AppShell (added to layout.tsx 2026-07-09), which provides the same
// top bar / mobile bottom nav / avatar drawer as /trade-off/yard,
// /trade-off/prices, /trade-off/following. Rendering this component
// as well would produce a double-chrome effect — so it returns null.
//
// Pages that still `<DashboardHeader />` don't need to be edited to
// stop the double-header: the null render is inert. Future cleanup
// can remove the imports page-by-page without a migration.

export function DashboardHeader() {
  return null;
}
