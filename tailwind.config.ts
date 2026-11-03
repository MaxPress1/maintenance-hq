import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#172b3a",
        canvas: "#f3f6f4",
        brand: "#176b58",
      },
    },
  },
  plugins: [],
};

export default config;
