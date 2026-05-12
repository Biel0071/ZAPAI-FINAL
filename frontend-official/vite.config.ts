import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const stableVersion = env.VITE_APP_VERSION?.trim() || "stable";
  const stableVersionLabel = env.VITE_APP_VERSION_LABEL?.trim() || stableVersion;
  return {
  base: "/",
  define: {
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(stableVersion),
    "import.meta.env.VITE_APP_VERSION_LABEL": JSON.stringify(stableVersionLabel),
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
