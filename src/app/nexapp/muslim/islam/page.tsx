// src/app/nexapp/muslim/islam/page.tsx
//
// Design preview · Seven-door Qur'an/Islam destination (Philip 2026-09-01).
//
// One of NEX's major destinations · seven doors inside it · sits within
// the larger NEX Indonesian daily-life system · user can leave and go
// back to everyday NEX conversation seamlessly. UI mockup only · no
// backend wiring · no licensed content · every source label illustrative.
//
// Uses NEX HUD aesthetic (dark #050505 · cyan #4ac9ff accent) so it
// feels like NEX, not a bolted-on religious app.

import Link from "next/link";

export const dynamic = "force-static";
export const metadata = {
  title: "NEX · Qur'an & Islam (Preview)",
  robots: { index: false, follow: false },
};

type Door = {
  emoji: string;
  label: string;
  labelEn: string;
  sub: string;
  accent?: boolean;
};

const DOORS: Door[] = [
  { emoji: "📖", label: "Baca",       labelEn: "Read",       sub: "Qur'an · terjemahan · dengar" },
  { emoji: "🧠", label: "Pelajari",   labelEn: "Learn",      sub: "Pertanyaan · penjelasan · pelajaran" },
  { emoji: "🕌", label: "Salat",      labelEn: "Pray",       sub: "Waktu · pengingat · panduan", accent: true },
  { emoji: "🎓", label: "Sekolah",    labelEn: "School",     sub: "Materi anak · kontrol orang tua/guru" },
  { emoji: "💬", label: "Tanya NEX",  labelEn: "Ask NEX",    sub: "\"Kenapa ayat ini...?\" · sumber terlihat" },
  { emoji: "🌙", label: "Hidup",      labelEn: "Daily Life", sub: "Ramadan · keluarga · makan · perjalanan" },
  { emoji: "❤️", label: "Renung",    labelEn: "Reflect",    sub: "Baca tenang · teman ngobrol" },
];

