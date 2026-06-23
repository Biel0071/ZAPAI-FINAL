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
  const enableLovableTagger = env.VITE_ENABLE_LOVABLE_TAGGER?.trim().toLowerCase() === "true";
  
  const backendTarget = env.VITE_API_URL?.trim() || "http://127.0.0.1:4025";

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
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-ui": ["framer-motion", "@radix-ui/react-dialog", "@radix-ui/react-tabs"],
          "vendor-charts": ["recharts"],
          "vendor-socket": ["socket.io-client"],
        },
      },
    },
  },
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    watch: {
      ignored: [
        "**/.claude/**",
        "**/archive/**",
        "**/backups/**",
        "**/logs/**",
        "**/reports/**",
        "**/node_modules/**",
      ],
    },
    proxy: {
      "/api": {
        target: backendTarget,
        changeOrigin: true,
        secure: false,
      },
      "/auth": {
        target: backendTarget,
        changeOrigin: true,
        secure: false,
      },
      "/health": {
        target: backendTarget,
        changeOrigin: true,
        secure: false,
      },
      "/metrics": {
        target: backendTarget,
        changeOrigin: true,
        secure: false,
      },
      "/media": {
        target: backendTarget,
        changeOrigin: true,
        secure: false,
      },
      "/socket.io": {
        target: backendTarget,
        changeOrigin: true,
        ws: true,
      },
      "/send-message": {
        target: backendTarget,
        changeOrigin: true,
        secure: false,
      },
      "/send-media": {
        target: backendTarget,
        changeOrigin: true,
        secure: false,
      },
      "/upload": {
        target: backendTarget,
        changeOrigin: true,
        secure: false,
      },
      "/uploads": {
        target: backendTarget,
        changeOrigin: true,
        secure: false,
      },
      "/session": {
        target: backendTarget,
        changeOrigin: true,
        secure: false,
      },
      "/sessions": {
        target: backendTarget,
        changeOrigin: true,
        secure: false,
      },
      "/session-status": {
        target: backendTarget,
        changeOrigin: true,
        secure: false,
      },
      "/status-whatsapp": {
        target: backendTarget,
        changeOrigin: true,
        secure: false,
      },
    },
  },
  plugins: [
    react(),
    mode === "development" && enableLovableTagger && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  };
});
