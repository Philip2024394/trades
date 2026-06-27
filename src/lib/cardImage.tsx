// Shared business-card image generator. (v1)
// Used by:
//   /api/trade-off/card-image?slug=<slug>   (queryable from JS for the
//                                            Web Share API path)
//   /<slug>/card.png  → /trade/<slug>/card.png/route.tsx
//                                            (clean static-looking URL
//                                             for WhatsApp / Twitter
//                                             inline previews)
//
// Layout (1075 x 720 px — UK business card 85x55mm + 3mm bleed @ 300 DPI):
//
//   ┌────────────────────────────────────────────────┐
//   │ BANNER (left ~2/3)        │ DARK PANEL (R 1/3)  │
//   │ trade hero or custom hero │ #0A0A0A             │
//   │                           │ [TRADE eyebrow]     │
//   │                           │ Display Name        │
//   │                           │ City                │
//   │                           │ +44 xxx xxx xxxx    │
//   │                           │ xratedtrade.com/x   │
//   │                           │ [ QR 180x180 ]      │
//   └────────────────────────────────────────────────┘

import { ImageResponse } from "next/og";
import QRCode from "qrcode";
import { supabase, type HammerexTradeOffListing } from "@/lib/supabase";
import { tradeLabel } from "@/lib/tradeOff";
import { tradeHeroFor } from "@/lib/tradeOffHeroes";
import { siteUrl } from "@/lib/seo";

const WIDTH = 1075;
const HEIGHT = 720;
const PANEL_WIDTH = 360;
const BRAND_YELLOW = "#FFB300";
const BRAND_BLACK = "#0A0A0A";

// Human-readable WhatsApp formatter — best-effort grouping by country
// dial-code length. UK (44) and most EU codes are 2 digits; ID (62) is 2;
// US/CA (1) is 1; some (e.g. 880, 971) are 3. After the dial code we
// split the rest into a 4-digit middle block + remainder, which lands
// natural for UK ("+44 7700 900123") and most ID numbers. Not locale
// perfect — purely cosmetic for the printed card.
function formatWhatsapp(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return raw;
  // 1-digit codes (NANP)
  const oneDigitCodes = new Set(["1"]);
  // 3-digit codes — common cases we care about
  const threeDigitPrefixes = ["880", "971", "974", "973", "972", "961", "962", "963", "964", "966", "967", "968", "970", "212", "213", "216", "218", "220", "221", "225", "226", "227", "228", "229", "230", "231", "232", "233", "234", "235", "236", "237", "238", "239", "240", "241", "242", "243", "244", "245", "248", "249", "250", "251", "252", "253", "254", "255", "256", "257", "258", "260", "261", "262", "263", "264", "265", "266", "267", "268", "269", "291", "297", "298", "299", "350", "351", "352", "353", "354", "355", "356", "357", "358", "359", "370", "371", "372", "373", "374", "375", "376", "377", "378", "380", "381", "382", "383", "385", "386", "387", "389", "420", "421", "423", "500", "501", "502", "503", "504", "505", "506", "507", "508", "509", "590", "591", "592", "593", "594", "595", "596", "597", "598", "599", "670", "672", "673", "674", "675", "676", "677", "678", "679", "680", "681", "682", "683", "685", "686", "687", "688", "689", "690", "691", "692", "850", "852", "853", "855", "856", "880", "886", "960", "975", "976", "977", "992", "993", "994", "995", "996", "998"];
  let ccLen = 2;
  if (oneDigitCodes.has(digits.slice(0, 1))) ccLen = 1;
  else if (threeDigitPrefixes.includes(digits.slice(0, 3))) ccLen = 3;
  const cc = digits.slice(0, ccLen);
  const rest = digits.slice(ccLen);
  // 4-digit first block + rest as one group (max 6 typical UK mobile).
  if (rest.length <= 4) return `+${cc} ${rest}`;
  const first = rest.slice(0, 4);
  const tail = rest.slice(4);
  return `+${cc} ${first} ${tail}`.trim();
}

