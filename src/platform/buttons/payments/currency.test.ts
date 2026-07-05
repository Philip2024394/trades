// Lock the currency handling — this affects real customer charges.

import {
  amountToMajor,
  amountToMinor,
  currencyDecimals,
  formatMajorString,
  formatMoney
} from "./currency";

// 1. USD — 2 decimals.
console.assert(currencyDecimals("USD") === 2, "USD → 2 decimals");
console.assert(amountToMajor(4999, "USD") === 49.99, "USD 4999 → 49.99");
console.assert(formatMajorString(4999, "USD") === "49.99", "USD 4999 → '49.99'");
console.assert(amountToMinor(49.99, "USD") === 4999, "USD 49.99 → 4999");

// 2. IDR — zero decimals. This is the critical fix.
console.assert(currencyDecimals("IDR") === 0, "IDR → 0 decimals");
console.assert(amountToMajor(100000, "IDR") === 100000, "IDR 100000 → 100000");
console.assert(
  formatMajorString(100000, "IDR") === "100000",
  "IDR 100000 → '100000'"
);
console.assert(amountToMinor(100000, "IDR") === 100000, "IDR 100000 → 100000");

// 3. JPY — zero decimals.
console.assert(currencyDecimals("JPY") === 0, "JPY → 0 decimals");
console.assert(amountToMajor(5000, "JPY") === 5000, "JPY 5000 → 5000");

// 4. KWD — three decimals.
console.assert(currencyDecimals("KWD") === 3, "KWD → 3 decimals");
console.assert(amountToMajor(1234, "KWD") === 1.234, "KWD 1234 → 1.234");
console.assert(
  formatMajorString(1234, "KWD") === "1.234",
  "KWD 1234 → '1.234'"
);

// 5. Unknown currency defaults to 2 decimals.
console.assert(currencyDecimals("XXX") === 2, "unknown → 2");

// 6. Case-insensitive.
console.assert(currencyDecimals("idr") === 0, "lowercase idr → 0");
console.assert(currencyDecimals("Jpy") === 0, "mixed jpy → 0");

// 7. formatMoney via Intl formatToParts — asserts the numeric parts
//    (integer + fraction) match the currency's decimal contract without
//    getting tripped up by locale thousand-separator characters.
{
  function parts(minor: number, currency: string, locale: string) {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: currencyDecimals(currency),
      maximumFractionDigits: currencyDecimals(currency)
    }).formatToParts(
      currencyDecimals(currency) === 0
        ? minor
        : minor / Math.pow(10, currencyDecimals(currency))
    );
  }
  const usd = parts(4999, "USD", "en-US");
  const usdInt = usd.find((p) => p.type === "integer")?.value ?? "";
  const usdFrac = usd.find((p) => p.type === "fraction")?.value ?? "";
  console.assert(usdInt === "49" && usdFrac === "99", `USD parts: ${usdInt}.${usdFrac}`);

  const idr = parts(100000, "IDR", "id-ID");
  const idrHasFraction = idr.some((p) => p.type === "fraction");
  console.assert(!idrHasFraction, "IDR must have no fraction part");

  const jpy = parts(5000, "JPY", "en-US");
  const jpyHasFraction = jpy.some((p) => p.type === "fraction");
  console.assert(!jpyHasFraction, "JPY must have no fraction part");

  const kwd = parts(1234, "KWD", "en-US");
  const kwdFrac = kwd.find((p) => p.type === "fraction")?.value ?? "";
  console.assert(kwdFrac === "234", `KWD fraction: ${kwdFrac}`);
}

console.log("Currency handling — all smoke tests passed.");
