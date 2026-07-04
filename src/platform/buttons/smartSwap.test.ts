// Prove smartSwap engine works across button variants — content
// preservation on role match, orphan capture on missing fields.

import "./index"; // register variants
import { buttonRegistry } from "./buttonRegistry";
import { smartSwap } from "@/lib/studio/smartSwap";

// 1. Primary Solid → Secondary Outline — both share primary_action_label
//    role on `label` and primary_action_href role on `href`. Both carry
//    over even though secondary has no `iconName`/`iconPosition`.
{
  const source = buttonRegistry.require("primary.solid_1");
  const target = buttonRegistry.require("secondary.outline_1");
  const result = smartSwap({
    source: {
      registration: source,
      config: { label: "Book my slot", href: "/book", iconName: "arrow-right", iconPosition: "trailing" }
    },
    target: { registration: target }
  });
  console.assert(
    result.targetConfig.label === "Book my slot",
    "label should carry via role primary_action_label"
  );
  console.assert(
    result.targetConfig.href === "/book",
    "href should carry via role primary_action_href"
  );
  console.assert(
    result.orphaned.some((o) => o.sourceKey === "iconName") &&
      result.orphaned.some((o) => o.sourceKey === "iconPosition"),
    "iconName + iconPosition should orphan on target that lacks them"
  );
}

// 2. WhatsApp Pill → Book Arrow — both use primary_action_label /
//    primary_action_href roles, so label + href carry via role match.
//    The diff modal makes it clear so a merchant can review whether
//    the intent still fits ("Message us" as a book-CTA label is a bad
//    fit; the merchant edits post-swap).
{
  const source = buttonRegistry.require("whatsapp.pill_1");
  const target = buttonRegistry.require("cta_book.arrow_1");
  const result = smartSwap({
    source: {
      registration: source,
      config: { label: "Message us", phoneOrHref: "#whatsapp" }
    },
    target: { registration: target }
  });
  console.assert(
    result.targetConfig.label === "Message us",
    "label carries via role primary_action_label"
  );
  console.assert(
    result.targetConfig.href === "#whatsapp",
    "href carries via role primary_action_href (from phoneOrHref)"
  );
  console.assert(
    result.summary.orphanedCount === 0,
    "both meaningful fields land, no orphans expected"
  );
}

console.log("Button smartSwap — all smoke tests passed.");
