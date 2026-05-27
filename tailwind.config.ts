/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      boxShadow: {
        glow: "0 10px 40px rgba(59,130,246,0.25)",
      },
      backgroundImage: {
        "falcon-grid":
          "radial-gradient(circle at top, rgba(56,189,248,0.20), transparent 30%), radial-gradient(circle at 80% 20%, rgba(139,92,246,0.18), transparent 25%), linear-gradient(to bottom, #020617, #071127 40%, #0a1120 100%)",
      },
    },
  },
  plugins: [],
};