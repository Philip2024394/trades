// scripts/apply-trade-hero-images.mjs · Philip 2026-08-28.
//
// Apply Philip-provided ImageKit URLs to trade hero images.
// STRICT 1:1: first image per category becomes the trade hero.
// Extras saved to data/trade-image-reserves.json for future assignment.
//
// Usage:
//   node scripts/apply-trade-hero-images.mjs            # dry run
//   node scripts/apply-trade-hero-images.mjs --apply    # write

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const HEROES_FILE   = path.join(REPO_ROOT, "src", "lib", "tradeOffHeroes.ts");
const MANIFEST_FILE = path.join(REPO_ROOT, "data", "nex-image-manifest.json");

const APPLY = process.argv.includes("--apply");

// ─── PHILIP'S IMAGE SETS (2026-08-28) ─────────────────────────────────────

const BATCHES = {
  "timber-merchant": {
    label: "Wood suppliers",
    urls: [
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%206,%202026,%2002_51_24%20AM.png?updatedAt=1783281109102",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%206,%202026,%2002_59_22%20AM.png?updatedAt=1783281583596",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%206,%202026,%2002_54_01%20AM.png?updatedAt=1783281266172",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%206,%202026,%2002_51_24%20AM.png?updatedAt=1783281109102",  // duplicate of #1
    ],
  },
  "plumber": {
    label: "Plumbing / water installation",
    urls: [
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%206,%202026,%2002_03_04%20PM.png?updatedAt=1783321401355",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%206,%202026,%2002_01_34%20PM.png?updatedAt=1783321318333",
      // Plumbers water installation contractors batch (Philip 2026-08-28)
      "https://ik.imagekit.io/9mrgsv2rp/8e18d82453b9f9b4a1ea9e092375a79d.jpg?updatedAt=1784148284472",
      "https://ik.imagekit.io/9mrgsv2rp/e24794c5db9f1e0776a388d9ed69e54a.jpg?updatedAt=1784148250268",
      "https://ik.imagekit.io/9mrgsv2rp/502642afc2936f5aabc9b38076601bd4.jpg?updatedAt=1784148190175",
      "https://ik.imagekit.io/9mrgsv2rp/cbb8a90e29a36cb676d4c033ec40c698.jpg?updatedAt=1784148153198",
      "https://ik.imagekit.io/9mrgsv2rp/a4569de56007536a36a4685d6bef8f68.jpg?updatedAt=1784148126312",
      "https://ik.imagekit.io/9mrgsv2rp/b899a07d1db66c997d8ed08cfd086c43.jpg?updatedAt=1784148333837",
      "https://ik.imagekit.io/9mrgsv2rp/373308185243cc1e1bb598547fefc7d5.jpg?updatedAt=1784148653901",
      "https://ik.imagekit.io/9mrgsv2rp/46cb968f86da00b52ed9b9ea9cc696fc.jpg?updatedAt=1784148630866",
      "https://ik.imagekit.io/9mrgsv2rp/2f8636a565b8b93352eb4a38ac0398b0.jpg?updatedAt=1784148606058",
      "https://ik.imagekit.io/9mrgsv2rp/525bd3f7cb2f065667ab035f6089f25a.jpg?updatedAt=1784148563868",
      "https://ik.imagekit.io/9mrgsv2rp/913d04c8667002dab1c7b6114d9e2e0c.jpg?updatedAt=1784148481757",
      "https://ik.imagekit.io/9mrgsv2rp/0fd29f160e6471aadbdc3a25583b01b4.jpg?updatedAt=1784148685328",
      // Plumbing water installation batch (Philip 2026-08-28)
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2017,%202026,%2006_17_13%20AM.png?updatedAt=1784243849888",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2017,%202026,%2006_15_38%20AM.png?updatedAt=1784243759099",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2017,%202026,%2006_14_40%20AM.png?updatedAt=1784243695172",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2017,%202026,%2006_13_05%20AM.png?updatedAt=1784243604586",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2017,%202026,%2006_10_19%20AM.png?updatedAt=1784243437358",
    ],
  },
  "general-builder": {
    label: "Builders / construction (+ construction directory cards)",
    urls: [
      // Original builders batch
      "https://ik.imagekit.io/9mrgsv2rp/Untitleddfafddffsddddddddsd.png?updatedAt=1783724926573",
      "https://ik.imagekit.io/9mrgsv2rp/Untitleddfafddffsddddddddsdd.png?updatedAt=1783724965098",
      "https://ik.imagekit.io/9mrgsv2rp/Untitleddfafddffsddddddddsddd.png?updatedAt=1783725021819",
      "https://ik.imagekit.io/9mrgsv2rp/Untitleddfafddffsddddddddsdddd.png?updatedAt=1783725059537",
      // Additional "construction directory cards" batch (Philip 2026-08-28)
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2014,%202026,%2012_17_18%20AM.png?updatedAt=1783963055606",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2014,%202026,%2012_03_42%20AM.png?updatedAt=1783962239169",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2014,%202026,%2012_24_19%20AM.png?updatedAt=1783963476700",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2014,%202026,%2012_23_01%20AM.png?updatedAt=1783963396887",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2014,%202026,%2012_19_32%20AM.png?updatedAt=1783963188790",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2015,%202026,%2012_08_09%20AM.png?updatedAt=1784048909794",
      // Home contractors renovations batch (Philip 2026-08-28)
      "https://ik.imagekit.io/5vv5pw26q/bd2c8dd2ddeeb2e5f96c42f77a3a8d82.jpg?updatedAt=1784596768529",
      "https://ik.imagekit.io/5vv5pw26q/fc0b9110d1cefb2a07a190cfffe7d49d.jpg?updatedAt=1784596822578",
    ],
  },
  "social-media-marketer": {
    label: "Social media (NEW slug · not yet in tradeOff.ts)",
    urls: [
      "https://ik.imagekit.io/5vv5pw26q/af981685a21ef236529576ba5c163fe2.jpg?updatedAt=1784596413569",
      "https://ik.imagekit.io/5vv5pw26q/b2e07a89cae63290302c3aabd1cea303.jpg?updatedAt=1784596327692",
      "https://ik.imagekit.io/5vv5pw26q/c2da2d4268a19e894ecba05b56defd21.jpg?updatedAt=1784596244047",
      "https://ik.imagekit.io/5vv5pw26q/8a03c196b996a1bc537667e7f76f68ba.jpg?updatedAt=1784595812693",
      "https://ik.imagekit.io/5vv5pw26q/ac06760ceb9267eae9b43d4d1c0bd94f.jpg?updatedAt=1784596168953",
      "https://ik.imagekit.io/5vv5pw26q/5f3ed1b0a928c0186626c254d9ffd405.jpg?updatedAt=1784595777338",
      "https://ik.imagekit.io/5vv5pw26q/e2251bcbafb7d2a1fabb1873e9135cef.jpg?updatedAt=1784595749160",
      "https://ik.imagekit.io/5vv5pw26q/e386f3f2ef2464088e5f91bf0dc33791.jpg?updatedAt=1784595708274",
      "https://ik.imagekit.io/5vv5pw26q/cdb9a8ce5fe91fcb5f3d9e90eeb1eadb.jpg?updatedAt=1784594752369",
      "https://ik.imagekit.io/5vv5pw26q/4351186eaa4db1292c755672a75fd851.jpg?updatedAt=1784594719681",
      "https://ik.imagekit.io/5vv5pw26q/cf7d73225cb277a09e1dd4cc3c603f2e.jpg?updatedAt=1784594614714",
      "https://ik.imagekit.io/5vv5pw26q/69017859dd8ce97fce5bc685a844a7f0.jpg?updatedAt=1784594588092",
      "https://ik.imagekit.io/5vv5pw26q/Untitledasdasaaaaacccwweqweweqweqwwewdsasasdadssddasasdasdaasdssdasd.png?updatedAt=1784614060197",
      "https://ik.imagekit.io/5vv5pw26q/Untitledasdasaaaaacccwweqweweqweqwwewdsasasdadssddasasdasda.png?updatedAt=1784613164637",
      "https://ik.imagekit.io/5vv5pw26q/Untitledasdasaaaaacccwweqweweqweqwwewdsasasdadssddasasdasdaasdssdasdsdfsdasd.png?updatedAt=1784614456614",
      "https://ik.imagekit.io/5vv5pw26q/Untitledasdasaaaaacccwweqweweqweqwwewdsasasdadssddasasdasdaasdssdasdsdfsdasddasdsdfs.png?updatedAt=1784614777527",
      "https://ik.imagekit.io/5vv5pw26q/Untitledasdasaaaaacccwweqweweqweqwwewdsasasdadssddasasdasdaasdssdasdsdfsd.png?updatedAt=1784614344502",
      "https://ik.imagekit.io/5vv5pw26q/Untitledasdasaaaaacccwweqweweqweqwwewdsasasdadssddasasdasdaasdssdasdsdfsdasddasdsdfsasda.png?updatedAt=1784614979337",
    ],
  },
  "roofer": {
    label: "Roof repair / new roofs / roofers",
    urls: [
      "https://ik.imagekit.io/9mrgsv2rp/b7e8d507628ea97aaae03bdbd1a81154.jpg?updatedAt=1784124333716",
      "https://ik.imagekit.io/9mrgsv2rp/bf8eb7814733d64f049ada483ffbd4b6.jpg?updatedAt=1784124310900",
      "https://ik.imagekit.io/9mrgsv2rp/54b484804168f69430b10852534594aa.jpg?updatedAt=1784124441899",
      "https://ik.imagekit.io/9mrgsv2rp/5d2fcb2f4df4ad8903193d3e130a4bdd.jpg?updatedAt=1784124389457",
      "https://ik.imagekit.io/9mrgsv2rp/81b79c889ce66919303f627a7aaea3bb.jpg?updatedAt=1784124356871",
      "https://ik.imagekit.io/9mrgsv2rp/163acb9ed5d91d165921bf20e0cf3216.jpg?updatedAt=1784124500519",
      "https://ik.imagekit.io/9mrgsv2rp/13c08d8ee096f4de7740bfbca0188ef8.jpg?updatedAt=1784124527517",
      "https://ik.imagekit.io/9mrgsv2rp/b6ff3b094b161b7cce2db22b69bb232a.jpg?updatedAt=1784124581819",
      "https://ik.imagekit.io/9mrgsv2rp/b6b7a1bc81d757d02bbf991683a5792d.jpg?updatedAt=1784124862311",
      "https://ik.imagekit.io/9mrgsv2rp/c8c3e87e832d9d4bcec47b7fed212873.jpg?updatedAt=1784124952530",
      "https://ik.imagekit.io/9mrgsv2rp/f2b4fc0b1bddad2da3dd9cda8d13d700.jpg?updatedAt=1784124823815",
      "https://ik.imagekit.io/9mrgsv2rp/aabfebaa847430bc6c7f24e103fc3e6f.jpg?updatedAt=1784125002837",
      "https://ik.imagekit.io/9mrgsv2rp/9711c22eb619f2d31dfd55c5f4b7a48b.jpg?updatedAt=1784125099078",
      "https://ik.imagekit.io/9mrgsv2rp/d293d79ac4cb0cc9a23434979344b557.jpg?updatedAt=1784125120392",
      "https://ik.imagekit.io/9mrgsv2rp/b3785840d16b30030c7caea90d062172.jpg?updatedAt=1784125141900",
      "https://ik.imagekit.io/9mrgsv2rp/70d2eaa0f786429b723d6852652eaff2.jpg?updatedAt=1784125492942",
      "https://ik.imagekit.io/9mrgsv2rp/1d0108027f0750efe71f93bc0ae52d74.jpg?updatedAt=1784125249943",
      "https://ik.imagekit.io/9mrgsv2rp/8329e2dd1220cf9acd99dc7825614e73.jpg?updatedAt=1784125227896",
      "https://ik.imagekit.io/9mrgsv2rp/612dd521c884f1a84b80038b375f1325.jpg?updatedAt=1784125198376",
      "https://ik.imagekit.io/9mrgsv2rp/b407959abbcf3566a3ded9ee7a8ca0d6.jpg?updatedAt=1784125167367",
      "https://ik.imagekit.io/9mrgsv2rp/3e29d475f53d95a6e270c6bae2f552c9.jpg?updatedAt=1784126235446",
      "https://ik.imagekit.io/9mrgsv2rp/5b92a9f72f8615f02d305fdc98d20dd0.jpg?updatedAt=1784126891139",
      "https://ik.imagekit.io/9mrgsv2rp/c23cc2b93dff12df29a472c79b5589ee.jpg?updatedAt=1784126929739",
      "https://ik.imagekit.io/9mrgsv2rp/a7f573c98f97e84a66cb81354bddf4f1.jpg?updatedAt=1784127035309",
      "https://ik.imagekit.io/9mrgsv2rp/bd422e5b93e73203340d90cc928307fb.jpg?updatedAt=1784127014019",
      "https://ik.imagekit.io/9mrgsv2rp/c446cddae7c6808abdfe7b25ecaf085b.jpg?updatedAt=1784126981186",
      "https://ik.imagekit.io/9mrgsv2rp/84443327b3e2428488c55b9a9c92d230.jpg?updatedAt=1784126954299",
      "https://ik.imagekit.io/9mrgsv2rp/b5938354c2fde868067bd2be981dc2f6.jpg?updatedAt=1784127213932",
      "https://ik.imagekit.io/9mrgsv2rp/901462bd0aa9a21aa55ada4a6d46d198.jpg?updatedAt=1784127179592",
      "https://ik.imagekit.io/9mrgsv2rp/5147f1574217b1d7a476db5aa9efa8f8.jpg?updatedAt=1784127131026",
      "https://ik.imagekit.io/9mrgsv2rp/aed24e6ffaf1232a2dba76d655cd6ad3.jpg?updatedAt=1784128163552",
      "https://ik.imagekit.io/9mrgsv2rp/7ef74a472c67a3f16bd9fac17449d281.jpg?updatedAt=1784128129835",
      "https://ik.imagekit.io/9mrgsv2rp/0e7bb910e5af026f0dd199eb902b507e.jpg?updatedAt=1784127352698",
      "https://ik.imagekit.io/9mrgsv2rp/28d0bd6c24e8dd3e9eb074038930bfcb.jpg?updatedAt=1784127321666",
      "https://ik.imagekit.io/9mrgsv2rp/e911685f6fc77742d93489b633ccf72f.jpg?updatedAt=1784127288394",
      "https://ik.imagekit.io/9mrgsv2rp/106a1d315869aacc2add07606cb89750.jpg?updatedAt=1784128442611",
      "https://ik.imagekit.io/9mrgsv2rp/22794f87e9cefcecd010a05bb8d5424c.jpg?updatedAt=1784128407149",
      "https://ik.imagekit.io/9mrgsv2rp/99c392e85d7836490ae4c57c2ff66b31.jpg?updatedAt=1784128211813",
      "https://ik.imagekit.io/9mrgsv2rp/acebef325927ec340441f41e14f33033.jpg?updatedAt=1784128488766",
      // Roofing contractors batch (Philip 2026-08-28)
      "https://ik.imagekit.io/9mrgsv2rp/60cdf695d0715dadf17e80d4311c7a94.jpg?updatedAt=1784129064855",
      "https://ik.imagekit.io/9mrgsv2rp/60cdf695d0715dadf17e80d4311c7a94.jpg?updatedAt=1784129064855",  // duplicate
      "https://ik.imagekit.io/9mrgsv2rp/510a504d742c475442e501c001238597.jpg?updatedAt=1784129095831",
      // Roofing tiles supplier / roofing products batch (Philip 2026-08-28)
      "https://ik.imagekit.io/9mrgsv2rp/Jul%2017,%202026,%2006_29_08%20AM.png?updatedAt=1784244566923",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2017,%202026,%2006_26_37%20AM.png?updatedAt=1784244414413",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2017,%202026,%2006_41_39%20AM.png?updatedAt=1784245317669",
      // Roofer additional (Philip 2026-08-28)
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jun%2027,%202026,%2001_11_24%20PM.png?updatedAt=1782540704528",
    ],
  },
  "swimming-pool-installer": {
    label: "Swimming pool supplies / pool builders",
    urls: [
      "https://ik.imagekit.io/9mrgsv2rp/d1c00eddcda0dbc1960be21c05ba7cf4%20(1).jpg?updatedAt=1784134372034",
      "https://ik.imagekit.io/9mrgsv2rp/3c8d2bce30102c7e0dd2ccb11d45135b.jpg?updatedAt=1784134404783",
      "https://ik.imagekit.io/9mrgsv2rp/b562727020e9cc5ac337f6c9507d5839.jpg?updatedAt=1784134457494",
      "https://ik.imagekit.io/9mrgsv2rp/d61bb5cd3df620db33f5cbaea94767b0%20(1).jpg?updatedAt=1784134793964",
      "https://ik.imagekit.io/9mrgsv2rp/3e89a5eaceadec3a32686ac262cac714.jpg?updatedAt=1784134624518",
      "https://ik.imagekit.io/9mrgsv2rp/a858df4050fb9eeb4562aaed1edb0534.jpg?updatedAt=1784134586592",
      "https://ik.imagekit.io/9mrgsv2rp/58277372308cae7e34a119f577e5eda2.jpg?updatedAt=1784134550004",
      "https://ik.imagekit.io/9mrgsv2rp/98353bf6c4c52ffca759ea15a75ecc96.jpg?updatedAt=1784134510583",
      "https://ik.imagekit.io/9mrgsv2rp/b431de47ac88f4568bd150ddf7b2211f.jpg?updatedAt=1784134971763",
      "https://ik.imagekit.io/9mrgsv2rp/4cb15d8b1b61ffb804b5f7254fe23937.jpg?updatedAt=1784134939284",
      "https://ik.imagekit.io/9mrgsv2rp/6621661177ece08aa8d7c5c7a6326f36.jpg?updatedAt=1784134905786",
      "https://ik.imagekit.io/9mrgsv2rp/a93b560a86512110ea8f68bc3bfabff8.jpg?updatedAt=1784134864539",
      "https://ik.imagekit.io/9mrgsv2rp/6c1df1349a978c1dc4a8a05f56eb5ff9.jpg?updatedAt=1784134838381",
      "https://ik.imagekit.io/9mrgsv2rp/3945b309324ce36d1587c2ee4abe8d72.jpg?updatedAt=1784135445876",
      "https://ik.imagekit.io/9mrgsv2rp/19789e688ed5a111c194e66761ab658b.jpg?updatedAt=1784135420982",
      "https://ik.imagekit.io/9mrgsv2rp/ec257e596b5a10ee652bb2eec2f20ba3.jpg?updatedAt=1784135086329",
      "https://ik.imagekit.io/9mrgsv2rp/9f9cb93f787ef8e2ffd33d75e7783eb2.jpg?updatedAt=1784135050415",
      "https://ik.imagekit.io/9mrgsv2rp/3e8e369f38563829d3dbd62c2eaf9d73.jpg?updatedAt=1784135004006",
      "https://ik.imagekit.io/9mrgsv2rp/977aa6d4f30d9f1929df31667b6b5e82.jpg?updatedAt=1784135580495",
      "https://ik.imagekit.io/9mrgsv2rp/273c63731599d75841a848c27a6a4c92.jpg?updatedAt=1784135550585",
      "https://ik.imagekit.io/9mrgsv2rp/936641d1204cb4ba428cc59eb301183e.jpg?updatedAt=1784135507743",
      "https://ik.imagekit.io/9mrgsv2rp/8f8dc8275c47e3a06d45017d2b72947f.jpg?updatedAt=1784135480972",
      "https://ik.imagekit.io/9mrgsv2rp/7adeca2f199b7def15795d3c8ef7b679.jpg?updatedAt=1784136929684",
      "https://ik.imagekit.io/9mrgsv2rp/19bc3508d956987312495cc916a8c4b2.jpg?updatedAt=1784135715929",
      "https://ik.imagekit.io/9mrgsv2rp/ffefe84df6efc84f15d2120bdcda7a37.jpg?updatedAt=1784135681180",
      "https://ik.imagekit.io/9mrgsv2rp/e6b3e307e89bb33b1a05c017d82aff8c.jpg?updatedAt=1784135646444",
      "https://ik.imagekit.io/9mrgsv2rp/152b9b64be49e3008597bcc735a871da.jpg?updatedAt=1784135608478",
      "https://ik.imagekit.io/9mrgsv2rp/2b98fbf0659c27335599db4fe61a0bbe.jpg?updatedAt=1784144126159",
      "https://ik.imagekit.io/9mrgsv2rp/3f7bb07a8cf5fc603bed8f6c50eb079c.jpg?updatedAt=1784144090462",
      "https://ik.imagekit.io/9mrgsv2rp/58999c472887b3e1edf560be3d104169.jpg?updatedAt=1784144050647",
      "https://ik.imagekit.io/9mrgsv2rp/38efc050a7448718212ac67874cc9901.jpg?updatedAt=1784144005752",
      "https://ik.imagekit.io/9mrgsv2rp/a11d3b545a6796719ff68a39421cccb8.jpg?updatedAt=1784143977744",
      "https://ik.imagekit.io/9mrgsv2rp/ec00382fb6730231ce6a18c4fad6d35a.jpg?updatedAt=1784144287849",
      "https://ik.imagekit.io/9mrgsv2rp/a3e10bce2ba2032d139e7cfe3614a5ab.jpg?updatedAt=1784144263093",
      "https://ik.imagekit.io/9mrgsv2rp/04c46c8b2dbc42835cf7fd1d990f9e45.jpg?updatedAt=1784144233050",
      "https://ik.imagekit.io/9mrgsv2rp/60eca123217a3d58c92415f93c26e1d8.jpg?updatedAt=1784144190166",
      "https://ik.imagekit.io/9mrgsv2rp/1010759fdc8b75c92b9b38c1aa6b1082.jpg?updatedAt=1784144159314",
      "https://ik.imagekit.io/9mrgsv2rp/f5711e8d3aa161ff7371d1a104ff2ab0.jpg?updatedAt=1784144360455",
      "https://ik.imagekit.io/9mrgsv2rp/b380056e5363bfbd255d44063f423da1.jpg?updatedAt=1784144318511",
      // Pool supplies cleaning batch (Philip 2026-08-28)
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2017,%202026,%2003_29_09%20AM.png?updatedAt=1784233771185",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2017,%202026,%2003_07_12%20AM.png?updatedAt=1784232451700",
      // Swimming pool builders contractors batch (Philip 2026-08-28)
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2017,%202026,%2007_13_41%20AM.png?updatedAt=1784247241503",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2017,%202026,%2007_11_30%20AM.png?updatedAt=1784247111910",
    ],
  },
  "drywaller": {
    label: "Drywallers / slabbing / plaster work",
    urls: [
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2017,%202026,%2007_38_49%20AM.png?updatedAt=1784248755973",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2017,%202026,%2007_35_38%20AM.png?updatedAt=1784248559434",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2017,%202026,%2007_34_11%20AM.png?updatedAt=1784248472621",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2017,%202026,%2007_30_55%20AM.png?updatedAt=1784248274761",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2017,%202026,%2007_29_02%20AM.png?updatedAt=1784248178139",
    ],
  },
  "driveway-installer": {
    label: "Paving / driveways / supplies",
    urls: [
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2017,%202026,%2007_26_13%20AM.png?updatedAt=1784247996214",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2017,%202026,%2007_23_27%20AM.png?updatedAt=1784247823295",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2017,%202026,%2007_21_27%20AM.png?updatedAt=1784247703583",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2017,%202026,%2007_19_24%20AM.png?updatedAt=1784247578267",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2017,%202026,%2007_18_32%20AM.png?updatedAt=1784247530535",
      // Garden paving additional (Philip 2026-08-28)
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jun%2027,%202026,%2001_01_26%20PM.png?updatedAt=1782540126695",
    ],
  },
  "ppe-supplier": {
    label: "Work wear / PPE",
    urls: [
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%201,%202026,%2001_50_24%20PM.png?updatedAt=1782888644770",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%201,%202026,%2001_52_19%20PM.png?updatedAt=1782888756319",
    ],
  },
  "locksmith": {
    label: "Key cutting / locksmith",
    urls: [
      "https://ik.imagekit.io/9mrgsv2rp/Untitledfdfddd.png?updatedAt=1782889000676",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%201,%202026,%2012_21_41%20PM.png?updatedAt=1782883323259",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%201,%202026,%2012_18_53%20PM.png?updatedAt=1782883156936",
    ],
  },
  "tool-hire": {
    label: "Tool hire / machines",
    urls: [
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%201,%202026,%2010_17_59%20PM.png?updatedAt=1782919107938",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%201,%202026,%2010_08_17%20PM.png?updatedAt=1782918529245",
    ],
  },
  "heavy-machinery": {
    label: "Plant hire / heavy machines",
    urls: [
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%202,%202026,%2001_29_50%20PM.png?updatedAt=1782973809295",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%202,%202026,%2001_18_24%20PM.png?updatedAt=1782973123232",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%202,%202026,%2002_10_51%20PM.png?updatedAt=1782976278329",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%202,%202026,%2004_00_55%20PM.png?updatedAt=1782982886418",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%203,%202026,%2002_25_52%20PM.png?updatedAt=1783063565213",
      "https://ik.imagekit.io/9mrgsv2rp/Untitleddfafddffsddddddddsdddddddf.png?updatedAt=1783725434000",
      "https://ik.imagekit.io/9mrgsv2rp/fc88b662b0545355ddc115566a91f89d.jpg?updatedAt=1783725500713",
      "https://ik.imagekit.io/9mrgsv2rp/downloadd.png?updatedAt=1783725544007",
      "https://ik.imagekit.io/9mrgsv2rp/Untitleddfafddffsddddddddsdddddddff.png?updatedAt=1783727384922",
      "https://ik.imagekit.io/9mrgsv2rp/9f24c190e01770c7333d77b09e8d7175f.jpg?updatedAt=1783727580334",
      "https://ik.imagekit.io/9mrgsv2rp/65b8c1d4bfae3732ab46208fb8ecbba0f.jpg?updatedAt=1783727540181",
      "https://ik.imagekit.io/9mrgsv2rp/8dfcde25a780aa027f8b1a8698781c27f.jpg?updatedAt=1783727491996",
      "https://ik.imagekit.io/9mrgsv2rp/b04024a426dccc0e9a35892158a3bd1cf.jpg?updatedAt=1783727445170",
      "https://ik.imagekit.io/9mrgsv2rp/1086e8a1d1e41fbec56c77f5066fa5cfff.jpg?updatedAt=1783727416854",
      "https://ik.imagekit.io/9mrgsv2rp/6ac6a05ac912810fac6fe4e094b3bdbff.jpg?updatedAt=1783727625432",
      "https://ik.imagekit.io/9mrgsv2rp/b6dd9a9b06652ff57a00c47bec022e38d.jpg?updatedAt=1783727939892",
      "https://ik.imagekit.io/9mrgsv2rp/a4ac792e5e04b27042a41e7eb5d404badd.jpg?updatedAt=1783727826823",
      "https://ik.imagekit.io/9mrgsv2rp/fda.jpg?updatedAt=1783727689859",
      // Heavy machinery additional batch (Philip 2026-08-28)
      "https://ik.imagekit.io/5vv5pw26q/d01ed42f32a69914c0a54344abd00abe.jpg?updatedAt=1784596650823",
      "https://ik.imagekit.io/5vv5pw26q/ea39d19978b8c8eb9de9654a12ea945e.jpg?updatedAt=1784596686133",
      "https://ik.imagekit.io/5vv5pw26q/Untitledasdasaaaaacccwweqweweqweqwwewdsasasdadssddasasdasdaasdss.png?updatedAt=1784613632668",
      "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2021,%202026,%2012_46_16%20PM.png?updatedAt=1784612794539",
      "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2021,%202026,%2012_43_53%20PM.png?updatedAt=1784612647575",
      "https://ik.imagekit.io/5vv5pw26q/Untitledasdasaaaaacccwweqweweqweqwwewdsasasdadssddasasdasdaasdssdasdsdfsdasddasd.png?updatedAt=1784614598227",
    ],
  },
  "carpenter": {
    label: "Carpenters",
    urls: [
      "https://ik.imagekit.io/5vv5pw26q/Untitleddsdsaaaaaaadsasd.png?updatedAt=1784617900936",
      "https://ik.imagekit.io/5vv5pw26q/Untitleddsdsaaaaaaadsasdsdadasddzxc.png?updatedAt=1784618559806",
      "https://ik.imagekit.io/5vv5pw26q/Untitleddsdsaaaaaaadsasdsdadasdd.png?updatedAt=1784618512549",
      "https://ik.imagekit.io/5vv5pw26q/Untitleddsdsaaaaaaadsasdsdadasd.png?updatedAt=1784618008818",
      "https://ik.imagekit.io/5vv5pw26q/Untitleddsdsaaaaaaadsasdsdad.png?updatedAt=1784617948729",
    ],
  },
  "building-merchant": {
    label: "Building supplies merchants",
    urls: [
      "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2022,%202026,%2005_43_21%20AM.png?updatedAt=1784673816597",
      "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2022,%202026,%2005_41_55%20AM.png?updatedAt=1784673731384",
    ],
  },
  "logo-designer": {
    label: "Logo design (NEW slug · not yet in tradeOff.ts)",
    urls: [
      "https://ik.imagekit.io/5vv5pw26q/Untitledzxczxdddddddddfdasdddfffdddddxdsdxczxcxcxccccddcccccccccvddvvvdv.png?updatedAt=1784690081752",
      "https://ik.imagekit.io/5vv5pw26q/Untitledzxczxdddddddddfdasdddfffdddddxdsdxczxcxcxccccddcccccccccvddvvvd.png?updatedAt=1784690042651",
      "https://ik.imagekit.io/5vv5pw26q/Untitledzxczxdddddddddfdasdddfffdddddxdsdxczxcxcxccccddcccccccccvddvvv.png?updatedAt=1784689990410",
      "https://ik.imagekit.io/5vv5pw26q/Untitledzxczxdddddddddfdasdddfffdddddxdsdxczxcxcxccccddcccccccc.png?updatedAt=1784686469347",
      "https://ik.imagekit.io/5vv5pw26q/Untitledzxczxdddddddddfdasdddfffdddddxdsdxczxcxcxccccdd.png?updatedAt=1784686096840",
      "https://ik.imagekit.io/5vv5pw26q/Untitledzxczxdddddddddfdasdddfffdddddxdsdxczxcxcxccccddcc.png?updatedAt=1784686143365",
      "https://ik.imagekit.io/5vv5pw26q/Untitledzxczxdddddddddfdasdddfffdddddxdsdxczxcxcxcccc.png?updatedAt=1784685527218",
      "https://ik.imagekit.io/5vv5pw26q/Untitledzxczxdddddddddfdasdddfffdddddxdsdxczxcxc.png?updatedAt=1784685371726",
      "https://ik.imagekit.io/5vv5pw26q/Untitledzxczxdddddddddfdasdddfffdddd.png?updatedAt=1784684577422",
      "https://ik.imagekit.io/5vv5pw26q/Untitledzxczxdddddddddfdasdddfffddddd.png?updatedAt=1784684618823",
      "https://ik.imagekit.io/5vv5pw26q/Untitledzxczxdddddddddfdasdddfffddd.png?updatedAt=1784684538340",
      "https://ik.imagekit.io/5vv5pw26q/Untitledzxczxdddddddddfdasdddfffdd.png?updatedAt=1784684496551",
      "https://ik.imagekit.io/5vv5pw26q/Untitledzxczxdddddddddfdasdddfff.png?updatedAt=1784684350211",
      "https://ik.imagekit.io/5vv5pw26q/Untitledzxczxdddddddddfdasdddfffd.png?updatedAt=1784684453169",
    ],
  },
  "tiler": {
    label: "Tilers / tiling contractors",
    urls: [
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2017,%202026,%2007_08_32%20AM.png?updatedAt=1784246934783",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2017,%202026,%2007_07_19%20AM.png?updatedAt=1784246859585",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2017,%202026,%2007_06_07%20AM.png?updatedAt=1784246782906",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2017,%202026,%2007_05_01%20AM.png?updatedAt=1784246717090",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2017,%202026,%2007_03_56%20AM.png?updatedAt=1784246653657",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2017,%202026,%2007_02_23%20AM.png?updatedAt=1784246561330",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2017,%202026,%2006_59_01%20AM.png?updatedAt=1784246358259",
    ],
  },
  "bricklayer": {
    label: "Brick layers / workers / contractors / supplies",
    urls: [
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2017,%202026,%2006_05_51%20AM.png?updatedAt=1784243168614",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2017,%202026,%2006_04_21%20AM.png?updatedAt=1784243077134",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2017,%202026,%2006_02_50%20AM.png?updatedAt=1784242987249",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2017,%202026,%2006_01_12%20AM.png?updatedAt=1784242893429",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2017,%202026,%2006_00_39%20AM.png?updatedAt=1784242857941",
      // Brick layers workers contractors supplies batch (Philip 2026-08-28)
      "https://ik.imagekit.io/9mrgsv2rp/61ecc4ad93cfe9b5b2d354de49aa9c0b.jpg?updatedAt=1784152029156",
      "https://ik.imagekit.io/9mrgsv2rp/6dfaec08d5c779822408aea75d83bfdc.jpg?updatedAt=1784152097824",
      "https://ik.imagekit.io/9mrgsv2rp/aa07ed81dda711b572b58d4e3a5c4f71.jpg?updatedAt=1784151998400",
      "https://ik.imagekit.io/9mrgsv2rp/413fb75faeb685cebcafcc5ac3059b81.jpg?updatedAt=1784151951736",
      "https://ik.imagekit.io/9mrgsv2rp/c30fa69bb4278b93d9029e6bda583c51.jpg?updatedAt=1784151778671",
      "https://ik.imagekit.io/9mrgsv2rp/f2835419b97de1bf24d3cbb2d18604f2.jpg?updatedAt=1784151701030",
      "https://ik.imagekit.io/9mrgsv2rp/59149c03bb7ac2a49d5013c39657e600.jpg?updatedAt=1784151673033",
      "https://ik.imagekit.io/9mrgsv2rp/b3d599ff40bfa00696e930e0131e7925.jpg?updatedAt=1784151623063",
      "https://ik.imagekit.io/9mrgsv2rp/ebce049dff086f8fa105dcbf45831a25.jpg?updatedAt=1784151564475",
      "https://ik.imagekit.io/9mrgsv2rp/91c371b6931b26892a94bae82fc510a1.jpg?updatedAt=1784151530814",
      "https://ik.imagekit.io/9mrgsv2rp/98dd72b483f71ef9f9007ed8412e9572.jpg?updatedAt=1784151469621",
      "https://ik.imagekit.io/9mrgsv2rp/f2846637e4f89a3057374cc758a0a0a2.jpg?updatedAt=1784151437718",
      // Block layer / brick layer additional (Philip 2026-08-28)
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jun%2027,%202026,%2001_04_20%20PM.png?updatedAt=1782540284461",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jun%2027,%202026,%2001_02_49%20PM.png?updatedAt=1782540190632",
    ],
  },
  "estate-agent": {
    label: "Property sales / auctioneers / agents / contractors",
    urls: [
      "https://ik.imagekit.io/9mrgsv2rp/d6401a8646cdba6db3d1fe46f665c8fd.jpg?updatedAt=1784126810194",
      "https://ik.imagekit.io/9mrgsv2rp/786994edb913f9467e5ecace2bfdfd8d.jpg?updatedAt=1784126782678",
      "https://ik.imagekit.io/9mrgsv2rp/fe7304013b1f0c2c6b5b500d72a00ca7.jpg?updatedAt=1784126748596",
      "https://ik.imagekit.io/9mrgsv2rp/523b1f1ecc7751b29ab0274d332b4884.jpg?updatedAt=1784126712074",
      "https://ik.imagekit.io/9mrgsv2rp/523b1f1ecc7751b29ab0274d332b4884.jpg?updatedAt=1784126712074",  // duplicate
      "https://ik.imagekit.io/9mrgsv2rp/9b5d4672f02bcea7b51a74450587f25c.jpg?updatedAt=1784126671652",
      "https://ik.imagekit.io/9mrgsv2rp/6c0b1052a97ccff35b257d8994481b4a.jpg?updatedAt=1784126629911",
      "https://ik.imagekit.io/9mrgsv2rp/3a8ae2822f2ecb335143e6040ea00942.jpg?updatedAt=1784126594692",
      "https://ik.imagekit.io/9mrgsv2rp/190c46be74c83b90178678d40331bb58.jpg?updatedAt=1784126556485",
      "https://ik.imagekit.io/9mrgsv2rp/565fee3a8296e6aa74d8d72f1bbf8c9c.jpg?updatedAt=1784126525661",
      "https://ik.imagekit.io/9mrgsv2rp/574a2becedc31909bf7de9eeacf87300.jpg?updatedAt=1784126498746",
      "https://ik.imagekit.io/9mrgsv2rp/51d074776503d28d85e32e12885b3054.jpg?updatedAt=1784126461376",
      "https://ik.imagekit.io/9mrgsv2rp/c5ea7a87b58c7f572ab4c01b9e8d4a49.jpg?updatedAt=1784126428970",
      "https://ik.imagekit.io/9mrgsv2rp/a8d1933df402ed6051537e36732f7a2f.jpg?updatedAt=1784126382343",
      "https://ik.imagekit.io/9mrgsv2rp/ac94bab0766e62244f555506a9262b9b.jpg?updatedAt=1784126269518",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%207,%202026,%2011_57_35%20PM.png?updatedAt=1783443475927",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%203,%202026,%2003_09_16%20PM.png?updatedAt=1783066169815",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%203,%202026,%2009_49_26%20AM.png?updatedAt=1783047003198",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%203,%202026,%2009_25_35%20AM.png?updatedAt=1783045558515",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%203,%202026,%2008_40_16%20AM.png?updatedAt=1783042883919",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%202,%202026,%2002_36_48%20PM.png?updatedAt=1782977828849",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jun%2030,%202026,%2006_38_39%20PM.png?updatedAt=1782819535041",
    ],
  },
  "plasterer": {
    label: "Plastering / rendering",
    urls: [
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2017,%202026,%2005_47_24%20AM.png?updatedAt=1784242063425",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2017,%202026,%2005_43_32%20AM.png?updatedAt=1784241831492",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2017,%202026,%2005_41_26%20AM.png?updatedAt=1784241706089",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2017,%202026,%2005_35_31%20AM.png?updatedAt=1784241347777",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2017,%202026,%2005_34_03%20AM.png?updatedAt=1784241266272",
    ],
  },
  "joiner": {
    label: "Carved wood / joinery",
    urls: [
      "https://ik.imagekit.io/9mrgsv2rp/93bf4c7289b643b54c98fec085a28aa2.jpg?updatedAt=1784121207097",
      "https://ik.imagekit.io/9mrgsv2rp/5aaec8a06fa19110674118f2aa2924ea.jpg?updatedAt=1784121246552",
      "https://ik.imagekit.io/9mrgsv2rp/7b4128799dc4d74c74f4a1e69d3435ba.jpg?updatedAt=1784120754568",
      "https://ik.imagekit.io/9mrgsv2rp/063416991d65af23eb61f9453117abab.jpg?updatedAt=1784121596097",
      "https://ik.imagekit.io/9mrgsv2rp/a533c1bd9280ab9696f6c4dced041a6f.jpg?updatedAt=1784121567074",
    ],
  },
  "furniture-maker": {
    label: "Furniture supplies / makers",
    urls: [
      "https://ik.imagekit.io/9mrgsv2rp/f6906127ca6b272c347366e0ec1049f9.jpg?updatedAt=1784120794983",
      "https://ik.imagekit.io/9mrgsv2rp/92d86711d71fec35b076a96b49a64fa2.jpg?updatedAt=1784120714189",
      "https://ik.imagekit.io/9mrgsv2rp/976db7a62ca4e239841f0cc99ae3d37f.jpg?updatedAt=1784120830211",
      "https://ik.imagekit.io/9mrgsv2rp/dbf7cbb6e6d5bf7687010dac50e95e09.jpg?updatedAt=1784121013187",
      "https://ik.imagekit.io/9mrgsv2rp/3137f2abf8096eed67335bda1d2b047b.jpg?updatedAt=1784120962751",
      "https://ik.imagekit.io/9mrgsv2rp/6aec7c93dabe2b38806b2370ed223148.jpg?updatedAt=1784120901191",
      "https://ik.imagekit.io/9mrgsv2rp/4af2bc65c783c8bda69a744a59e35959.jpg?updatedAt=1784120877808",
      "https://ik.imagekit.io/9mrgsv2rp/2e1ba8395051fdc3b2d5f8b2dbd2cb3ad.jpg?updatedAt=1784121281226",
      "https://ik.imagekit.io/9mrgsv2rp/58fb493a6ac74b568fc652f56dd5b431.jpg?updatedAt=1784121625925",
      "https://ik.imagekit.io/9mrgsv2rp/ee4093d9ce6198bb9e1f36806790e08c.jpg?updatedAt=1784121763666",
      "https://ik.imagekit.io/9mrgsv2rp/369b0923175db2ea84dd4caf884d14f9.jpg?updatedAt=1784121796170",
      "https://ik.imagekit.io/9mrgsv2rp/4f7c770a75ad3a0d1b94b81c518175fe.jpg?updatedAt=1784132396755",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2017,%202026,%2002_10_47%20AM.png?updatedAt=1784229066691",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2017,%202026,%2004_28_14%20AM.png?updatedAt=1784237313759",
    ],
  },
  "landscaper": {
    label: "Gardener / landscape",
    urls: [
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2015,%202026,%2007_21_23%20AM.png?updatedAt=1784074905020",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2015,%202026,%2006_41_30%20AM.png?updatedAt=1784072516838",
      "https://ik.imagekit.io/9mrgsv2rp/0ae6e49699c2601f34bc0d58a699e767.jpg?updatedAt=1784113473328",
      "https://ik.imagekit.io/9mrgsv2rp/feac4e23c6247b09fbda160e3f6230e2.jpg?updatedAt=1784113507251",
      "https://ik.imagekit.io/9mrgsv2rp/9171141622dfafc52f0217ecc79a5157d.jpg?updatedAt=1784113435475",
      "https://ik.imagekit.io/9mrgsv2rp/d3dc4fdf62da6e575ccea46862b68527d.jpg?updatedAt=1784113398148",
      "https://ik.imagekit.io/9mrgsv2rp/id-11134207-7ra0j-mcw7hzy0ks6wbe@resize_w900_nl.webp?updatedAt=1784113886539",
      "https://ik.imagekit.io/9mrgsv2rp/e9e801591f7930c0eb79c126e026311d.jpg?updatedAt=1784113855841",
      "https://ik.imagekit.io/9mrgsv2rp/9be8dabe58dd9281570518c7b8f0be41.jpg?updatedAt=1784113642704",
      "https://ik.imagekit.io/9mrgsv2rp/8b3797f4409966845e872b6dee2c879a.jpg?updatedAt=1784113570236",
      "https://ik.imagekit.io/9mrgsv2rp/7edc29b91ecb6c8ddd2b855e73a77b60.jpg?updatedAt=1784113537383",
      "https://ik.imagekit.io/9mrgsv2rp/e4f5f64409accc428e37b825ee1bbd21.jpg?updatedAt=1784113989443",
      "https://ik.imagekit.io/9mrgsv2rp/4cac1b021929821a65d2a34a41c88b3d.jpg?updatedAt=1784113949953",
      "https://ik.imagekit.io/9mrgsv2rp/15cdce4e24050c4f2f426dd8fceb1d86.jpg?updatedAt=1784113914879",
      "https://ik.imagekit.io/9mrgsv2rp/3a7df85defc86bd33d27c2dea1c6f421.jpg?updatedAt=1784114034000",
      "https://ik.imagekit.io/9mrgsv2rp/6415b0ad6f5081ff2d0fde336e9ec6b5.jpg?updatedAt=1784115696703",
      "https://ik.imagekit.io/9mrgsv2rp/Untitledsdaaavasdsereooods.png?updatedAt=1784115617159",
      "https://ik.imagekit.io/9mrgsv2rp/ddcfde4d70bc62eaa229cbd488a3e354.jpg?updatedAt=1784114489739",
      "https://ik.imagekit.io/9mrgsv2rp/6171a12477ef5d38159e10dd2de359ea.jpg?updatedAt=1784114406325",
      "https://ik.imagekit.io/9mrgsv2rp/425f6604335dd058885cc0f834ab8ea8.jpg?updatedAt=1784114430712",
      "https://ik.imagekit.io/9mrgsv2rp/56ad64cd28de8be8b223d9a93dfe44eb.jpg?updatedAt=1784115747198",
      "https://ik.imagekit.io/9mrgsv2rp/2bd7dc769bc1073b0bc1053bf9b9ee79.jpg?updatedAt=1784115721589",
      "https://ik.imagekit.io/9mrgsv2rp/3d5894f958525412493cf5772d33b8d8.jpg?updatedAt=1784122534748",
      "https://ik.imagekit.io/9mrgsv2rp/be75c919241aba975328a9e229bb79ac.jpg?updatedAt=1784122506945",
      "https://ik.imagekit.io/9mrgsv2rp/7a729024cda7e463a9b0d60959cee7b3.jpg?updatedAt=1784122475329",
      "https://ik.imagekit.io/9mrgsv2rp/399e42c146251a8c8e07ab1b7bc8a5f8.jpg?updatedAt=1784122449011",
      "https://ik.imagekit.io/9mrgsv2rp/5e05ce3d23a904dc607271c1367bbe31.jpg?updatedAt=1784122423102",
      "https://ik.imagekit.io/9mrgsv2rp/2e8ba78a002d04751c35a16033b26dde.jpg?updatedAt=1784122683082",
      "https://ik.imagekit.io/9mrgsv2rp/c9f2cfc4a2c0970420feb00da664db6d.jpg?updatedAt=1784122657555",
      "https://ik.imagekit.io/9mrgsv2rp/5897eac44996e163a4aafecd28979159.jpg?updatedAt=1784122631388",
      "https://ik.imagekit.io/9mrgsv2rp/7b225bda299775e059550843f2ba1521.jpg?updatedAt=1784122604133",
      "https://ik.imagekit.io/9mrgsv2rp/af96180d354d77fb33cf4b4abb944464.jpg?updatedAt=1784122581815",
      "https://ik.imagekit.io/9mrgsv2rp/bd593c8134be54e0a518478461e65cc3.jpg?updatedAt=1784122726519",
      // Gardening landscape constructors supplies batch (Philip 2026-08-28)
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2017,%202026,%2005_25_41%20AM.png?updatedAt=1784240760654",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2017,%202026,%2005_22_54%20AM.png?updatedAt=1784240596345",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2017,%202026,%2005_20_25%20AM.png?updatedAt=1784240446781",
      // Garden landscaping batch (Philip 2026-08-28)
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2017,%202026,%2007_44_03%20AM.png?updatedAt=1784249061859",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2017,%202026,%2007_48_27%20AM.png?updatedAt=1784249332992",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2017,%202026,%2007_49_42%20AM.png?updatedAt=1784249398682",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2017,%202026,%2007_52_57%20AM.png?updatedAt=1784249595561",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2017,%202026,%2007_54_26%20AM.png?updatedAt=1784249681945",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2017,%202026,%2007_56_43%20AM.png?updatedAt=1784249821450",
    ],
  },
  "tree-surgeon": {
    label: "Tree surgeon",
    urls: [
      "https://ik.imagekit.io/9mrgsv2rp/9a02b8ba5a1194ac6c1738ddcc8d9067.jpg?updatedAt=1783771301197",
      "https://ik.imagekit.io/9mrgsv2rp/f91fc819fc196a6b912f9b6b84808943d.jpg?updatedAt=1783728048479",
    ],
  },
  "kitchen-fitter": {
    label: "Kitchen supplier / maker",
    urls: [
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2013,%202026,%2001_52_07%20PM.png?updatedAt=1783925545344",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2013,%202026,%2001_49_21%20PM.png?updatedAt=1783925378242",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2013,%202026,%2001_46_41%20PM.png?updatedAt=1783925220683",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2013,%202026,%2001_37_29%20PM.png?updatedAt=1783924673127",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2013,%202026,%2001_32_24%20PM.png?updatedAt=1783924371225",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2013,%202026,%2012_31_13%20PM.png?updatedAt=1783920701293",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2013,%202026,%2002_57_15%20PM.png?updatedAt=1783929454012",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2013,%202026,%2002_54_07%20PM.png?updatedAt=1783929266780",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2013,%202026,%2002_20_49%20PM.png?updatedAt=1783927271832",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2013,%202026,%2002_16_52%20PM.png?updatedAt=1783927035137",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2013,%202026,%2003_02_24%20PM.png?updatedAt=1783929762318",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2013,%202026,%2003_10_28%20PM.png?updatedAt=1783930246053",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2013,%202026,%2003_08_14%20PM.png?updatedAt=1783930111812",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2013,%202026,%2003_07_05%20PM.png?updatedAt=1783930046093",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2013,%202026,%2002_58_59%20PM.png?updatedAt=1783929555501",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2013,%202026,%2003_25_14%20PM.png?updatedAt=1783931129895",
      "https://ik.imagekit.io/9mrgsv2rp/Untitledsdsvvvv.png?updatedAt=1783933039572",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2013,%202026,%2003_45_49%20PM.png?updatedAt=1783932369644",
      "https://ik.imagekit.io/9mrgsv2rp/Untitledsdsvvvvff.png?updatedAt=1783933145999",
      "https://ik.imagekit.io/9mrgsv2rp/Untitledsdsvvvvf.png?updatedAt=1783933095463",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2013,%202026,%2009_05_46%20PM.png?updatedAt=1783951565785",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2013,%202026,%2009_00_24%20PM.png?updatedAt=1783951239149",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2013,%202026,%2008_59_27%20PM.png?updatedAt=1783951184243",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2013,%202026,%2008_58_14%20PM.png?updatedAt=1783951115611",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2013,%202026,%2009_14_25%20PM.png?updatedAt=1783952079841",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2013,%202026,%2009_08_59%20PM.png?updatedAt=1783951757720",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2013,%202026,%2011_23_27%20PM.png?updatedAt=1783959824125",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2013,%202026,%2011_11_45%20PM.png?updatedAt=1783959123974",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2013,%202026,%2011_06_40%20PM.png?updatedAt=1783958815981",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2013,%202026,%2010_53_37%20PM.png?updatedAt=1783958037322",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2013,%202026,%2010_47_54%20PM.png?updatedAt=1783957696517",
    ],
  },
};

