import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { execSync } from "node:child_process";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
function resolveBuildCommit() {
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "dev";
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const stableVersion = env.VITE_APP_VERSION?.trim() || "stable";
  const stableVersionLabel = env.VITE_APP_VERSION_LABEL?.trim() || stableVersion;
  const buildTime = env.VITE_BUILD_TIME?.trim() || new Date().toISOString();
  const buildCommit = env.VITE_BUILD_COMMIT?.trim() || resolveBuildCommit();
  return {
  base: "/",
  define: {
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(stableVersion),
    "import.meta.env.VITE_APP_VERSION_LABEL": JSON.stringify(stableVersionLabel),
    "import.meta.env.VITE_BUILD_TIME": JSON.stringify(buildTime),
    "import.meta.env.VITE_BUILD_COMMIT": JSON.stringify(buildCommit),
  },
  build: {
    target: "es2020",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    proxy: {
      "/api": {
        target: env.VITE_API_URL?.trim() || "http://127.0.0.1:4025",
        changeOrigin: true,
      },
      "/auth": {
        target: env.VITE_API_URL?.trim() || "http://127.0.0.1:4025",
        changeOrigin: true,
      },
      "/socket.io": {
        target: env.VITE_API_URL?.trim() || "http://127.0.0.1:4025",
        changeOrigin: true,
        ws: true,
      },
      "/media": {
        target: env.VITE_API_URL?.trim() || "http://127.0.0.1:4025",
        changeOrigin: true,
      },
      "/upload": {
        target: env.VITE_API_URL?.trim() || "http://127.0.0.1:4025",
        changeOrigin: true,
      },
      "/uploads": {
        target: env.VITE_API_URL?.trim() || "http://127.0.0.1:4025",
        changeOrigin: true,
      },
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  };
});
