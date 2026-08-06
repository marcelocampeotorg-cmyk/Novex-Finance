import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/features/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        novex: {
          bg: "#0B0E14",
          surface1: "#12172B",
          surface2: "#1E2638",
          border: "#2A354D",
          cyan: {
            DEFAULT: "#00E5FF",
            hover: "#00B8D4",
            active: "#00838F",
          },
          text: {
            primary: "#F1F5F9",
            secondary: "#94A3B8",
            muted: "#64748B",
          },
          status: {
            success: "#10B981",
            warning: "#F59E0B",
            danger: "#EF4444",
            info: "#3B82F6",
          },
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
