import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
export default defineConfig({
  plugins: [react()],
  build: { outDir: "preview-dist" },
  server: { port: 4173 },
});
