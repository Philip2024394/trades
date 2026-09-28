// src/lib/nex-native/i18n/safe-trade-strings.ts
//
// Bridge 16c · Bilingual copy for the safe-trade surfaces.
// --------------------------------------------------------
// The consent modal and the terms page are the load-bearing legal
// surfaces. Users in Indonesia should see Bahasa Indonesia by
// default · we expose both languages via a single strings map so
// callers pick with resolveLocale() and pluck the key they need.
//
// This is a minimal in-source i18n approach · no framework, no
// runtime bundle, no server round-trips. When translation volume
// grows we can lift into a proper i18n library, but for the ~30
// legal strings we ship today it would be over-engineering.
//
// Doctrine: the terms + modal wording is legally load-bearing ·
// changes here should be authorised (or reviewed) by Founder
// Philip before release. Translation done 2026-09-28 · reviewer
// pass by a native speaker queued.

export type NexLocale = "id" | "en";

/** Resolve locale with clear precedence (highest wins):
 *   1. URL ?lang=id|en  · explicit override
 *   2. accountLocale     · signed-in user's stored preference (Bridge 16d · migration 071)
 *   3. Accept-Language header  · browser hint
 *   4. 'id'              · pilot-market default (Indonesian)
 */
export function resolveLocale(input: {
  urlParam?: string | null;
  accountLocale?: string | null;
  acceptLanguage?: string | null;
}): NexLocale {
  const p = (input.urlParam ?? "").toLowerCase().trim();
  if (p === "id" || p === "en") return p as NexLocale;
  const acc = (input.accountLocale ?? "").toLowerCase().trim();
  if (acc === "id" || acc === "en") return acc as NexLocale;
  const al = (input.acceptLanguage ?? "").toLowerCase();
  const first = al.split(",")[0]?.split(";")[0]?.trim() ?? "";
  if (first.startsWith("en")) return "en";
  return "id";
}

/** Report modal strings · consumed by the peer chat report
 *  affordance. Bilingual to match the consent modal. */
export const REPORT_STRINGS = {
  id: {
    trigger: "Laporkan",
    title: "Laporkan {name}",
    lede: "Setiap laporan berisi cuplikan otomatis percakapan · pengulas manual dalam 48 jam.",
    reason_label: "Alasan",
    note_label: "Detail tambahan (opsional)",
    note_placeholder: "Ceritakan apa yang terjadi · sertakan detail transaksi kalau ada",
    submit: "Kirim laporan",
    cancel: "Batal",
    disclaimer:
      "Laporan bersifat permanen · tidak bisa dihapus. Laporan palsu / tit-for-tat bisa mengakibatkan akun kamu ditinjau ulang. Baca:",
    reasons: {
      scam: {
        label: "Penipuan atau kecurangan",
        blurb:
          "Sudah bayar tapi barang tidak dikirim · kirim barang palsu / KW · berbohong tentang barang",
      },
      harassment: {
        label: "Pelecehan atau ancaman",
        blurb:
          "Kasar secara verbal · mengancam · terus menghubungi setelah kamu minta berhenti",
      },
      prohibited_goods: {
        label: "Barang terlarang",
        blurb:
          "Barang ilegal · narkoba · senjata · satwa dilindungi · uang palsu · barang curian",
      },
      impersonation: {
        label: "Pemalsuan identitas",
        blurb:
          "Berpura-pura jadi orang lain · pakai foto/nama orang tanpa izin",
      },
      spam: {
        label: "Spam",
        blurb: "Pesan promosi tidak diinginkan · phishing · perilaku seperti bot",
      },
      off_doctrine_payment: {
        label: "Memaksa pembayaran di luar jalur",
        blurb:
          "Menekan kamu untuk transfer langsung ke rekening / QR / e-wallet sebelum barang diterima · menolak COD atau Rekber",
      },
      other: {
        label: "Yang lain",
        blurb:
          "Jelaskan di kolom catatan · pengulas akan menghubungi kalau perlu",
      },
    },
  },
  en: {
    trigger: "Report",
    title: "Report {name}",
    lede: "Every report captures a chat snapshot automatically · manually reviewed within 48h.",
    reason_label: "Reason",
    note_label: "Extra detail (optional)",
    note_placeholder:
      "Tell us what happened · include transaction details if any",
    submit: "Send report",
    cancel: "Cancel",
    disclaimer:
      "Reports are permanent · cannot be deleted. False / retaliatory reports may result in your own account being reviewed. Read:",
    reasons: {
      scam: {
        label: "Scam or fraud",
        blurb:
          "Took money and didn't ship · sent counterfeit / fake · lied about the item",
      },
      harassment: {
        label: "Harassment or threats",
        blurb:
          "Verbally abusive · threatening · repeatedly contacting you after you asked them to stop",
      },
      prohibited_goods: {
        label: "Prohibited goods",
        blurb:
          "Illegal items · drugs · weapons · endangered wildlife · counterfeit currency · stolen goods",
      },
      impersonation: {
        label: "Impersonation",
        blurb:
          "Pretending to be someone else · using a real person's photo/name without permission",
      },
      spam: {
        label: "Spam",
        blurb:
          "Unwanted promotional messages · phishing · bot-like behaviour",
      },
      off_doctrine_payment: {
        label: "Off-doctrine payment demand",
        blurb:
          "Pressuring you to pay direct bank / QR / e-wallet before delivery · refuses COD or escrow",
      },
      other: {
        label: "Something else",
        blurb: "Explain in the note field · reviewer will follow up if needed",
      },
    },
  },
} as const;

