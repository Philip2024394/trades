// Old customer-side search page — soft-killed after the pivot to
// app-for-tradies. Permanently redirects (308) to the new landing so
// inbound links from forums / search engines land cleanly rather
// than 404'ing.

import { permanentRedirect } from "next/navigation";

export default function TradeOffSearchPage() {
  permanentRedirect("/trade-off");
}