export default function IslamDestinationPreview() {
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
          background:     "rgba(5, 5, 5, 0.85)",
          backdropFilter: "blur(8px)",
          color:          "rgba(245, 245, 245, 0.55)",
          borderBottom:   "1px solid rgba(255, 255, 255, 0.06)",
        }}
      >
        <span>DESIGN PREVIEW · placeholder · sumber & lisensi belum aktif</span>
      </div>

      <div className="mx-auto max-w-[560px] px-6 pt-6 pb-32">
        {/* Header · thin friendly · back-link goes to elder-user landing
            so it feels like drilling down, not app-switching. */}
        <div className="mb-6 flex items-center gap-3">
          <Link
            href="/nexapp/muslim"
            className="flex h-9 w-9 items-center justify-center rounded-full text-[18px]"
            style={{
              color:      "rgba(245, 245, 245, 0.6)",
              background: "rgba(255, 255, 255, 0.04)",
              textDecoration: "none",
            }}
            aria-label="Kembali"
          >
            ‹
          </Link>
          <div
            className="flex h-10 w-10 items-center justify-center rounded-full text-[20px]"
            style={{
              background: "rgba(74, 201, 255, 0.10)",
              boxShadow:  "0 0 0 1px rgba(74, 201, 255, 0.20) inset",
            }}
            aria-hidden
          >
            📖
          </div>
          <div>
            <div className="text-[12px] leading-tight" style={{ color: "rgba(245, 245, 245, 0.5)" }}>
              NEX
            </div>
            <div className="text-[19px] font-medium leading-tight" style={{ color: "#FFFFFF" }}>
              Qur'an & Islam
            </div>
          </div>
        </div>

        <h1
          className="mb-1 text-[24px] font-medium leading-snug"
          style={{ color: "#FFFFFF", letterSpacing: "-0.01em" }}
        >
          Mau mulai dari mana?
        </h1>
        <p className="mb-8 text-[14px] leading-snug" style={{ color: "rgba(245, 245, 245, 0.55)" }}>
          Tujuh pintu · pilih satu · atau tanya NEX langsung
        </p>

        {/* Seven doors · natural mobile-first 2-col grid. */}
        <div className="grid grid-cols-2 gap-3">
          {DOORS.map((door) => (
            <a
              key={door.labelEn}
              href="#"
              className="flex flex-col gap-2 rounded-2xl px-4 py-5 transition-transform active:scale-[0.98]"
              style={{
                background: door.accent
                  ? "rgba(74, 201, 255, 0.08)"
                  : "rgba(255, 255, 255, 0.03)",
                border: door.accent
                  ? "1px solid rgba(74, 201, 255, 0.30)"
                  : "1px solid rgba(255, 255, 255, 0.08)",
                minHeight:      128,
                textDecoration: "none",
                color:          "#F5F5F5",
              }}
            >
              <div className="text-[28px] leading-none" aria-hidden>{door.emoji}</div>
              <div>
                <div className="text-[16px] font-medium leading-tight" style={{ color: "#FFFFFF" }}>
                  {door.label}
                  <span
                    className="ml-2 text-[11px] font-normal"
                    style={{ color: "rgba(245, 245, 245, 0.4)" }}
                  >
                    {door.labelEn}
                  </span>
                </div>
                <div
                  className="mt-1 text-[12.5px] leading-tight"
                  style={{ color: "rgba(245, 245, 245, 0.55)" }}
                >
                  {door.sub}
                </div>
              </div>
            </a>
          ))}

          {/* 8th cell · connects back to everyday NEX conversation.
              Architectural point: Islamic destination is NOT an island. */}
          <a
            href="/nexapp"
            className="flex flex-col justify-between gap-2 rounded-2xl px-4 py-5 transition-transform active:scale-[0.98]"
            style={{
              background:     "transparent",
              border:         "1px dashed rgba(255, 255, 255, 0.20)",
              minHeight:      128,
              textDecoration: "none",
              color:          "#F5F5F5",
            }}
          >
            <div className="text-[24px] leading-none" aria-hidden>💭</div>
            <div>
              <div className="text-[15px] font-medium leading-tight" style={{ color: "#F5F5F5" }}>
                Lanjut ngobrol
              </div>
              <div className="mt-1 text-[12px] leading-tight" style={{ color: "rgba(245, 245, 245, 0.5)" }}>
                Kembali ke percakapan NEX
              </div>
            </div>
          </a>
        </div>

        {/* Illustrative source-stack preview · visual contract for
            future retrieved answers per Source Audit doctrine.
            All content placeholder · sources unlicensed yet. */}
        <div
          className="mt-8 rounded-2xl p-5"
          style={{
            background: "rgba(255, 255, 255, 0.03)",
            border:     "1px solid rgba(255, 255, 255, 0.08)",
          }}
        >
          <div className="mb-3 flex items-center gap-2 text-[11px] font-medium tracking-wide" style={{ color: "rgba(245, 245, 245, 0.5)" }}>
            <span>CONTOH TAMPILAN JAWABAN · PLACEHOLDER</span>
          </div>
          <div className="mb-3 text-[15px]" style={{ color: "#FFFFFF" }}>
            &ldquo;Apa arti surat Al-Fatihah?&rdquo;
          </div>

          <div className="space-y-3">
            <SourceRow icon="📖" tier="Qur'an"        body="[Arabic text placeholder]"                                                       meta="Al-Fatihah 1 · Mushaf Standar Indonesia" />
            <SourceRow icon="🇮🇩" tier="Terjemahan"    body="[Indonesian translation placeholder]"                                            meta="Kemenag/LPMQ · lisensi belum aktif" />
            <SourceRow icon="📚" tier="Tafsir"         body="[Tafsir excerpt placeholder]"                                                     meta="Nama tafsir · nama ulama" />
            <SourceRow icon="🏛️" tier="Panduan ID"     body="[Guidance excerpt · jika relevan]"                                                meta="Kemenag / MUI / NU / Muhammadiyah" />
            <SourceRow icon="💬" tier="Ringkasan NEX"  body="[Simplified explanation labelled as NEX summary, never authoritative]"           meta="Bukan otoritas · rujuk sumber di atas" muted />
          </div>
        </div>

        {/* Constitutional footer note. */}
        <p
          className="mt-6 px-2 text-center text-[12px] leading-snug"
          style={{ color: "rgba(245, 245, 245, 0.4)" }}
        >
          NEX bantu kamu memahami sumber dan penjelasan ulama.
          Untuk hukum agama yang penting, tanya ustaz atau ahli yang terpercaya.
        </p>
      </div>
    </div>
  );
}

// ─── Local source-row component (dark-theme variant) ────────────────

function SourceRow({
  icon,
  tier,
  body,
  meta,
  muted,
}: {
  icon: string;
  tier: string;
  body: string;
  meta: string;
  muted?: boolean;
}) {
  return (
    <div
      className="rounded-xl px-4 py-3"
      style={{
        background: muted ? "rgba(255, 255, 255, 0.02)" : "transparent",
        border:     `1px solid ${muted ? "rgba(255, 255, 255, 0.08)" : "rgba(255, 255, 255, 0.05)"}`,
      }}
    >
      <div className="mb-1 flex items-center gap-2 text-[11px] font-medium tracking-wide" style={{ color: "rgba(245, 245, 245, 0.5)" }}>
        <span aria-hidden>{icon}</span>
        <span>{tier}</span>
      </div>
      <div className="text-[14px] leading-snug" style={{ color: muted ? "rgba(245, 245, 245, 0.7)" : "#F5F5F5" }}>
        {body}
      </div>
      <div className="mt-1 text-[11.5px] leading-tight" style={{ color: "rgba(245, 245, 245, 0.4)" }}>
        {meta}
      </div>
    </div>
  );
}