export type ReportStringsLocale = (typeof REPORT_STRINGS)["id"];

/** Safe-trade strings · consumed by consent modal, terms page hero,
 *  and shop-landing chip strip labels. */
export const SAFE_TRADE_STRINGS = {
  id: {
    /* --- consent modal ---------------------------------------------- */
    modal_eyebrow: "🛡 Sebelum kamu mulai",
    modal_title: "Bagaimana NEX menjaga kamu tetap aman.",
    modal_lede:
      "Di NEX, <b>kamu tidak pernah bayar sebelum menerima barang</b> · kecuali pihak ketiga yang kamu percaya (Rekber / Xendit / PayPal) yang memegang uangnya. Lima jalur aman:",
    modal_paths_short: "COD · QRIS saat terima · COD kurir · Ketemuan · Rekber",
    modal_warning_eyebrow: "⚠ Apa artinya untuk kamu",
    modal_warning_body:
      "Kalau kamu kirim uang ke penjual <b>di luar lima jalur ini</b> (misalnya transfer langsung ke rekening pribadi mereka sebelum barang diterima), <b>NEX tidak bisa bantu kamu mengembalikan uang</b>. Itu keputusan kamu · bukan sesuatu yang NEX bisa fasilitasi.",
    modal_read_terms: "Baca ketentuan lengkap:",
    modal_terms_link: "/nex-native/terms",
    modal_safe_trade_link: "Penjelasan Aman Bertransaksi",
    modal_checkbox_label:
      "Saya mengerti · Saya akan gunakan salah satu dari lima jalur pembayaran yang didukung NEX, dan saya menerima bahwa pembayaran di luar jalur tidak dilindungi atau dimediasi oleh dukungan NEX.",
    modal_submit: "🛡 Setuju · masuk chat",
    modal_version_prefix: "Versi",

    /* --- terms page hero -------------------------------------------- */
    terms_eyebrow: "Ketentuan Layanan NEX",
    terms_title: "Aturan sederhana untuk tempat yang adil.",
    terms_lede_prefix: "Versi",
    terms_lede_middle: "· Ditetapkan 2026-09-28 · Dengan menggunakan NEX, kamu setuju dengan hal-hal di bawah.",

    /* --- one-line promise (used at bottom of terms + safe-trade) ---- */
    promise_line1: "Kamu tidak pernah bayar sebelum menerima",
    promise_line2: "kecuali pihak ketiga yang kamu percaya memegang uangnya.",
    promise_eyebrow: "🛡 Janji satu baris",
  },
  en: {
    /* --- consent modal ---------------------------------------------- */
    modal_eyebrow: "🛡 Before you start",
    modal_title: "How NEX keeps you safe.",
    modal_lede:
      "On NEX, <b>you never pay before you receive</b> · unless a third party you trust (Rekber / Xendit / PayPal) is holding the money. Five safe paths:",
    modal_paths_short:
      "COD · QRIS on delivery · Courier COD · Meet in person · Escrow",
    modal_warning_eyebrow: "⚠ What this means for you",
    modal_warning_body:
      "If you send money to a seller <b>outside these five paths</b> (for example, direct bank transfer to their private account before delivery), <b>NEX support cannot help you recover it</b>. That is your choice, not something NEX will mediate.",
    modal_read_terms: "Read the full terms:",
    modal_terms_link: "/nex-native/terms",
    modal_safe_trade_link: "Safe trade explainer",
    modal_checkbox_label:
      "I understand · I will use one of the five NEX-supported payment paths, and I accept that off-path payments are not protected or mediated by NEX support.",
    modal_submit: "🛡 Agree · enter chat",
    modal_version_prefix: "Version",

    /* --- terms page hero -------------------------------------------- */
    terms_eyebrow: "NEX terms of service",
    terms_title: "Plain rules for a fair place.",
    terms_lede_prefix: "Version",
    terms_lede_middle: "· Sealed 2026-09-28 · By using NEX you agree to what's below.",

    /* --- one-line promise ------------------------------------------- */
    promise_line1: "You never pay before you receive",
    promise_line2: "unless a third party you trust is holding the money.",
    promise_eyebrow: "🛡 The one-line promise",
  },
} as const;

