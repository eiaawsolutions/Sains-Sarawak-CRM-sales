import type { Config } from "tailwindcss";

/**
 * Claritas brand tokens → Tailwind. Locked palette:
 *   charcoal #3f3f3f / crimson #721011 / white #ffffff + gradient layering.
 * Mirrors wwwroot/css/claritas-tokens.css from the .NET archive.
 */
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        charcoal:       { DEFAULT: "#3f3f3f", soft: "#6b6b6b", faint: "#a6a6a6" },
        crimson:        { DEFAULT: "#721011", soft: "#9a2c2d", faint: "#f4dcdc" },
        hairline:       "rgba(63, 63, 63, 0.12)",
        overlay:        "rgba(63, 63, 63, 0.55)",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui"],
        mono: ["JetBrains Mono", "ui-monospace", "Consolas"],
      },
      backgroundImage: {
        "gradient-hero":     "radial-gradient(circle at 20% 0%, #f4dcdc 0%, #ffffff 55%)",
        "gradient-accent":   "linear-gradient(135deg, #721011 0%, #3f3f3f 100%)",
        "gradient-surface":  "linear-gradient(180deg, #ffffff 0%, #fafafa 100%)",
        "gradient-cta-hover":"linear-gradient(135deg, #9a2c2d 0%, #721011 100%)",
      },
      boxShadow: {
        "claritas-1": "0 1px 2px rgba(63,63,63,0.06), 0 1px 1px rgba(63,63,63,0.04)",
        "claritas-2": "0 4px 10px rgba(63,63,63,0.08), 0 2px 4px rgba(63,63,63,0.04)",
        "claritas-3": "0 18px 36px rgba(63,63,63,0.10), 0 6px 12px rgba(63,63,63,0.06)",
        "accent-glow":"0 8px 24px rgba(114,16,17,0.22)",
      },
      borderRadius: {
        pill: "999px",
      },
    },
  },
  plugins: [],
} satisfies Config;
