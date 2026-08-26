// Legacy · redirects to /nex-market (customer-facing rename 2026-08-23).

import { redirect } from "next/navigation";

export default function NexShopRedirect(): never {
  redirect("/nex-market");
}
