import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // When the Worker runs locally (npm run dev:worker), the AI route works in `npm run dev` too.
    // If it isn't running, the app quietly falls back to its basic tidy-up.
    proxy: { "/api": { target: "http://localhost:8788", changeOrigin: true } },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          supabase: ["@supabase/supabase-js"],
        },
      },
    },
  },
});
