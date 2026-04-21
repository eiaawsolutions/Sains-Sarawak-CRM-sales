import type { Config } from "tailwindcss";

/**
 * SAINS Sarawak CRM — design tokens.
 *
 * Palette intent: quiet authority for a government-adjacent B2B sales surface.
 * Ink-based monochrome + SAINS navy accent + Sarawak teal (positive) + restrained gold (warning).
 * No decorative gradients. No pastel status fills. Hairlines over shadows.
 *
 * Token names `charcoal` / `crimson` / `accent-glow` / `gradient-accent` / etc. are preserved
 * from the earlier palette so existing pages automatically rebrand via remapped values —
 * new work should prefer the semantic names (ink / accent / teal / gold / rose).
 */
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Semantic (prefer these for new code)
        ink:     { DEFAULT: "#0F172A", soft: "#475569", faint: "#94A3B8", mute: "#CBD5E1" },
        paper:   { DEFAULT: "#FFFFFF", 2: "#FAFAFB", 3: "#F4F5F7" },
        accent:  { DEFAULT: "#0E6BA8", soft: "#3A90C9", faint: "#E6F1F9", deep: "#0A5285" },
        teal:    { DEFAULT: "#0D8F8F", soft: "#3FA9A9", faint: "#E0F2F2" },
        gold:    { DEFAULT: "#B88A2C", soft: "#D4A64A", faint: "#FBF3E1" },
        rose:    { DEFAULT: "#B42318", soft: "#D0453A", faint: "#FEECEB" },
        hairline: "rgba(15, 23, 42, 0.10)",
        hairline2:"rgba(15, 23, 42, 0.16)",
        overlay:  "rgba(15, 23, 42, 0.55)",

        // Legacy aliases → remapped. Keep so existing pages rebrand automatically.
        charcoal: { DEFAULT: "#0F172A", soft: "#475569", faint: "#94A3B8" },
        crimson:  { DEFAULT: "#0E6BA8", soft: "#3A90C9", faint: "#E6F1F9" },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui"],
        mono: ["JetBrains Mono", "ui-monospace", "Consolas"],
      },
      backgroundImage: {
        // Legacy names kept; values now flat-surface or subtle, never decorative.
        "gradient-hero":      "linear-gradient(180deg, #FAFAFB 0%, #FFFFFF 100%)",
        "gradient-accent":    "linear-gradient(180deg, #0E6BA8 0%, #0A5285 100%)",
        "gradient-surface":   "linear-gradient(180deg, #FFFFFF 0%, #FAFAFB 100%)",
        "gradient-cta-hover": "linear-gradient(180deg, #0A5285 0%, #083E67 100%)",
      },
      boxShadow: {
        "ink-1":  "0 1px 2px rgba(15,23,42,0.04)",
        "ink-2":  "0 1px 3px rgba(15,23,42,0.06), 0 1px 2px rgba(15,23,42,0.04)",
        "ink-3":  "0 4px 12px rgba(15,23,42,0.07), 0 2px 4px rgba(15,23,42,0.04)",
        "focus":  "0 0 0 2px #FFFFFF, 0 0 0 4px rgba(14,107,168,0.55)",
        // Legacy aliases
        "claritas-1": "0 1px 2px rgba(15,23,42,0.04)",
        "claritas-2": "0 1px 3px rgba(15,23,42,0.06), 0 1px 2px rgba(15,23,42,0.04)",
        "claritas-3": "0 4px 12px rgba(15,23,42,0.07), 0 2px 4px rgba(15,23,42,0.04)",
        "accent-glow":"0 1px 2px rgba(14,107,168,0.14)",
      },
      borderRadius: {
        pill: "999px",
        card: "10px",
      },
      transitionTimingFunction: {
        sains: "cubic-bezier(0.2, 0.8, 0.2, 1)",
      },
      transitionDuration: {
        sains: "150ms",
      },
    },
  },
  plugins: [],
} satisfies Config;
