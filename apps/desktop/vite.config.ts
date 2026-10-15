import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import electron from "vite-plugin-electron/simple";

const pkgRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // Renderer-only root. Main/preload entries MUST use absolute paths under pkgRoot
  // so they are not resolved relative to src/renderer.
  root: path.join(pkgRoot, "src/renderer"),
  plugins: [
    react(),
    electron({
      main: {
        entry: path.join(pkgRoot, "src/main/index.ts"),
        vite: {
          build: {
            outDir: path.join(pkgRoot, "dist-electron"),
            emptyOutDir: false,
            rollupOptions: {
              external: [
                "electron",
                /^@earendil-works\//,
                /^node:/,
              ],
              output: {
                entryFileNames: "main.js",
              },
            },
          },
        },
      },
      preload: {
        input: path.join(pkgRoot, "src/preload/index.ts"),
        vite: {
          build: {
            outDir: path.join(pkgRoot, "dist-electron"),
            emptyOutDir: false,
            rollupOptions: {
              external: ["electron"],
              output: {
                entryFileNames: "preload.mjs",
              },
            },
          },
        },
      },
      renderer: {},
    }),
  ],
  resolve: {
    alias: {
      "@": path.join(pkgRoot, "src/renderer"),
      "@tick/shared": path.join(pkgRoot, "../../packages/shared/src/index.ts"),
      "@tick/ai-core": path.join(pkgRoot, "../../packages/ai/core/src/index.ts"),
      "@tick/ai-pi": path.join(pkgRoot, "../../packages/ai/pi/src/index.ts"),
    },
  },
  build: {
    outDir: path.join(pkgRoot, "dist"),
    emptyOutDir: true,
  },
});
