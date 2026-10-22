import { defineConfig } from "vite";

// 使用相对 base，保证部署在 GitHub Pages 子路径时静态资源仍然可用。
export default defineConfig({
  base: "./",
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
    strictPort: true,
  },
  build: {
    target: "es2020",
  },
});
