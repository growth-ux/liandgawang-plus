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
        "/api": {
          target: apiTarget,
          // 确保流式响应（NDJSON/SSE）不被代理缓冲
          configure: (proxy) => {
            proxy.on("proxyReq", (proxyReq) => {
              // 禁止代理对后端响应做 gzip 压缩，否则流式会被缓冲
              proxyReq.setHeader("Accept-Encoding", "identity");
            });
            proxy.on("proxyRes", (proxyRes, req) => {
              const ct = proxyRes.headers["content-type"] ?? "";
              const isStream =
                ct.includes("ndjson") ||
                ct.includes("event-stream") ||
                ct.includes("text/event-stream");
              if (isStream) {
                proxyRes.headers["cache-control"] = "no-cache";
                proxyRes.headers["x-accel-buffering"] = "no";
                // 移除 content-encoding 防止缓冲
                delete proxyRes.headers["content-encoding"];
                // 移除 content-length 让数据立即刷新
                delete proxyRes.headers["content-length"];
              }
            });
          },
        },
      },
    },
  };
});
