import { ImageResponse } from "next/og";
import { supabase, type HammerexTradeOffListing } from "@/lib/supabase";
import { tradeLabel } from "@/lib/tradeOff";

export const runtime = "nodejs";
export const alt = "Hammerex Trade Off";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const res = await supabase
    .from("hammerex_trade_off_listings")
    .select("display_name, primary_trade, city, photos, avatar_url, hammerex_standard_verified")
    .eq("slug", slug)
    .eq("status", "live")
    .maybeSingle();

  const data = (res.data ?? null) as Pick<
    HammerexTradeOffListing,
    "display_name" | "primary_trade" | "city" | "photos" | "avatar_url" | "hammerex_standard_verified"
  > | null;

  const photo = data?.photos?.[0] ?? data?.avatar_url ?? null;
  const name = data?.display_name ?? "Hammerex Trade Off";
  const trade = data ? tradeLabel(data.primary_trade) : "Trade Off";
  const city = data?.city ?? "United Kingdom";
  const verified = Boolean(data?.hammerex_standard_verified);

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          background: "#0a0a0a",
          position: "relative",
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            alt={name}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "contain"
            }}
          />
        )}
        {/* gradient overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, rgba(10,10,10,0) 30%, rgba(10,10,10,0.55) 65%, rgba(10,10,10,0.95) 100%)"
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            padding: "48px 64px",
            display: "flex",
            flexDirection: "column",
            gap: 14
          }}
        >
          {verified && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                alignSelf: "flex-start",
                background: "#facc15",
                color: "#000",
                fontWeight: 800,
                fontSize: 24,
                padding: "8px 16px",
                borderRadius: 999,
                letterSpacing: "-0.01em"
              }}
            >
              ⚡ Hammerex Standard
            </div>
          )}
          <div
            style={{
              color: "#ffffff",
              fontSize: 72,
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              display: "flex"
            }}
          >
            {name}
          </div>
          <div
            style={{
              color: "#d4d4d4",
              fontSize: 32,
              fontWeight: 500,
              letterSpacing: "-0.01em",
              display: "flex"
            }}
          >
            {trade} · {city}
          </div>
          <div
            style={{
              color: "#facc15",
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              display: "flex"
            }}
          >
            Hammerex Trade Off
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
