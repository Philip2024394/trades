// /admin index — bounces to the live Payments view.
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function AdminIndexPage() {
  redirect("/admin/payments");
}
