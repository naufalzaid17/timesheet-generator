import type { Config } from "tailwindcss";

// "Maman Racing" design system — bold Neobrutalism: thick black borders, hard
// offset shadows, saturated flat accents, Rubik + IBM Plex Mono type.
//
// Colors resolve to CSS variables defined in globals.css (:root and
// [data-theme="dark"]), so the whole palette re-themes for dark mode without
// touching component markup.
const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        mr: {
          ink: "var(--fg)",
          border: "var(--border)",
          paper: "var(--bg-page)",
          surface: "var(--bg-surface)",
          surface2: "var(--bg-surface-secondary)",
          muted: "var(--text-muted)",
          main: "var(--main)",
          purple: "var(--accent-purple)",
          yellow: "var(--accent-yellow)",
          cyan: "var(--accent-cyan)",
          pink: "var(--accent-pink)",
          blue: "var(--accent-blue)",
          dangerBg: "var(--danger-bg)",
          dangerFg: "var(--danger-fg)",
        },
      },
      boxShadow: {
        hard: "8px 8px 0 0 var(--ink)",
        "hard-md": "4px 4px 0 0 var(--ink)",
        "hard-sm": "2px 2px 0 0 var(--ink)",
        "hard-lg": "10px 10px 0 0 var(--ink)",
      },
      borderWidth: {
        DEFAULT: "2px",
        3: "3px",
        4: "4px",
      },
      fontFamily: {
        sans: ["Rubik", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
