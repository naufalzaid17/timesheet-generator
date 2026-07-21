import type { Config } from "tailwindcss";

// Saweria-inspired palette: bold, friendly flat colors, soft whites, vibrant
// yellow + purple accents. Rounded, crisp, playful-but-professional.
const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        saweria: {
          yellow: "#FFC700",
          amber: "#FFB800",
          purple: "#6C5CE7",
          purpleDark: "#4834D4",
          ink: "#1E1B4B",
          slate: "#64748B",
          cloud: "#F8FAFC",
          soft: "#FFFFFF",
          mint: "#00D9A3",
          coral: "#FF6B6B",
        },
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
      boxShadow: {
        soft: "0 4px 20px rgba(108, 92, 231, 0.08)",
        lift: "0 10px 30px rgba(108, 92, 231, 0.15)",
        pop: "0 6px 0 0 rgba(72, 52, 212, 0.2)",
      },
      fontFamily: {
        sans: ["Plus Jakarta Sans", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