export async function renderCardImage(
  slugRaw: string,
  opts: { download?: boolean } = {}
): Promise<Response> {
  const slug = (slugRaw ?? "").replace(/[^a-zA-Z0-9-]/g, "");
  if (!slug) {
    return new Response("Bad slug", { status: 400 });
  }

  const res = await supabase
    .from("hammerex_trade_off_listings")
    .select(
      "display_name, primary_trade, city, whatsapp, custom_app_hero_url, slug, status"
    )
    .eq("slug", slug)
    .eq("status", "live")
    .maybeSingle();

  const data = (res.data ?? null) as Pick<
    HammerexTradeOffListing,
    | "display_name"
    | "primary_trade"
    | "city"
    | "whatsapp"
    | "custom_app_hero_url"
    | "slug"
    | "status"
  > | null;

  if (!data) {
    return new Response("Not found", { status: 404 });
  }

  const tradeLabelText = tradeLabel(data.primary_trade);
  const bannerUrl = data.custom_app_hero_url ?? tradeHeroFor(data.primary_trade);
  const profileUrl = `${siteUrl()}/${data.slug}`;
  const displayHost = profileUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const [hostPart, ...slugParts] = displayHost.split("/");
  const slugPart = slugParts.join("/");
  const waDisplay = formatWhatsapp(data.whatsapp);

  // QR — base64 data URI so satori can render it without a second HTTP
  // round-trip. Plain PNG, no centre overlay (cleaner scan).
  const qrPngBuffer = await QRCode.toBuffer(profileUrl, {
    width: 360,
    margin: 1,
    color: { dark: BRAND_BLACK, light: "#FFFFFF" },
    errorCorrectionLevel: "H"
  });
  const qrDataUri = `data:image/png;base64,${Buffer.from(qrPngBuffer).toString("base64")}`;

  const headers: Record<string, string> = {
    "Content-Type": "image/png",
    "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400"
  };
  if (opts.download) {
    headers["Content-Disposition"] = `attachment; filename="${slug}-business-card.png"`;
  }

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          background: BRAND_BLACK,
          position: "relative"
        }}
      >
        {/* LEFT — banner image (≈2/3). Falls back to flat black if no
            hero is mapped for the trade yet. */}
        <div
          style={{
            display: "flex",
            position: "relative",
            width: WIDTH - PANEL_WIDTH,
            height: HEIGHT,
            background: BRAND_BLACK,
            overflow: "hidden"
          }}
        >
          {bannerUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={bannerUrl}
              alt=""
              width={WIDTH - PANEL_WIDTH}
              height={HEIGHT}
              style={{
                width: WIDTH - PANEL_WIDTH,
                height: HEIGHT,
                objectFit: "cover"
              }}
            />
          )}
          {/* Right-edge fade into the dark panel — softens the seam. */}
          <div
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              width: 140,
              height: HEIGHT,
              background:
                "linear-gradient(90deg, rgba(10,10,10,0) 0%, rgba(10,10,10,0.85) 100%)"
            }}
          />
        </div>

        {/* RIGHT — dark info panel (1/3 of card). */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: PANEL_WIDTH,
            height: HEIGHT,
            background: BRAND_BLACK,
            padding: "44px 36px 32px 36px",
            color: "#FFFFFF",
            position: "relative"
          }}
        >
          {/* Eyebrow — yellow ALL-CAPS trade label */}
          <div
            style={{
              display: "flex",
              color: BRAND_YELLOW,
              fontSize: 18,
              fontWeight: 800,
              letterSpacing: "0.18em",
              textTransform: "uppercase"
            }}
          >
            {tradeLabelText}
          </div>

          {/* Display name */}
          <div
            style={{
              display: "flex",
              marginTop: 14,
              color: "#FFFFFF",
              fontSize: 38,
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: "-0.02em"
            }}
          >
            {data.display_name}
          </div>

          {/* City */}
          <div
            style={{
              display: "flex",
              marginTop: 8,
              color: "rgba(255,255,255,0.7)",
              fontSize: 22,
              fontWeight: 500,
              letterSpacing: "-0.01em"
            }}
          >
            {data.city}
          </div>

          {/* WhatsApp number */}
          <div
            style={{
              display: "flex",
              marginTop: 32,
              color: "#FFFFFF",
              fontSize: 19,
              fontWeight: 700,
              letterSpacing: "0.01em"
            }}
          >
            {waDisplay}
          </div>

          {/* URL — host in white, /slug accent in yellow */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              marginTop: 10,
              color: "#FFFFFF",
              fontSize: 17,
              fontWeight: 600,
              letterSpacing: "0.01em"
            }}
          >
            <span style={{ color: "#FFFFFF" }}>{hostPart}</span>
            {slugPart && (
              <span style={{ color: BRAND_YELLOW }}>{`/${slugPart}`}</span>
            )}
          </div>

          {/* QR — bottom-right, white card so contrast survives
              messenger compression. */}
          <div
            style={{
              display: "flex",
              position: "absolute",
              right: 32,
              bottom: 28,
              width: 180,
              height: 180,
              background: "#FFFFFF",
              borderRadius: 10,
              padding: 8
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrDataUri}
              alt=""
              width={164}
              height={164}
              style={{ width: 164, height: 164 }}
            />
          </div>
        </div>
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
      headers
    }
  );
}
