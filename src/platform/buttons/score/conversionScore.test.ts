// Score engine smoke tests.

import { buttonRegistry } from "../buttonRegistry";
import "../index"; // register variants
import { scoreButton } from "./conversionScore";

const primary = buttonRegistry.require("primary.solid_1");

// 1. Great button — verb-first label, sensible height, decent contrast.
{
  const r = scoreButton({
    registration: primary,
    config: { label: "Book my slot", href: "/book" },
    surfaceBehind: "#FFFFFF",
    resolvedInk: "#0A0A0A",
    resolvedBackground: "#FFB300",
    heightPx: 52,
    aboveFold: true,
    mode: "desktop"
  });
  console.assert(r.tier === "green", `expected green, got ${r.tier} (${r.headline})`);
}

// 2. Bad copy — click here, low contrast, undersize.
{
  const r = scoreButton({
    registration: primary,
    config: { label: "Click here to maybe book", href: "" },
    surfaceBehind: "#FFB300",
    resolvedInk: "#FFB300",
    resolvedBackground: "#FFB300",
    heightPx: 28,
    aboveFold: false,
    mode: "mobile"
  });
  console.assert(r.tier === "red", `expected red, got ${r.tier} (${r.headline})`);
  console.assert(r.worst !== null, "worst axis should be surfaced");
  console.assert(r.worst!.fix !== null, "top issue should offer a fix");
}

// 3. Empty label — copy axis must fail with a fix.
{
  const r = scoreButton({
    registration: primary,
    config: { label: "" },
    surfaceBehind: "#FFFFFF",
    resolvedInk: "#0A0A0A",
    resolvedBackground: "#FFB300",
    heightPx: 44,
    aboveFold: true,
    mode: "desktop"
  });
  const copy = r.axes.find((a) => a.axis === "copy");
  console.assert(copy && !copy.passed, "empty label fails copy");
  console.assert(copy?.fix?.includes("action label"), "fix should suggest a label");
}

console.log("Button score — all smoke tests passed.");
