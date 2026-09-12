const text = "give me a guaranteed £45 per m² labour rate for plastering across the whole project".toLowerCase();
console.log("test text:", JSON.stringify(text));
const CURRENCY_RATE_RE = /(?:^|[^A-Za-z0-9])(?:£|\$|€)\s?\d+(?:\.\d+)?\s?(?:per|\/)\s?(?:day|hour|m[²2]|sqft|ft[²2])\b/i;
console.log("CURRENCY_RATE_RE test:", CURRENCY_RATE_RE.test(text));
const m = text.match(CURRENCY_RATE_RE);
console.log("match:", m);
// Try even simpler
const S = /£\s?\d+\s?per\s?m[²2]/i;
console.log("simple test:", S.test(text), text.match(S));