export type SafeTradeStrings = (typeof SAFE_TRADE_STRINGS)["id"];

/** Full terms body · every numbered section in both languages.
 *  Translation done 2026-09-28 · native-speaker legal review still
 *  queued (mark as v1). Kept in this file so the terms page can
 *  read the same map and stay in sync when we bump versions. */
export const TERMS_STRINGS = {
  id: {
    hero_eyebrow: "Ketentuan Layanan NEX",
    hero_title: "Aturan sederhana untuk tempat yang adil.",
    hero_version_prefix: "Versi",
    hero_version_suffix: "· Ditetapkan 2026-09-28 · Dengan menggunakan NEX, kamu setuju dengan yang di bawah.",
    s1: {
      badge: "Bagian 1",
      title: "Bagaimana uang bekerja di NEX",
      body_html: `<p><b>NEX bukan platform pembayaran.</b> NEX tidak punya dompet, tidak punya escrow, tidak ada biaya pemrosesan, tidak menyimpan detail kartu, dan tidak bisa memungut, menyimpan, atau memindahkan uang atas nama pengguna manapun.</p>
<p>Kamu membayar penjual <b>secara langsung</b>, atau kamu membayar ke <b>penyedia escrow pihak ketiga</b> yang disepakati bersama penjual. NEX hanya menyimpan catatan percakapan.</p>
<p>NEX mengenakan <b>komisi 0%</b> atas penjualan, di kedua tier Gratis dan Bisnis, selamanya. Ini mungkin <em>karena</em> NEX tidak pernah menyentuh uangmu · dua fakta itu adalah satu fakta yang sama.</p>`,
    },
    s2: {
      badge: "Bagian 2",
      title: "Lima jalur pembayaran yang didukung NEX",
      body_html: `<p>Ketika kamu pakai NEX, kami merekomendasikan dan mendukung lima jalur ini · dan hanya lima ini. Semuanya memenuhi satu aturan: <b>kamu tidak pernah bayar sebelum menerima, kecuali pihak ketiga yang kamu percaya memegang uangnya.</b></p>
<ul>
<li><b>💵 Cash on Delivery (COD)</b> · driver mengambil uang tunai rupiah saat menyerahkan paket ke kamu.</li>
<li><b>📱 QRIS saat Terima</b> · kamu memindai QR penjual atau driver saat paket tiba.</li>
<li><b>📦 Courier COD</b> · JNE / J&amp;T / SiCepat / AnterAja mengambil pembayaran saat pengiriman dan meneruskannya ke penjual · kurir bertindak sebagai escrow informal.</li>
<li><b>🤝 Ketemu Langsung</b> · kamu datang ke penjual, periksa barang, dan bayar tunai di tempat.</li>
<li><b>🔒 Escrow (Rekber / Xendit / Midtrans / DOKU / PayPal G&amp;S)</b> · kamu transfer ke penyedia escrow, mereka tahan, penjual kirim, kamu konfirmasi, mereka melepaskan.</li>
</ul>
<p>Penjelasan lengkap di /nex-native/safe-trade.</p>`,
    },
    s3: {
      badge: "Bagian 3",
      title: "Yang TIDAK akan dimediasi NEX",
      tone: "critical" as const,
      body_html: `<p>Kalau kamu memilih membayar penjual dengan cara <b>di luar daftar bagian 2</b> — misalnya, transfer langsung ke rekening pribadi atau e-wallet penjual sebelum menerima barang — <b>dukungan NEX tidak akan turun tangan dalam sengketa terkait pembayaran itu</b>.</p>
<p>Secara spesifik, NEX TIDAK akan:</p>
<ul>
<li>Mengembalikan uangmu</li>
<li>Menagih penjual untuk pengembalian</li>
<li>Menghubungi bank penjual</li>
<li>Mengajukan laporan polisi atas namamu</li>
<li>Mediasi sengketa pembayaran di luar jalur yang didukung</li>
</ul>
<p>NEX akan tetap menyimpan percakapan sebagai bukti. Kamu bisa menggunakan log percakapan itu sendiri untuk mengajukan sengketa bank, laporan polisi, atau klaim perdata di bawah hukum perlindungan konsumen Indonesia · tetapi keputusan bayar di luar jalur, dan kerugian yang mengikutinya, adalah milikmu sendiri.</p>
<p>Ketika aplikasi mendeteksi penjual meminta pembayaran langsung sebelum pengiriman, kami tunjukkan peringatan merah di chat. Baca. Kalau kamu tetap melanjutkan, kamu setuju dengan bagian ini.</p>`,
    },
    s4: {
      badge: "Bagian 4",
      title: "Yang AKAN dibantu NEX",
      tone: "ok" as const,
      body_html: `<ul>
<li>Melaporkan penjual yang menipu atau mengirim barang palsu · kami menangguhkan listing mereka setelah cukup laporan diverifikasi.</li>
<li>Membuat cuplikan percakapan sebagai bukti untuk laporan atau sengketa · ekspor sekali tap seluruh percakapan.</li>
<li>Bug di NEX sendiri · apapun yang memutus janji di bagian 1, bagian 2, atau bagian 8 (privasi).</li>
<li>Pertanyaan tagihan tentang langganan NEX kamu (Bisnis).</li>
</ul>`,
    },
    s5: {
      badge: "Bagian 5",
      title: "Apa yang NEX bebankan",
      body_html: `<p><b>NEX Gratis · Rp 0/bulan selamanya.</b> Tanpa komisi, tanpa biaya listing, tanpa biaya chat.</p>
<p><b>NEX Bisnis · Rp 99.000/bulan</b> (atau Rp 990.000/tahun). Buka ekspor internasional, badge terverifikasi, chip unggulan, batas tak terbatas, dan hingga lima bisnis dalam satu akun. Tetap komisi 0% atas penjualan. Langganan Bisnis sendiri dibayar via transfer bank atau e-wallet langsung ke rekening operasi NEX · kami tidak memproses pembayaran melalui jalur yang di-host NEX.</p>
<p>Detail lengkap di /nex-native/packages.</p>`,
    },
    s6: {
      badge: "Bagian 6",
      title: "Konten dan perilaku",
      body_html: `<p>Kamu setuju untuk tidak:</p>
<ul>
<li>Menjual barang ilegal · narkoba, senjata, satwa dilindungi, uang palsu, barang curian.</li>
<li>Menyamar sebagai orang lain · penjual harus berdagang dengan identitas asli atau nama bisnis yang dinyatakan jelas.</li>
<li>Melecehkan, mengancam, atau menipu pengguna lain.</li>
<li>Memposting spam, virus, link phishing, atau malware.</li>
<li>Meminta pembeli memindahkan pembayaran keluar NEX ke saluran yang tidak aman (misalnya "transfer ke WhatsApp saya lalu hapus chat ini").</li>
<li>Menyiasati doktrin aman-bertransaksi dengan menekan pembeli untuk bayar di luar jalur · kami memperlakukan ini sebagai sinyal penipuan.</li>
</ul>
<p>Pelanggaran mengakibatkan listing ditangguhkan, lalu akun ditangguhkan. Pelanggar berulang dibanned permanen. NEX bekerja sama dengan penegak hukum Indonesia bila diperlukan.</p>`,
    },
    s7: {
      badge: "Bagian 7",
      title: "Ulasan dan reputasi",
      body_html: `<p>Pembeli boleh meninggalkan ulasan setelah setiap pesanan. Ulasan bersifat permanen · tidak bisa dihapus oleh penjual. Ulasan palsu (ulasan berbayar, ulasan balas dendam, ulasan bot) dapat dilaporkan dan dihapus. Penjual boleh menanggapi ulasan secara publik tapi tidak bisa menekannya.</p>`,
    },
    s8: {
      badge: "Bagian 8",
      title: "Data kamu",
      body_html: `<p>NEX menyimpan detail akunmu, chat kamu (peer-to-peer, dienkripsi saat istirahat oleh Supabase), listing kamu, dan sinyal aktivitasmu (terakhir dilihat, waktu respon). Kami tidak menjual data kamu. Kami tidak membagikan chat kamu ke pihak ketiga kecuali diperintahkan oleh perintah pengadilan Indonesia.</p>
<p>Kamu bisa meminta ekspor data lengkap kapan saja lewat dukungan. Kamu bisa menghapus akunmu · setelah 30 hari akunmu dihapus, listingmu diarsipkan, chat disimpan (kedua sisi butuh sebagai bukti).</p>`,
    },
    s9: {
      badge: "Bagian 9",
      title: "Kapan kami memperbarui ketentuan ini",
      body_html: `<p>Ketika doktrin aman-bertransaksi atau ketentuan material berubah, kami menaikkan nomor versi di bagian atas halaman ini dan menampilkan kembali modal persetujuan segar untuk setiap pengguna pada tindakan komersial berikutnya. Kamu akan selalu tahu yang kamu setujui dan kapan.</p>
<p>Versi historis dipertahankan dalam riwayat git repositori NEX · kedua pihak bisa kembali dan memeriksa apa yang berlaku ketika transaksi mereka terjadi.</p>`,
    },
    s10: {
      badge: "Bagian 10",
      title: "Hukum yang berlaku dan kontak",
      body_html: `<p>Ketentuan ini diatur oleh hukum Republik Indonesia. Sengketa yang tidak diselesaikan oleh dukungan NEX dapat diajukan ke pengadilan Indonesia yang sesuai.</p>
<p>Pertanyaan tentang ketentuan ini: hubungi lewat saluran dukungan NEX atau email hello at nex.id (sementara · alamat produksi TBD).</p>`,
    },
  },
  en: {
    hero_eyebrow: "NEX terms of service",
    hero_title: "Plain rules for a fair place.",
    hero_version_prefix: "Version",
    hero_version_suffix: "· Sealed 2026-09-28 · By using NEX you agree to what's below.",
    s1: {
      badge: "Section 1",
      title: "How money works on NEX",
      body_html: `<p><b>NEX is not a payment platform.</b> NEX has no wallet, no escrow, no processing fee, no stored card details, and no way to collect, hold, or move money on behalf of any user.</p>
<p>You pay the seller <b>directly</b>, or you pay a <b>third-party escrow provider</b> the seller and you both agree on. NEX only holds the conversation record.</p>
<p>NEX charges <b>0% commission</b> on sales, on both Gratis and Bisnis tiers, forever. This is possible <em>because</em> NEX never touches your money · the two facts are the same fact.</p>`,
    },
    s2: {
      badge: "Section 2",
      title: "The five NEX-supported payment paths",
      body_html: `<p>When you use NEX, we recommend and support these five paths, and only these five. All of them satisfy one rule: <b>you never pay before you receive, unless a third party you trust is holding the money.</b></p>
<ul>
<li><b>💵 Cash on Delivery (COD)</b> · driver collects rupiah cash when they hand you the package.</li>
<li><b>📱 QRIS on Delivery</b> · you scan the seller's or driver's QR code when the package arrives.</li>
<li><b>📦 Courier COD</b> · JNE / J&amp;T / SiCepat / AnterAja collects on delivery and remits to the seller · the courier acts as informal escrow.</li>
<li><b>🤝 Meet in Person</b> · you visit the seller, inspect the item, and pay cash on the spot.</li>
<li><b>🔒 Escrow (Rekber / Xendit / Midtrans / DOKU / PayPal G&amp;S)</b> · you transfer to the escrow provider, they hold, seller ships, you confirm, they release.</li>
</ul>
<p>Full breakdown at /nex-native/safe-trade.</p>`,
    },
    s3: {
      badge: "Section 3",
      title: "What NEX will NOT mediate",
      tone: "critical" as const,
      body_html: `<p>If you choose to pay a seller using any method <b>not on the list in section 2</b> — for example, transferring directly to a seller's private bank account or e-wallet before receiving the goods — <b>NEX support will not intervene in disputes about that payment</b>.</p>
<p>Specifically, NEX will NOT:</p>
<ul>
<li>Refund you</li>
<li>Chase the seller for repayment</li>
<li>Contact the seller's bank</li>
<li>File a police report on your behalf</li>
<li>Mediate a dispute over an off-doctrine payment</li>
</ul>
<p>NEX will still preserve the conversation as evidence. You may use the chat log yourself to file a bank dispute, police report, or civil claim under Indonesian consumer protection law · but the choice to pay off-doctrine, and any loss that follows, is yours alone.</p>
<p>When the app detects a seller asking for direct payment before delivery, we show you a red warning in the chat. Read it. If you proceed anyway, you have agreed to this section.</p>`,
    },
    s4: {
      badge: "Section 4",
      title: "What NEX will help with",
      tone: "ok" as const,
      body_html: `<ul>
<li>Reporting a seller who scams or ships gross fakes · we suspend their listings after enough verified reports.</li>
<li>Snapshotting a conversation as evidence when you file a report or dispute · one-tap export of the full chat.</li>
<li>Bugs in NEX itself · anything that breaks the promise in section 1, section 2, or section 8 (privacy).</li>
<li>Billing questions about your own NEX subscription (Bisnis).</li>
</ul>`,
    },
    s5: {
      badge: "Section 5",
      title: "What NEX charges",
      body_html: `<p><b>NEX Gratis · Rp 0/mo forever.</b> No commission, no listing fee, no chat fee.</p>
<p><b>NEX Bisnis · Rp 99,000/mo</b> (or Rp 990,000/year). Unlocks international export, verified badge, featured chip, unlimited caps, and up to five businesses under one account. Still 0% commission on sales. The Bisnis subscription itself is paid via bank transfer or e-wallet directly to the NEX operating account · we do not process the payment through a NEX-hosted rail.</p>
<p>Full details at /nex-native/packages.</p>`,
    },
    s6: {
      badge: "Section 6",
      title: "Content and conduct",
      body_html: `<p>You agree not to:</p>
<ul>
<li>Sell illegal goods · drugs, weapons, endangered wildlife, counterfeit currency, stolen goods.</li>
<li>Impersonate someone else · sellers must trade under their real identity or a clearly-declared business name.</li>
<li>Harass, threaten, or scam other users.</li>
<li>Post spam, viruses, phishing links, or malware.</li>
<li>Ask a buyer to move payment off NEX to a hostile channel (e.g. "transfer to my WhatsApp then delete this chat").</li>
<li>Circumvent the safe-trade doctrine by pressuring a buyer to pay off-doctrine · we treat this as a scam signal.</li>
</ul>
<p>Violations result in a suspended listing, then a suspended account. Repeat offenders are permanently banned. NEX cooperates with Indonesian law enforcement when required.</p>`,
    },
    s7: {
      badge: "Section 7",
      title: "Reviews and reputation",
      body_html: `<p>Buyers may leave a review after each order. Reviews are permanent · they cannot be deleted by the seller. False reviews (paid reviews, retaliatory reviews, bot reviews) can be reported and are removed. The seller may respond publicly to a review but cannot suppress it.</p>`,
    },
    s8: {
      badge: "Section 8",
      title: "Your data",
      body_html: `<p>NEX stores your account details, your chats (peer-to-peer, encrypted at rest by Supabase), your listings, and your activity signals (last seen, response time). We do not sell your data. We do not share your chats with third parties except when compelled by an Indonesian court order.</p>
<p>You can request a full data export at any time via support. You can delete your account · after 30 days your account is wiped, your listings archived, your chats retained (both sides need them as receipts).</p>`,
    },
    s9: {
      badge: "Section 9",
      title: "When we update these terms",
      body_html: `<p>When the safe-trade doctrine or any material term changes, we bump the version number at the top of this page and re-prompt every user with a fresh consent modal on their next commerce action. You will always know what you agreed to and when.</p>
<p>Historical versions are preserved in the git history of the NEX repository · both parties can go back and check what was in force when their trade happened.</p>`,
    },
    s10: {
      badge: "Section 10",
      title: "Governing law and contact",
      body_html: `<p>These terms are governed by the laws of the Republic of Indonesia. Disputes not resolved by NEX support may be filed with the appropriate Indonesian courts.</p>
<p>Questions about these terms: reach out via the NEX support channel or email hello at nex.id (placeholder · production address TBD).</p>`,
    },
  },
} as const;

export type TermsStrings = (typeof TERMS_STRINGS)["id"];
