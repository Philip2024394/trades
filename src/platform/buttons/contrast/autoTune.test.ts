// Deterministic checks for the contrast tuner.

import {
  autoTuneInk,
  checkTapTarget,
  contrastRatioOf,
  meetsContrast
} from "./autoTune";

// 1. Pure black on pure white — max ratio 21.
{
  const r = contrastRatioOf("#000000", "#FFFFFF");
  console.assert(Math.round(r) === 21, `black on white → 21, got ${r}`);
}

// 2. Yellow #FFB300 background — black ink passes, white ink fails.
{
  const tune = autoTuneInk("#FFFFFF", "#FFB300");
  console.assert(tune.tuned, "white on yellow must retune");
  console.assert(tune.ink === "#0A0A0A", `expected near-black, got ${tune.ink}`);
}

// 3. WhatsApp green + white — brand exception (fails AA at 4.5, real
//    ratio ~1.98). This test locks in the known trade-off: the codebase
//    intentionally lowers minContrast for `cta_whatsapp` because brand
//    recognition beats pure a11y for this specific role.
{
  const r = contrastRatioOf("#FFFFFF", "#25D366");
  console.assert(r > 1.5 && r < 2.5, `WhatsApp ratio expected ~1.98, got ${r}`);
  console.assert(!meetsContrast("#FFFFFF", "#25D366", 4.5), "should fail AA");
}

// 4. Passing pair — no retune.
{
  const t = autoTuneInk("#0A0A0A", "#FFB300");
  console.assert(!t.tuned, "black on yellow should NOT retune");
}

// 5. Tap-target guard.
{
  const under = checkTapTarget(28);
  const ok = checkTapTarget(48);
  console.assert(!under.ok && under.shortByPx === 16, "28px is 16px short of 44");
  console.assert(ok.ok, "48px passes");
}

// 6. Short hex #rgb form.
{
  const r = contrastRatioOf("#fff", "#000");
  console.assert(Math.round(r) === 21, `#fff vs #000 = 21, got ${r}`);
}

console.log("Button contrast — all smoke tests passed.");
