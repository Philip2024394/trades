// /homepage-split — legacy URL, redirects to the canonical landing at /.

import { redirect } from "next/navigation";

export default function HomepageSplit() {
  redirect("/");
}
