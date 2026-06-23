// vite.config.ts
import { defineConfig, loadEnv } from "file:///C:/projetos/ZAPAI-FINAL/frontend-official/node_modules/vite/dist/node/index.js";
import react from "file:///C:/projetos/ZAPAI-FINAL/frontend-official/node_modules/@vitejs/plugin-react-swc/index.js";
import path from "path";
import { execSync } from "node:child_process";
import { componentTagger } from "file:///C:/projetos/ZAPAI-FINAL/frontend-official/node_modules/lovable-tagger/dist/index.js";
var __vite_injected_original_dirname = "C:\\projetos\\ZAPAI-FINAL\\frontend-official";
function resolveBuildCommit() {
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "dev";
  }
}
var vite_config_default = defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const stableVersion = env.VITE_APP_VERSION?.trim() || "stable";
  const stableVersionLabel = env.VITE_APP_VERSION_LABEL?.trim() || stableVersion;
  const buildTime = env.VITE_BUILD_TIME?.trim() || (/* @__PURE__ */ new Date()).toISOString();
  const buildCommit = env.VITE_BUILD_COMMIT?.trim() || resolveBuildCommit();
  const enableLovableTagger = env.VITE_ENABLE_LOVABLE_TAGGER?.trim().toLowerCase() === "true";
  const backendTarget = env.VITE_API_URL?.trim() || "http://127.0.0.1:4025";
  return {
    base: "/",
    define: {
      "import.meta.env.VITE_APP_VERSION": JSON.stringify(stableVersion),
      "import.meta.env.VITE_APP_VERSION_LABEL": JSON.stringify(stableVersionLabel),
      "import.meta.env.VITE_BUILD_TIME": JSON.stringify(buildTime),
      "import.meta.env.VITE_BUILD_COMMIT": JSON.stringify(buildCommit)
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
            "vendor-socket": ["socket.io-client"]
          }
        }
      }
    },
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false
      },
      watch: {
        ignored: [
          "**/.claude/**",
          "**/archive/**",
          "**/backups/**",
          "**/logs/**",
          "**/reports/**",
          "**/node_modules/**"
        ]
      },
      proxy: {
        "/api": {
          target: backendTarget,
          changeOrigin: true,
          secure: false
        },
        "/auth": {
          target: backendTarget,
          changeOrigin: true,
          secure: false
        },
        "/health": {
          target: backendTarget,
          changeOrigin: true,
          secure: false
        },
        "/metrics": {
          target: backendTarget,
          changeOrigin: true,
          secure: false
        },
        "/media": {
          target: backendTarget,
          changeOrigin: true,
          secure: false
        },
        "/socket.io": {
          target: backendTarget,
          changeOrigin: true,
          ws: true
        },
        "/send-message": {
          target: backendTarget,
          changeOrigin: true,
          secure: false
        },
        "/send-media": {
          target: backendTarget,
          changeOrigin: true,
          secure: false
        },
        "/upload": {
          target: backendTarget,
          changeOrigin: true,
          secure: false
        },
        "/uploads": {
          target: backendTarget,
          changeOrigin: true,
          secure: false
        },
        "/session": {
          target: backendTarget,
          changeOrigin: true,
          secure: false
        },
        "/sessions": {
          target: backendTarget,
          changeOrigin: true,
          secure: false
        },
        "/session-status": {
          target: backendTarget,
          changeOrigin: true,
          secure: false
        },
        "/status-whatsapp": {
          target: backendTarget,
          changeOrigin: true,
          secure: false
        }
      }
    },
    plugins: [
      react(),
      mode === "development" && enableLovableTagger && componentTagger()
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__vite_injected_original_dirname, "./src")
      }
    }
  };
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxwcm9qZXRvc1xcXFxaQVBBSS1GSU5BTFxcXFxmcm9udGVuZC1vZmZpY2lhbFwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxccHJvamV0b3NcXFxcWkFQQUktRklOQUxcXFxcZnJvbnRlbmQtb2ZmaWNpYWxcXFxcdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0M6L3Byb2pldG9zL1pBUEFJLUZJTkFML2Zyb250ZW5kLW9mZmljaWFsL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnLCBsb2FkRW52IH0gZnJvbSBcInZpdGVcIjtcbmltcG9ydCByZWFjdCBmcm9tIFwiQHZpdGVqcy9wbHVnaW4tcmVhY3Qtc3djXCI7XG5pbXBvcnQgcGF0aCBmcm9tIFwicGF0aFwiO1xuaW1wb3J0IHsgZXhlY1N5bmMgfSBmcm9tIFwibm9kZTpjaGlsZF9wcm9jZXNzXCI7XG5pbXBvcnQgeyBjb21wb25lbnRUYWdnZXIgfSBmcm9tIFwibG92YWJsZS10YWdnZXJcIjtcblxuLy8gaHR0cHM6Ly92aXRlanMuZGV2L2NvbmZpZy9cbmZ1bmN0aW9uIHJlc29sdmVCdWlsZENvbW1pdCgpIHtcbiAgdHJ5IHtcbiAgICByZXR1cm4gZXhlY1N5bmMoXCJnaXQgcmV2LXBhcnNlIC0tc2hvcnQgSEVBRFwiLCB7IGVuY29kaW5nOiBcInV0ZjhcIiB9KS50cmltKCk7XG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiBcImRldlwiO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZygoeyBtb2RlIH0pID0+IHtcbiAgY29uc3QgZW52ID0gbG9hZEVudihtb2RlLCBwcm9jZXNzLmN3ZCgpLCBcIlwiKTtcbiAgY29uc3Qgc3RhYmxlVmVyc2lvbiA9IGVudi5WSVRFX0FQUF9WRVJTSU9OPy50cmltKCkgfHwgXCJzdGFibGVcIjtcbiAgY29uc3Qgc3RhYmxlVmVyc2lvbkxhYmVsID0gZW52LlZJVEVfQVBQX1ZFUlNJT05fTEFCRUw/LnRyaW0oKSB8fCBzdGFibGVWZXJzaW9uO1xuICBjb25zdCBidWlsZFRpbWUgPSBlbnYuVklURV9CVUlMRF9USU1FPy50cmltKCkgfHwgbmV3IERhdGUoKS50b0lTT1N0cmluZygpO1xuICBjb25zdCBidWlsZENvbW1pdCA9IGVudi5WSVRFX0JVSUxEX0NPTU1JVD8udHJpbSgpIHx8IHJlc29sdmVCdWlsZENvbW1pdCgpO1xuICBjb25zdCBlbmFibGVMb3ZhYmxlVGFnZ2VyID0gZW52LlZJVEVfRU5BQkxFX0xPVkFCTEVfVEFHR0VSPy50cmltKCkudG9Mb3dlckNhc2UoKSA9PT0gXCJ0cnVlXCI7XG4gIFxuICBjb25zdCBiYWNrZW5kVGFyZ2V0ID0gZW52LlZJVEVfQVBJX1VSTD8udHJpbSgpIHx8IFwiaHR0cDovLzEyNy4wLjAuMTo0MDI1XCI7XG5cbiAgcmV0dXJuIHtcbiAgYmFzZTogXCIvXCIsXG4gIGRlZmluZToge1xuICAgIFwiaW1wb3J0Lm1ldGEuZW52LlZJVEVfQVBQX1ZFUlNJT05cIjogSlNPTi5zdHJpbmdpZnkoc3RhYmxlVmVyc2lvbiksXG4gICAgXCJpbXBvcnQubWV0YS5lbnYuVklURV9BUFBfVkVSU0lPTl9MQUJFTFwiOiBKU09OLnN0cmluZ2lmeShzdGFibGVWZXJzaW9uTGFiZWwpLFxuICAgIFwiaW1wb3J0Lm1ldGEuZW52LlZJVEVfQlVJTERfVElNRVwiOiBKU09OLnN0cmluZ2lmeShidWlsZFRpbWUpLFxuICAgIFwiaW1wb3J0Lm1ldGEuZW52LlZJVEVfQlVJTERfQ09NTUlUXCI6IEpTT04uc3RyaW5naWZ5KGJ1aWxkQ29tbWl0KSxcbiAgfSxcbiAgYnVpbGQ6IHtcbiAgICB0YXJnZXQ6IFwiZXMyMDIwXCIsXG4gICAgZW1wdHlPdXREaXI6IHRydWUsXG4gICAgcm9sbHVwT3B0aW9uczoge1xuICAgICAgb3V0cHV0OiB7XG4gICAgICAgIGVudHJ5RmlsZU5hbWVzOiBcImFzc2V0cy9bbmFtZV0tW2hhc2hdLmpzXCIsXG4gICAgICAgIGNodW5rRmlsZU5hbWVzOiBcImFzc2V0cy9bbmFtZV0tW2hhc2hdLmpzXCIsXG4gICAgICAgIGFzc2V0RmlsZU5hbWVzOiBcImFzc2V0cy9bbmFtZV0tW2hhc2hdW2V4dG5hbWVdXCIsXG4gICAgICAgIG1hbnVhbENodW5rczoge1xuICAgICAgICAgIFwidmVuZG9yLXJlYWN0XCI6IFtcInJlYWN0XCIsIFwicmVhY3QtZG9tXCIsIFwicmVhY3Qtcm91dGVyLWRvbVwiXSxcbiAgICAgICAgICBcInZlbmRvci11aVwiOiBbXCJmcmFtZXItbW90aW9uXCIsIFwiQHJhZGl4LXVpL3JlYWN0LWRpYWxvZ1wiLCBcIkByYWRpeC11aS9yZWFjdC10YWJzXCJdLFxuICAgICAgICAgIFwidmVuZG9yLWNoYXJ0c1wiOiBbXCJyZWNoYXJ0c1wiXSxcbiAgICAgICAgICBcInZlbmRvci1zb2NrZXRcIjogW1wic29ja2V0LmlvLWNsaWVudFwiXSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSxcbiAgfSxcbiAgc2VydmVyOiB7XG4gICAgaG9zdDogXCI6OlwiLFxuICAgIHBvcnQ6IDgwODAsXG4gICAgaG1yOiB7XG4gICAgICBvdmVybGF5OiBmYWxzZSxcbiAgICB9LFxuICAgIHdhdGNoOiB7XG4gICAgICBpZ25vcmVkOiBbXG4gICAgICAgIFwiKiovLmNsYXVkZS8qKlwiLFxuICAgICAgICBcIioqL2FyY2hpdmUvKipcIixcbiAgICAgICAgXCIqKi9iYWNrdXBzLyoqXCIsXG4gICAgICAgIFwiKiovbG9ncy8qKlwiLFxuICAgICAgICBcIioqL3JlcG9ydHMvKipcIixcbiAgICAgICAgXCIqKi9ub2RlX21vZHVsZXMvKipcIixcbiAgICAgIF0sXG4gICAgfSxcbiAgICBwcm94eToge1xuICAgICAgXCIvYXBpXCI6IHtcbiAgICAgICAgdGFyZ2V0OiBiYWNrZW5kVGFyZ2V0LFxuICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXG4gICAgICAgIHNlY3VyZTogZmFsc2UsXG4gICAgICB9LFxuICAgICAgXCIvYXV0aFwiOiB7XG4gICAgICAgIHRhcmdldDogYmFja2VuZFRhcmdldCxcbiAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxuICAgICAgICBzZWN1cmU6IGZhbHNlLFxuICAgICAgfSxcbiAgICAgIFwiL2hlYWx0aFwiOiB7XG4gICAgICAgIHRhcmdldDogYmFja2VuZFRhcmdldCxcbiAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxuICAgICAgICBzZWN1cmU6IGZhbHNlLFxuICAgICAgfSxcbiAgICAgIFwiL21ldHJpY3NcIjoge1xuICAgICAgICB0YXJnZXQ6IGJhY2tlbmRUYXJnZXQsXG4gICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcbiAgICAgICAgc2VjdXJlOiBmYWxzZSxcbiAgICAgIH0sXG4gICAgICBcIi9tZWRpYVwiOiB7XG4gICAgICAgIHRhcmdldDogYmFja2VuZFRhcmdldCxcbiAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxuICAgICAgICBzZWN1cmU6IGZhbHNlLFxuICAgICAgfSxcbiAgICAgIFwiL3NvY2tldC5pb1wiOiB7XG4gICAgICAgIHRhcmdldDogYmFja2VuZFRhcmdldCxcbiAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxuICAgICAgICB3czogdHJ1ZSxcbiAgICAgIH0sXG4gICAgICBcIi9zZW5kLW1lc3NhZ2VcIjoge1xuICAgICAgICB0YXJnZXQ6IGJhY2tlbmRUYXJnZXQsXG4gICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcbiAgICAgICAgc2VjdXJlOiBmYWxzZSxcbiAgICAgIH0sXG4gICAgICBcIi9zZW5kLW1lZGlhXCI6IHtcbiAgICAgICAgdGFyZ2V0OiBiYWNrZW5kVGFyZ2V0LFxuICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXG4gICAgICAgIHNlY3VyZTogZmFsc2UsXG4gICAgICB9LFxuICAgICAgXCIvdXBsb2FkXCI6IHtcbiAgICAgICAgdGFyZ2V0OiBiYWNrZW5kVGFyZ2V0LFxuICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXG4gICAgICAgIHNlY3VyZTogZmFsc2UsXG4gICAgICB9LFxuICAgICAgXCIvdXBsb2Fkc1wiOiB7XG4gICAgICAgIHRhcmdldDogYmFja2VuZFRhcmdldCxcbiAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxuICAgICAgICBzZWN1cmU6IGZhbHNlLFxuICAgICAgfSxcbiAgICAgIFwiL3Nlc3Npb25cIjoge1xuICAgICAgICB0YXJnZXQ6IGJhY2tlbmRUYXJnZXQsXG4gICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcbiAgICAgICAgc2VjdXJlOiBmYWxzZSxcbiAgICAgIH0sXG4gICAgICBcIi9zZXNzaW9uc1wiOiB7XG4gICAgICAgIHRhcmdldDogYmFja2VuZFRhcmdldCxcbiAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxuICAgICAgICBzZWN1cmU6IGZhbHNlLFxuICAgICAgfSxcbiAgICAgIFwiL3Nlc3Npb24tc3RhdHVzXCI6IHtcbiAgICAgICAgdGFyZ2V0OiBiYWNrZW5kVGFyZ2V0LFxuICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXG4gICAgICAgIHNlY3VyZTogZmFsc2UsXG4gICAgICB9LFxuICAgICAgXCIvc3RhdHVzLXdoYXRzYXBwXCI6IHtcbiAgICAgICAgdGFyZ2V0OiBiYWNrZW5kVGFyZ2V0LFxuICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXG4gICAgICAgIHNlY3VyZTogZmFsc2UsXG4gICAgICB9LFxuICAgIH0sXG4gIH0sXG4gIHBsdWdpbnM6IFtcbiAgICByZWFjdCgpLFxuICAgIG1vZGUgPT09IFwiZGV2ZWxvcG1lbnRcIiAmJiBlbmFibGVMb3ZhYmxlVGFnZ2VyICYmIGNvbXBvbmVudFRhZ2dlcigpLFxuICBdLmZpbHRlcihCb29sZWFuKSxcbiAgcmVzb2x2ZToge1xuICAgIGFsaWFzOiB7XG4gICAgICBcIkBcIjogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCIuL3NyY1wiKSxcbiAgICB9LFxuICB9LFxuICB9O1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQXFULFNBQVMsY0FBYyxlQUFlO0FBQzNWLE9BQU8sV0FBVztBQUNsQixPQUFPLFVBQVU7QUFDakIsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyx1QkFBdUI7QUFKaEMsSUFBTSxtQ0FBbUM7QUFPekMsU0FBUyxxQkFBcUI7QUFDNUIsTUFBSTtBQUNGLFdBQU8sU0FBUyw4QkFBOEIsRUFBRSxVQUFVLE9BQU8sQ0FBQyxFQUFFLEtBQUs7QUFBQSxFQUMzRSxRQUFRO0FBQ04sV0FBTztBQUFBLEVBQ1Q7QUFDRjtBQUVBLElBQU8sc0JBQVEsYUFBYSxDQUFDLEVBQUUsS0FBSyxNQUFNO0FBQ3hDLFFBQU0sTUFBTSxRQUFRLE1BQU0sUUFBUSxJQUFJLEdBQUcsRUFBRTtBQUMzQyxRQUFNLGdCQUFnQixJQUFJLGtCQUFrQixLQUFLLEtBQUs7QUFDdEQsUUFBTSxxQkFBcUIsSUFBSSx3QkFBd0IsS0FBSyxLQUFLO0FBQ2pFLFFBQU0sWUFBWSxJQUFJLGlCQUFpQixLQUFLLE1BQUssb0JBQUksS0FBSyxHQUFFLFlBQVk7QUFDeEUsUUFBTSxjQUFjLElBQUksbUJBQW1CLEtBQUssS0FBSyxtQkFBbUI7QUFDeEUsUUFBTSxzQkFBc0IsSUFBSSw0QkFBNEIsS0FBSyxFQUFFLFlBQVksTUFBTTtBQUVyRixRQUFNLGdCQUFnQixJQUFJLGNBQWMsS0FBSyxLQUFLO0FBRWxELFNBQU87QUFBQSxJQUNQLE1BQU07QUFBQSxJQUNOLFFBQVE7QUFBQSxNQUNOLG9DQUFvQyxLQUFLLFVBQVUsYUFBYTtBQUFBLE1BQ2hFLDBDQUEwQyxLQUFLLFVBQVUsa0JBQWtCO0FBQUEsTUFDM0UsbUNBQW1DLEtBQUssVUFBVSxTQUFTO0FBQUEsTUFDM0QscUNBQXFDLEtBQUssVUFBVSxXQUFXO0FBQUEsSUFD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
