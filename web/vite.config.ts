import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: __dirname,
  base: process.env.VITE_GITRADAR_BASE || "/",
  plugins: [react()],
  server: {
    port: 4173,
    fs: {
      allow: [".."],
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
