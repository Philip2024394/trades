// src/app/nexapp/muslim/page.tsx
//
// Design preview · Elder-user Indonesian daily-life landing (Philip 2026-09-01).
//
// Standalone preview page (does NOT mount NexAppShell HUD frame · so
// the mockup lays out cleanly at any viewport for design review).
// Uses NEX HUD aesthetic (dark #050505 · cyan #4ac9ff accent · white
// text) so it feels like NEX, not a bolted-on religious app.
//
// NO backend wiring · NO licensed content · every card is placeholder ·
// clearly banner-marked as design preview.

export const dynamic = "force-static";
export const metadata = {
  title: "NEX · Muslim (Preview)",
  robots: { index: false, follow: false },
};

export default function ElderUserLandingPreview() {
  const nowHour = new Date().getHours();
  const timeGreeting =
    nowHour < 11 ? "Selamat pagi" :
    nowHour < 15 ? "Selamat siang" :
    nowHour < 18 ? "Selamat sore" :
                   "Selamat malam";

  const destinations = [
    { emoji: "🕌", label: "Salat",      sub: "Waktu · pengingat · panduan",   href: "/nexapp/muslim/islam" },
    { emoji: "📖", label: "Qur'an",     sub: "Baca · dengar · pelajari",       href: "/nexapp/muslim/islam" },
    { emoji: "🚕", label: "Perjalanan",  sub: "Panggil kendaraan",             href: "#" },
    { emoji: "📍", label: "Sekitar",    sub: "Cari yang dekat",                href: "#" },
    { emoji: "💬", label: "Tanya NEX",  sub: "Ngobrol seperti biasa",          href: "/nexapp" },
  ];

  return (
    <div
      className="min-h-dvh w-full"
      style={{
        background:    "#050505",
        color:         "#F5F5F5",
        paddingTop:    "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
        fontFamily:    "Inter, system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Design-preview banner. */}
      <div
        className="sticky top-0 z-20 flex items-center justify-center gap-2 px-4 py-2 text-[11px] font-medium tracking-wide"
        style={{
          background:   "rgba(5, 5, 5, 0.85)",
          backdropFilter: "blur(8px)",
          color:        "rgba(245, 245, 245, 0.55)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
        }}
      >
        <span>DESIGN PREVIEW · placeholder · licensing pending</span>
      </div>

      <div className="mx-auto max-w-[560px] px-6 pt-10 pb-32">
        {/* Header · NEX identity + time-aware greeting.
            Cyan accent matches HUD orb + rail. */}
        <div className="mb-10 flex items-center gap-3">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-full text-[16px] font-bold"
            style={{
              background: "rgba(74, 201, 255, 0.14)",
              color:      "#4AC9FF",
              boxShadow:  "0 0 0 1px rgba(74, 201, 255, 0.35) inset",
            }}
            aria-hidden
          >
            N
          </div>
          <div>
            <div className="text-[12px] leading-tight" style={{ color: "rgba(245, 245, 245, 0.5)" }}>
              NEX
            </div>
            <div className="text-[18px] font-medium leading-tight" style={{ color: "#F5F5F5" }}>
              {timeGreeting}, Pak
            </div>
          </div>
        </div>

        {/* Prompt · large voice-first hint. */}
        <h1
          className="mb-2 text-[26px] font-medium leading-snug"
          style={{ color: "#FFFFFF", letterSpacing: "-0.01em" }}
        >
          Mau ngapain hari ini?
        </h1>
        <p className="mb-8 text-[15px] leading-snug" style={{ color: "rgba(245, 245, 245, 0.55)" }}>
          Tekan salah satu · atau ngomong aja
        </p>

        {/* Five main destinations · large elder-friendly cards. */}
        <div className="grid gap-3">
          {destinations.map((d) => (
            <a
              key={d.label}
              href={d.href}
              className="flex items-center gap-4 rounded-2xl px-5 py-5 transition-transform active:scale-[0.98]"
              style={{
                background:   "rgba(255, 255, 255, 0.03)",
                border:       "1px solid rgba(255, 255, 255, 0.08)",
                minHeight:    88,
                textDecoration: "none",
                color:        "#F5F5F5",
              }}
            >
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-[26px]"
                style={{
                  background: "rgba(74, 201, 255, 0.10)",
                  boxShadow:  "0 0 0 1px rgba(74, 201, 255, 0.20) inset",
                }}
              >
                {d.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[19px] font-medium leading-tight" style={{ color: "#FFFFFF" }}>
                  {d.label}
                </div>
                <div className="text-[14px] leading-tight mt-1" style={{ color: "rgba(245, 245, 245, 0.55)" }}>
                  {d.sub}
                </div>
              </div>
              <span aria-hidden className="text-[20px]" style={{ color: "rgba(245, 245, 245, 0.35)" }}>
                ›
              </span>
            </a>
          ))}
        </div>

        {/* Ambient prayer-time card · placeholder · opt-in only in production. */}
        <div
          className="mt-8 flex items-center gap-3 rounded-xl px-4 py-3"
          style={{
            background: "rgba(255, 255, 255, 0.02)",
            border:     "1px dashed rgba(255, 255, 255, 0.15)",
          }}
        >
          <div className="text-[22px]" aria-hidden>🕌</div>
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-medium" style={{ color: "#F5F5F5" }}>
              Maghrib · 22 menit lagi
            </div>
            <div className="text-[12px] leading-tight" style={{ color: "rgba(245, 245, 245, 0.5)" }}>
              Yogyakarta · placeholder · pengingat aktif jika kamu mau
            </div>
          </div>
        </div>

        {/* Voice-first hint. */}
        <div className="mt-10 flex items-center justify-center gap-2 text-[13px]" style={{ color: "rgba(245, 245, 245, 0.5)" }}>
          <span
            aria-hidden
            style={{
              display:      "inline-block",
              width:        10,
              height:       10,
              borderRadius: 999,
              background:   "#4AC9FF",
              boxShadow:    "0 0 12px rgba(74, 201, 255, 0.5)",
            }}
          />
          <span>Tekan mic buat ngomong langsung</span>
        </div>
      </div>
    </div>
  );
}