// ─── DEDUPE + PICK FIRST + BUILD RESERVES ─────────────────────────────────

const heroAssignments = {};  // { slug: url }
const reserves = {};         // { slug: [url, url, ...] }
let totalRaw = 0, totalUnique = 0, totalHero = 0, totalReserved = 0;

console.log(`[apply-trade-hero-images] mode: ${APPLY ? "WRITE" : "DRY RUN"}\n`);

for (const [slug, { label, urls }] of Object.entries(BATCHES)) {
  const unique = [...new Set(urls)];
  totalRaw += urls.length;
  totalUnique += unique.length;

  const hero = unique[0];
  const extras = unique.slice(1);
  heroAssignments[slug] = hero;
  if (extras.length > 0) reserves[slug] = extras;

  totalHero += 1;
  totalReserved += extras.length;

  const dupCount = urls.length - unique.length;
  console.log(`  ${slug}  ·  ${label}`);
  console.log(`    raw: ${urls.length}  unique: ${unique.length}${dupCount ? ` (${dupCount} dup${dupCount > 1 ? "s" : ""} removed)` : ""}`);
  console.log(`    hero: ${hero.slice(0, 90)}...`);
  console.log(`    reserved: ${extras.length}`);
}

console.log(`\n─ totals`);
console.log(`  raw URLs:       ${totalRaw}`);
console.log(`  unique URLs:    ${totalUnique}`);
console.log(`  heroes to set:  ${totalHero}`);
console.log(`  reserves saved: ${totalReserved}`);

