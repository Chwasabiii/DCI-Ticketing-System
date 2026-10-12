import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        navy: "#0F2A4A",
        accent: "#2563EB",
        resolved: "#16A34A",
        warning: "#F59E0B",
        urgent: "#DC2626"
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"]
      },
      boxShadow: {
        soft: "0 10px 30px rgba(15, 42, 74, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
