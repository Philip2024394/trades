import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
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
        }
      },
      fontSize: {
        // WCAG floor — never go below 13px on this app
        xs: ["13px", { lineHeight: "1.45" }],
        sm: ["14px", { lineHeight: "1.5" }]
      }
    }
  },
  plugins: []
};

export default config;
