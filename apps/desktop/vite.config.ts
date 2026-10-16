import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import electron from "vite-plugin-electron/simple";
import { builtinModules } from "node:module";

const pkgRoot = path.dirname(fileURLToPath(import.meta.url));

// Bundle @earendil-works/* into main: those packages are ESM-only (exports.import),
// while vite-plugin-electron emits CJS that would otherwise require() subpaths and crash.
const mainExternal = [
  "electron",
  ...builtinModules,
  ...builtinModules.map((m) => `node:${m}`),
];

export default defineConfig({
  root: path.join(pkgRoot, "src/renderer"),
  plugins: [
    react(),
    electron({
      main: {
        entry: path.join(pkgRoot, "src/main/index.ts"),
        vite: {
          define: {
            // ws 的可选 native 依赖（bufferutil / utf-8-validate）不参与打包：
            // 打包成 ESM 静态 import 后解析失败会导致整个 main 加载崩溃
            //（try/catch 兑不住顶层 import）。置 1 让 ws 走纯 JS fallback。
            "process.env.WS_NO_BUFFER_UTIL": '"1"',
            "process.env.WS_NO_UTF_8_VALIDATE": '"1"',
          },
          build: {
            outDir: path.join(pkgRoot, "dist-electron"),
            emptyOutDir: false,
            rollupOptions: {
              external: mainExternal,
              output: {
                entryFileNames: "main.mjs",
                format: "es",
                inlineDynamicImports: true,
              },
            },
          },
        },
      },
      preload: {
        // Electron preload supports CJS cleanly; .mjs + require() breaks sandbox.
        input: path.join(pkgRoot, "src/preload/index.ts"),
        vite: {
          build: {
            outDir: path.join(pkgRoot, "dist-electron"),
            emptyOutDir: false,
            rollupOptions: {
              external: ["electron"],
              output: {
                entryFileNames: "preload.cjs",
                format: "cjs",
                exports: "auto",
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
