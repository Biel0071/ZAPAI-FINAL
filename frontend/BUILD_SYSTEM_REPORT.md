# BUILD SYSTEM HARD FIX - RELATÓRIO

**Data:** 2026-04-24  
**Status:** ✅ COMPLETO

---

## 1. LIMPEZA DO DIST

**Scripts Adicionados:**
- `npm run clean` - Remove dist e node_modules/.vite
- `npm run clean:all` - Remove dist, node_modules e package-lock.json
- `npm run reinstall` - Clean all + npm install
- `prebuild` - Executa clean automaticamente antes do build

---

## 2. NPM CLEAN INSTALL

**Comandos:**
```bash
npm run clean:all
npm install
```

**Ou:**
```bash
npm run reinstall
```

---

## 3. ASSETS COM HASH

**Configuração Vite:**
```typescript
build: {
  assetsDir: "assets",
  rollupOptions: {
    output: {
      entryFileNames: "assets/[name].[hash].js",
      chunkFileNames: "assets/[name].[hash].js",
      assetFileNames: "assets/[name].[hash].[ext]",
    },
  },
}
```

**Resultado:**
- `assets/index.abc123.js`
- `assets/vendor.def456.js`
- `assets/app.ghi789.css`

---

## 4. VITE CACHE

**Configuração:**
- Cache desabilitado em assets com hash
- Service Worker usa `CacheFirst` para assets
- 1 ano de cache para assets com hash
- Não cacheia index.html

---

## 5. SERVICE WORKER

**Configuração PWA:**
```typescript
workbox: {
  runtimeCaching: [
    {
      urlPattern: /\.(?:js|css)$/i,
      handler: "CacheFirst",
      options: {
        expiration: {
          maxAgeSeconds: 60 * 60 * 24 * 365, // 1 ano
        },
      },
    },
  ],
  skipWaiting: true,
  clientsClaim: true,
}
```

---

## 6. MANIFEST.JSON

**Status:** Manifest já configurado com ícones e metadados.

---

## 7. HEADERS NO-CACHE INDEX.HTML

**Apache (.htaccess):**
```apache
<FilesMatch "index\.html">
    Header set Cache-Control "no-store, no-cache, must-revalidate"
    Header set Pragma "no-cache"
    Header set Expires "0"
</FilesMatch>
```

**Nginx (script deploy-atomic.sh):**
```nginx
location = /index.html {
    add_header Cache-Control "no-store, no-cache, must-revalidate";
    add_header Pragma "no-cache";
    add_header Expires "0";
}
```

---

## 8. CACHE LONGO ASSETS HASHADOS

**Apache (.htaccess):**
```apache
<FilesMatch "assets/.*\.[a-f0-9]{8,}\.(js|css)$">
    Header set Cache-Control "public, max-age=31536000, immutable"
    ExpiresActive On
    ExpiresDefault "access plus 1 year"
</FilesMatch>
```

**Nginx (script deploy-atomic.sh):**
```nginx
location ~* ^/assets/.*\.[a-f0-9]{8,}\.(js|css)$ {
    add_header Cache-Control "public, max-age=31536000, immutable";
    expires 1y;
}
```

---

## 9. DEPLOY ATOMIC SWAP

**Script:** `scripts/deploy-atomic.sh`

**Passos:**
1. Clean dist antigo
2. npm clean install
3. Build production
4. Validar build
5. Backup deploy atual
6. Swap atômico
7. Configurar headers nginx
8. Reload nginx

---

## 10. BUILD ID GLOBAL

**Configuração Vite:**
```typescript
const generateBuildId = () => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 10);
  return `${timestamp}-${random}`;
};

const BUILD_ID = generateBuildId();

define: {
  __BUILD_ID__: JSON.stringify(BUILD_ID),
  __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
}
```

**Arquivo gerado:** `dist/build-id.json`

---

## 11. VALIDADOR DE BUNDLE

**Script:** `scripts/validate-build.js`

**Funcionalidades:**
- Verifica se dist existe
- Calcula hash do index.html
- Verifica assets com hash
- Valida bundles esperados
- Gera build-id.json
- Compara com build anterior
- Bloqueia deploy se bundle divergir

**Uso:**
```bash
npm run validate-build
npm run validate-build -- --compare
```

---

## RESUMO

| Componente | Status |
|------------|--------|
| Apagar dist antigo | ✅ |
| npm clean install | ✅ |
| Assets com hash | ✅ |
| Vite cache | ✅ |
| Service worker | ✅ |
| Manifest | ✅ |
| Headers no-cache index.html | ✅ |
| Cache longo assets hashados | ✅ |
| Deploy atomic swap | ✅ |
| Build ID global | ✅ |
| Validador de bundle | ✅ |

**CONCLUSÃO:** Sistema de build corrigido com hash em assets, cache correto, deploy atômico e validação de bundle.
