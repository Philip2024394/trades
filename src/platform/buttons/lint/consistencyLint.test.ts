// Lint smoke tests.

import {
  lintButtons,
  type ButtonInstanceForLint
} from "./consistencyLint";

// 1. Perfect consistency — one variant per role, same label, same href.
{
  const instances: ButtonInstanceForLint[] = [
    { pageId: "p1", pageName: "Home", instanceId: "a", role: "primary_action", variantKey: "primary.solid_1", label: "Get started", href: "/start" },
    { pageId: "p2", pageName: "About", instanceId: "b", role: "primary_action", variantKey: "primary.solid_1", label: "Get started", href: "/start" }
  ];
  const r = lintButtons({ instances, knownGlobalRoles: ["primary"] });
  console.assert(r.issues.length === 0, `expected 0 issues, got ${r.issues.length}`);
  console.assert(r.consistencyScore === 100, `expected 100, got ${r.consistencyScore}`);
}

// 2. Variant drift — same role, two different variants.
{
  const instances: ButtonInstanceForLint[] = [
    { pageId: "p1", pageName: "Home", instanceId: "a", role: "primary_action", variantKey: "primary.solid_1", label: "Get started", href: "/start" },
    { pageId: "p2", pageName: "Pricing", instanceId: "b", role: "primary_action", variantKey: "cta_book.arrow_1", label: "Get started", href: "/start" }
  ];
  const r = lintButtons({ instances, knownGlobalRoles: [] });
  const drift = r.issues.find((i) => i.kind === "drift");
  console.assert(drift, "should flag drift");
  console.assert(r.consistencyScore < 100, "drift should drop score");
}

// 3. Label drift — same role, different labels.
{
  const instances: ButtonInstanceForLint[] = [
    { pageId: "p1", pageName: "Home", instanceId: "a", role: "cta_contact", variantKey: "marketing.contact_1", label: "Contact us", href: "/contact" },
    { pageId: "p2", pageName: "About", instanceId: "b", role: "cta_contact", variantKey: "marketing.contact_1", label: "Get in touch", href: "/contact" }
  ];
  const r = lintButtons({ instances, knownGlobalRoles: [] });
  console.assert(
    r.issues.some((i) => i.kind === "label_drift"),
    "should flag label drift"
  );
}

// 4. Tone conflict — playful next to formal on same page.
{
  const instances: ButtonInstanceForLint[] = [
    { pageId: "p1", pageName: "Home", instanceId: "a", role: "primary_action", variantKey: "primary.solid_1", label: "Grab yours now", href: "/buy" },
    { pageId: "p1", pageName: "Home", instanceId: "b", role: "secondary_action", variantKey: "secondary.outline_1", label: "Please contact us", href: "/contact" }
  ];
  const r = lintButtons({ instances, knownGlobalRoles: [] });
  console.assert(
    r.issues.some((i) => i.kind === "tone_conflict"),
    "should flag tone conflict"
  );
}

console.log("Button consistency lint — all smoke tests passed.");
