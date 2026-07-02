// Download the 26 unlabelled plant images to \tmp\plant-imgs\.

import { writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";

const OUT = "C:\\tmp\\plant-imgs";
if (!existsSync(OUT)) await mkdir(OUT, { recursive: true });

const URLS = [
  "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%201,%202026,%2009_49_06%20AM.png?updatedAt=1782874162256",
  "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%201,%202026,%2009_51_28%20AM.png?updatedAt=1782874306909",
  "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%201,%202026,%2009_53_21%20AM.png?updatedAt=1782874420198",
  "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%201,%202026,%2009_59_00%20AM.png?updatedAt=1782874756305",
  "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%201,%202026,%2010_01_28%20AM.png?updatedAt=1782874906531",
  "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%201,%202026,%2010_06_27%20AM.png?updatedAt=1782875206396",
  "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%201,%202026,%2010_08_40%20AM.png?updatedAt=1782875342258",
  "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%201,%202026,%2010_10_26%20AM.png?updatedAt=1782875442775",
  "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%201,%202026,%2010_14_09%20AM.png?updatedAt=1782875669629",
  "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%201,%202026,%2010_16_53%20AM.png?updatedAt=1782875828089",
  "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%201,%202026,%2010_18_41%20AM.png?updatedAt=1782875936148",
  "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%201,%202026,%2010_21_05%20AM.png?updatedAt=1782876083188",
  "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%201,%202026,%2010_26_36%20AM.png?updatedAt=1782876414760",
  "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%201,%202026,%2010_30_26%20AM.png?updatedAt=1782876644594",
  "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%201,%202026,%2010_32_42%20AM.png?updatedAt=1782876783266",
  "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%201,%202026,%2010_37_36%20AM.png?updatedAt=1782877074516",
  "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%201,%202026,%2010_41_40%20AM.png?updatedAt=1782877316668",
  "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%201,%202026,%2010_47_58%20AM.png?updatedAt=1782877702897",
  "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%201,%202026,%2010_50_34%20AM.png?updatedAt=1782877857013",
  "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%201,%202026,%2010_53_45%20AM.png?updatedAt=1782878042716",
  "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%201,%202026,%2010_55_08%20AM.png?updatedAt=1782878126178",
  "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%201,%202026,%2010_57_57%20AM.png?updatedAt=1782878298934",
  "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%201,%202026,%2011_01_57%20AM.png?updatedAt=1782878567348",
  "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%201,%202026,%2011_04_26%20AM.png?updatedAt=1782878681352",
  "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%201,%202026,%2011_05_58%20AM.png?updatedAt=1782878781138",
  "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%201,%202026,%2011_09_49%20AM.png?updatedAt=1782879010182"
];

for (let i = 0; i < URLS.length; i++) {
  const url = URLS[i];
  const filename = `img-${String(i + 1).padStart(2, "0")}.png`;
  const path = `${OUT}\\${filename}`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`Failed ${i + 1}: ${res.status}`);
    continue;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(path, buf);
  console.log(`${filename} <- ${url}`);
}
console.log("Done.");
