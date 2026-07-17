import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        neoYellow: "#F4E04D",
        neoCyan: "#3BBA9C",
        neoPink: "#FF6B6B",
        neoPurple: "#A833B9",
      },
    },
  },
  plugins: [],
};
export default config;
