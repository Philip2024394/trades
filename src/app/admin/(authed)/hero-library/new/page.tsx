// /admin/hero-library/new — create a new hero image.

import { HeroEditForm } from "../HeroEditForm";

export const dynamic = "force-dynamic";

export default function NewHeroImagePage() {
  return <HeroEditForm mode="new" />;
}
