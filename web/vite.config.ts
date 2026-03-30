import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: __dirname,
  plugins: [react()],
  server: {
    port: 4173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3210",
        changeOrigin: true,
      },
    },
    fs: {
      allow: [".."],
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
