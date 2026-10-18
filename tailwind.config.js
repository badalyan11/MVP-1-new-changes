/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: "#FAF6EF",
        beige: "#F1E7D8",
        sage: "#8A9A7E",
        "sage-dark": "#6E7F63",
        ink: "#3B362F",
      },
      fontFamily: {
        serif: ["Lora", "Georgia", "serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
        playfair: ["Playfair Display", "Georgia", "serif"],
        garamond: ["EB Garamond", "Georgia", "serif"],
        caveat: ["Caveat", "cursive"],
      },
    },
  },
  plugins: [],
};
