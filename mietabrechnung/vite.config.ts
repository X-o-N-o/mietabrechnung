import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  // Relative Pfade, damit die App hinter dem Home-Assistant-Ingress-Präfix funktioniert
  base: "./",
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
    },
  },
  build: {
    outDir: "dist/public",
    emptyOutDir: true,
    chunkSizeWarningLimit: 1500,
  },
  server: {
    proxy: { "/api": "http://localhost:8099" },
  },
});
