/**
 * ============================================================================
 * CONFIG FIXA DE API - NÃO ALTERAR
 * ============================================================================
 * 
 * Este arquivo contém configuração de proxy para API.
 * 
 * PROIBIDO:
 * - Remover configuração de proxy /api
 * - Alterar target do proxy
 * - Desabilitar changeOrigin
 * 
 * Para alterações visuais ou merge: NÃO TOCAR neste arquivo.
 * ============================================================================
 */

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

const RELEASE_LOCK_FILE = path.resolve(__dirname, "release.lock.json");

type ReleaseLock = {
  locked: boolean;
  buildId?: string;
  lockedAt?: string;
};

function readReleaseLock(): ReleaseLock {
  try {
    if (!fs.existsSync(RELEASE_LOCK_FILE)) {
      return { locked: false };
    }

    const raw = fs.readFileSync(RELEASE_LOCK_FILE, "utf8");
    const parsed = JSON.parse(raw) as ReleaseLock;
    return {
      locked: Boolean(parsed.locked),
      buildId: typeof parsed.buildId === "string" ? parsed.buildId : undefined,
      lockedAt: typeof parsed.lockedAt === "string" ? parsed.lockedAt : undefined,
    };
  } catch {
    return { locked: false };
  }
}

// Gerar build ID único
const generateBuildId = () => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 10);
  return `${timestamp}-${random}`;
};

const releaseLock = readReleaseLock();
const isReleaseLocked = releaseLock.locked && Boolean(releaseLock.buildId);
const BUILD_ID = isReleaseLocked ? String(releaseLock.buildId) : generateBuildId();
const APP_VERSION = isReleaseLocked ? String(BUILD_ID) : `unlocked-${BUILD_ID}`;

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {

  return {
  // Build ID global
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __RELEASE_LOCK_ENABLED__: JSON.stringify(isReleaseLocked),
    __STABLE_BUILD_ID__: JSON.stringify(isReleaseLocked ? BUILD_ID : ""),
    __APP_VERSION__: JSON.stringify(APP_VERSION),
  },
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    proxy: {
      "/api": {
        target: process.env.VITE_API_URL || "http://localhost:4025",
        changeOrigin: true,
        secure: false,
      },
      "/auth": {
        target: process.env.VITE_API_URL || "http://localhost:4025",
        changeOrigin: true,
        secure: false,
      },
      "/socket.io": {
        target: process.env.VITE_API_URL || "http://localhost:4025",
        changeOrigin: true,
        secure: false,
        ws: true,
      },
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["favicon.ico"],
      manifest: {
        name: "ZapAI CRM",
        short_name: "ZapAI",
        start_url: "/",
        display: "standalone",
        background_color: "#0f172a",
        theme_color: "#22c55e",
        icons: [
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
      workbox: {
        navigateFallbackDenylist: [/^\/~oauth/],
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,json}"],
        // Cache imutável para assets com hash
        runtimeCaching: [
          {
            urlPattern: /\.(?:js|css)$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "static-resources",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 ano para assets com hash
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "asset-cache",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 ano para assets com hash
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
        // Não cachear index.html
        navigateFallback: "/index.html",
        skipWaiting: false,
        clientsClaim: false,
      },
    }),
    // Build manifest — generates build-manifest.json for atomic deploy validation
    {
      name: 'build-manifest-plugin',
      apply: 'build',
      closeBundle() {
        const distDir = path.resolve(__dirname, 'dist');
        const assetsDir = path.resolve(distDir, 'assets');
        if (!fs.existsSync(assetsDir)) return;

        const assets = fs.readdirSync(assetsDir);
        const jsChunks = assets.filter(f => f.endsWith('.js'));
        const cssChunks = assets.filter(f => f.endsWith('.css'));

        const manifest = {
          version: APP_VERSION,
          buildId: BUILD_ID,
          buildTime: new Date().toISOString(),
          environment: 'production',
          chunks: {
            js: jsChunks,
            css: cssChunks,
            total: jsChunks.length + cssChunks.length,
          },
          assets: {
            total: assets.length,
            files: assets,
          },
          integrity: {
            indexHtml: fs.existsSync(path.resolve(distDir, 'index.html')),
            swJs: fs.existsSync(path.resolve(distDir, 'sw.js')),
          },
        };

        fs.writeFileSync(
          path.resolve(distDir, 'build-manifest.json'),
          JSON.stringify(manifest, null, 2),
        );
        console.log(`\n[build-manifest] Generated: ${jsChunks.length} JS + ${cssChunks.length} CSS chunks`);
      },
    },
  ].filter(Boolean),
  preview: {
    host: "0.0.0.0",
    port: 3000,
  },
  build: {
    target: "esnext",
    cssMinify: true,
    sourcemap: false,
    emptyOutDir: true,
    // Hash em todos os assets para cache imutável
    assetsDir: "assets",
    minify: "terser",
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
    rollupOptions: {
      output: {
        // Hash em nomes de arquivos para cache busting
        entryFileNames: "assets/[name].[hash].js",
        chunkFileNames: "assets/[name].[hash].js",
        assetFileNames: "assets/[name].[hash].[ext]",
        manualChunks: {
          vendor: ["react", "react-dom", "react-router-dom"],
          ui: ["framer-motion", "@radix-ui/react-dialog", "@radix-ui/react-dropdown-menu", "@radix-ui/react-select", "@radix-ui/react-tabs"],
          query: ["@tanstack/react-query"],
          charts: ["recharts"],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  };
});
