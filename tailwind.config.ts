import type { Config } from "tailwindcss";

// Xrated Trades — Tailwind theme.
//
// Two theme layers coexist:
//   1. `brand.*`    — merchant/site-scoped palette (existing hammerex
//                     token pipeline). Live-swappable per brand.
//   2. `background / foreground / primary / muted / …`  — shadcn/ui
//      semantic tokens driving the platform-shell UI and every rebuilt
//      section (Phase 1 of the Loveable-quality initiative).
//
// The typography scale enforces a single set of steps across every
// rebuilt section. Never use raw pixel sizes — reach for the token.

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    // Consistent screen breakpoints across the shell + storefront.
    screens: {
      sm: "640px",
      md: "768px",
      lg: "1024px",
      xl: "1280px",
      "2xl": "1440px"
    },
    container: {
      center: true,
      padding: {
        DEFAULT: "1.25rem",
        sm: "1.5rem",
        lg: "2rem"
      },
      screens: {
        "2xl": "1400px"
      }
    },
    extend: {
      colors: {
        // ── Existing brand tokens (unchanged) ──
        brand: {
          bg: "rgb(var(--brand-bg) / <alpha-value>)",
          surface: "rgb(var(--brand-surface) / <alpha-value>)",
          line: "rgb(var(--brand-line) / <alpha-value>)",
          accent: "rgb(var(--brand-accent) / <alpha-value>)",
          accentSoft: "rgb(var(--brand-accent-soft) / <alpha-value>)",
          text: "rgb(var(--brand-text) / <alpha-value>)",
          muted: "rgb(var(--brand-muted) / <alpha-value>)",
          success: "rgb(var(--brand-success) / <alpha-value>)",
          whatsapp: "rgb(var(--brand-social-whatsapp) / <alpha-value>)",
          facebook: "rgb(var(--brand-social-facebook) / <alpha-value>)",
          x: "rgb(var(--brand-social-x) / <alpha-value>)"
        },

        // ── shadcn/ui semantic tokens (Phase 1) ──
        border: "hsl(var(--border) / <alpha-value>)",
        input: "hsl(var(--input) / <alpha-value>)",
        ring: "hsl(var(--ring) / <alpha-value>)",
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        primary: {
          DEFAULT: "hsl(var(--primary) / <alpha-value>)",
          foreground: "hsl(var(--primary-foreground) / <alpha-value>)"
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary) / <alpha-value>)",
          foreground: "hsl(var(--secondary-foreground) / <alpha-value>)"
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)"
        },
        muted: {
          DEFAULT: "hsl(var(--muted) / <alpha-value>)",
          foreground: "hsl(var(--muted-foreground) / <alpha-value>)"
        },
        accent: {
          DEFAULT: "hsl(var(--accent) / <alpha-value>)",
          foreground: "hsl(var(--accent-foreground) / <alpha-value>)"
        },
        popover: {
          DEFAULT: "hsl(var(--popover) / <alpha-value>)",
          foreground: "hsl(var(--popover-foreground) / <alpha-value>)"
        },
        card: {
          DEFAULT: "hsl(var(--card) / <alpha-value>)",
          foreground: "hsl(var(--card-foreground) / <alpha-value>)"
        }
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)"
      },
      fontFamily: {
        // Every rebuilt section uses `font-heading` and `font-body` —
        // the CSS variable resolves to whichever Google Font family
        // the active ThemeProvider preset picked. System-ui fallback
        // renders before the Google Font loads. Defaults hit Inter.
        heading: [
          "var(--font-heading, var(--font-inter))",
          "system-ui",
          "-apple-system",
          "sans-serif"
        ],
        body: [
          "var(--font-body, var(--font-inter))",
          "system-ui",
          "-apple-system",
          "sans-serif"
        ]
      },
      // ── Platform typography scale (Phase 1) ──
      // Every rebuilt section reaches for these. `display-*` are hero
      // scale. `heading-*` step down through H1-H6. `body-*` covers
      // paragraph, small, caption. All line-heights + letter-spacings
      // baked-in so no per-section drift.
      fontSize: {
        xs: ["13px", { lineHeight: "1.45" }],
        sm: ["14px", { lineHeight: "1.55" }],
        "display-2xl": ["72px", { lineHeight: "0.95", letterSpacing: "-0.03em" }],
        "display-xl": ["60px", { lineHeight: "1.0", letterSpacing: "-0.03em" }],
        "display-lg": ["48px", { lineHeight: "1.02", letterSpacing: "-0.025em" }],
        "display-md": ["36px", { lineHeight: "1.05", letterSpacing: "-0.02em" }],
        "display-sm": ["30px", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
        "heading-lg": ["24px", { lineHeight: "1.2", letterSpacing: "-0.015em" }],
        "heading-md": ["20px", { lineHeight: "1.3", letterSpacing: "-0.01em" }],
        "heading-sm": ["18px", { lineHeight: "1.35", letterSpacing: "-0.005em" }],
        "body-lg": ["17px", { lineHeight: "1.6" }],
        "body-md": ["15px", { lineHeight: "1.6" }],
        "body-sm": ["13px", { lineHeight: "1.55" }],
        caption: ["11px", { lineHeight: "1.45", letterSpacing: "0.02em" }],
        eyebrow: ["10px", { lineHeight: "1.4", letterSpacing: "0.22em" }]
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" }
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" }
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" }
        }
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.5s cubic-bezier(0.16, 1, 0.3, 1)"
      }
    }
  },
  plugins: [require("tailwindcss-animate")]
};

export default config;
