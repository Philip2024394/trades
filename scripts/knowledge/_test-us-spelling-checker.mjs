// Sanity check for US_SPELLINGS + US_CONTEXT_SPELLINGS.
// Runs a list of true-positive (should FLAG) and false-positive
// (should NOT flag) sentences through the exact detection logic
// used by health.mjs and validate.mjs.
import { US_SPELLINGS, US_CONTEXT_SPELLINGS } from "./_lib.mjs";

function detect(text) {
  for (const us of US_SPELLINGS) {
    if (new RegExp(`\\b${us}\\b`, "i").test(text)) return `flat:${us}`;
  }
  for (const { us, context } of US_CONTEXT_SPELLINGS) {
    if (new RegExp(`\\b${us}\\b`, "i").test(text) && context.test(text)) return `ctx:${us}`;
  }
  return null;
}

const cases = [
  // Should FLAG (true positives — genuine US usage)
  ["I need to cash a check at the bank.",          "FLAG check"],
  ["A two-story house has stairs to the storey.",  "FLAG story"],
  ["The wall is 3 meters long.",                   "FLAG meter"],
  ["A delivery truck arrived.",                    "FLAG truck"],
  ["Watch a TV program tonight.",                  "FLAG program"],
  ["The room is 5 meters wide.",                   "FLAG meter"],
  ["He wrote a personal check for £500.",          "FLAG check"],
  ["A multi-story car park in town.",              "FLAG story"],
  ["The color is grey.",                           "FLAG color"],
  // Should NOT flag (valid UK usage)
  ["Check the manufacturer manual before starting.",       "no flag"],
  ["Wear patterns tell the story.",                        "no flag"],
  ["A moisture meter measures timber moisture.",           "no flag"],
  ["A sack truck helps move heavy loads.",                 "no flag"],
  ["A software program to calculate rise and going.",      "no flag"],
  ["Storey height is regulated by Approved Doc K.",        "no flag"],
  ["Check with a joiner before dismantling anything.",     "no flag"],
  ["Check every tread carefully before firing up the sander.", "no flag"],
  ["Grab and gently push each — any movement means fixings have worked loose.", "no flag"]
];

for (const [text, expected] of cases) {
  const hit = detect(text);
  const shouldFlag = expected.startsWith("FLAG");
  const passed = shouldFlag ? hit != null : hit == null;
  console.log(`${passed ? "✓" : "✗"} ${(hit ?? "-").padEnd(12)} | ${expected.padEnd(12)} | ${text}`);
}
