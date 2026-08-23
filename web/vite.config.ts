import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(() => {
  // 多 worktree 并行时用 VITE_API_TARGET 指向本分支后端，默认 8000
  const apiTarget = process.env.VITE_API_TARGET || "http://127.0.0.1:8000";
  return {
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        "/api": apiTarget,
      },
    },
  };
});
