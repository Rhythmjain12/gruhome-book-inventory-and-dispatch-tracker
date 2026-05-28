import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// During `npm run dev`, Vite serves the React app on :5173 with HMR
// and proxies /api/* and /approve to the local Wrangler worker on :8787.
// In production both are served by the same Worker, so no proxy is needed.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8787",
      "/approve": "http://localhost:8787",
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