if (!APPLY) {
  console.log("\n(dry run · add --apply to write files)");
  process.exit(0);
}

// ─── UPDATE tradeOffHeroes.ts ─────────────────────────────────────────────

let heroesSrc = fs.readFileSync(HEROES_FILE, "utf8");

for (const [slug, url] of Object.entries(heroAssignments)) {
  // Slug key can be either bare `slug:` or quoted `"slug":`
  const bareRe = new RegExp(`(^\\s+)${slug}:\\s*\\n?\\s*"[^"]+",`, "m");
  const quotedRe = new RegExp(`(^\\s+)"${slug}":\\s*\\n?\\s*"[^"]+",`, "m");
  const needsQuote = /-/.test(slug);
  const replacement = needsQuote
    ? `$1"${slug}":\n    "${url}",`
    : `$1${slug}:\n    "${url}",`;

  if (quotedRe.test(heroesSrc)) {
    heroesSrc = heroesSrc.replace(quotedRe, replacement);
    console.log(`  UPDATE  ${slug}`);
  } else if (bareRe.test(heroesSrc)) {
    heroesSrc = heroesSrc.replace(bareRe, replacement);
    console.log(`  UPDATE  ${slug}`);
  } else {
    // Slug doesn't exist yet · insert before the specific `};` that
    // terminates TRADE_OFF_HERO_IMAGES · uniquely identified by the
    // "// Banner fallback map" comment that follows it.
    const insertRe = /(\n};\n\n\/\/ Banner fallback map)/;
    if (insertRe.test(heroesSrc)) {
      const insert = needsQuote
        ? `  "${slug}":\n    "${url}",`
        : `  ${slug}:\n    "${url}",`;
      heroesSrc = heroesSrc.replace(insertRe, "\n  " + insert.trim() + "$1");
      console.log(`  INSERT  ${slug} (new entry)`);
    } else {
      console.warn(`  WARN    ${slug} · could not locate insertion point`);
    }
  }
}

