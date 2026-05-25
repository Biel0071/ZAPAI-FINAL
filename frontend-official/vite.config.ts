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
    proxy: {
      // In DEV mode, proxy /api to the local backend to avoid CORS
      '/api': {
        target: 'http://localhost:4025',
        changeOrigin: true,
        secure: false,
      },
      '/health': {
        target: 'http://localhost:4025',
        changeOrigin: true,
        secure: false,
      },
      '/metrics': {
        target: 'http://localhost:4025',
        changeOrigin: true,
        secure: false,
      },
      '/media': {
        target: 'http://localhost:4025',
        changeOrigin: true,
        secure: false,
      },
      '/socket.io': {
        target: 'http://localhost:4025',
        changeOrigin: true,
        ws: true,
      },
      '/send-message': {
        target: 'http://localhost:4025',
        changeOrigin: true,
        secure: false,
      },
      '/send-media': {
        target: 'http://localhost:4025',
        changeOrigin: true,
        secure: false,
      },
      '/upload': {
        target: 'http://localhost:4025',
        changeOrigin: true,
        secure: false,
      },
      '/uploads': {
        target: 'http://localhost:4025',
        changeOrigin: true,
        secure: false,
      },
      '/session-status': {
        target: 'http://localhost:4025',
        changeOrigin: true,
        secure: false,
      },
      '/status-whatsapp': {
        target: 'http://localhost:4025',
        changeOrigin: true,
        secure: false,
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
