/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0b0f14",
        canvas: "#f7f1e7",
        accent: "#e66b2d",
        accent2: "#2a7f62",
      },
      fontFamily: {
        display: ["Space Grotesk", "sans-serif"],
        body: ["IBM Plex Sans", "sans-serif"],
      },
      boxShadow: {
        crisp: "0 18px 50px rgba(12, 14, 18, 0.18)",
      },
    },
  },
  plugins: [],
};