fs.writeFileSync(HEROES_FILE, heroesSrc, "utf8");
console.log(`\n[written] ${HEROES_FILE}`);

// ─── ADD EXTRAS TO NEX IMAGE LIBRARY (data/nex-image-manifest.json) ──────
//
// Philip 2026-08-28: extras go into the NEX image library with knowledge
// tags so NEX can search-and-select suitable images for card slots that
// need them. If no suitable match exists, NEX reports "images needed" to
// admin (mechanism TBD · Phase 2 build).

const manifest = JSON.parse(fs.readFileSync(MANIFEST_FILE, "utf8"));
if (!manifest.images || typeof manifest.images !== "object") {
  console.error(`[error] manifest.images missing in ${MANIFEST_FILE}`);
  process.exit(1);
}

let addedToLibrary = 0, skippedAlreadyPresent = 0;
const nowIso = new Date().toISOString();

for (const [slug, urls] of Object.entries(reserves)) {
  const label = BATCHES[slug]?.label ?? slug;
  for (const url of urls) {
    if (manifest.images[url]) {
      // Already in library · augment tags if missing this trade slug
      const existing = manifest.images[url];
      existing.tags = existing.tags ?? [];
      if (!existing.tags.includes(slug)) existing.tags.push(slug);
      if (!existing.tags.includes("card_illustration")) existing.tags.push("card_illustration");
      existing.available_for_cards = true;
      skippedAlreadyPresent++;
      continue;
    }
    manifest.images[url] = {
      source: "philip_curated_2026_08_28",
      original_prompt: `Curated by Philip · ${label}`,
      description: `Card illustration for the "${label}" trade category. Uploaded by Philip 2026-08-28. May be selected by NEX for empty merchant cards in this trade when no verified merchant photo exists.`,
      tags: [slug, "trade_directory", "card_illustration", label.toLowerCase().replace(/[^a-z0-9]+/g, "-")],
      subject_domain: slug,
      trade_slug: slug,
      available_for_cards: true,
      // Walker doctrine (Philip 2026-08-28): images added to library get
      // added to walker search directory · walkers seek REAL merchant photos
      // for this category and replace category illustration when found.
      walker_seek_priority: true,
      walker_seek_category: slug,
      created_at: nowIso,
      created_by: "philip",
      notes: `Extra beyond the 1-hero-per-trade slot in src/lib/tradeOffHeroes.ts. NEX may search this library first when a merchant card in trade '${slug}' has no verified image. Walker search should target this trade category (mechanism Phase 2).`,
    };
    addedToLibrary++;
  }
}

manifest.updated_at = nowIso;
manifest.last_change = `2026-08-28 · added ${addedToLibrary} trade-card illustrations from Philip (${Object.keys(reserves).length} trade categories)`;

fs.writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2), "utf8");
console.log(`[written] ${MANIFEST_FILE}`);
console.log(`  added to library: ${addedToLibrary}`);
if (skippedAlreadyPresent > 0) {
  console.log(`  already present (tags augmented): ${skippedAlreadyPresent}`);
}

console.log("\n[done]");
