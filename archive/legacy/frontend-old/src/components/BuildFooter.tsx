/**
 * ============================================================================
 * BUILD FOOTER
 * ============================================================================
 * 
 * Rodapé com informações de build para produção.
 * ============================================================================
 */

import { APP_VERSION, BUILD_TIME, ENV_NAME, API_BASE_URL } from '@/config/runtime';

function getApiHostnameSafe(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return 'invalid-api-url';
  }
}

export function BuildFooter() {
  // Em desenvolvimento, não mostrar
  if (ENV_NAME === 'development') {
    return null;
  }

  return (
    <footer className="fixed bottom-0 left-0 right-0 bg-slate-900 text-slate-400 text-xs py-1 px-4 flex justify-between items-center border-t border-slate-800">
      <div className="flex gap-4">
        <span>VER: {APP_VERSION.slice(0, 12)}</span>
        <span>ENV: {ENV_NAME}</span>
      </div>
      <div className="flex gap-4">
        <span>API: {getApiHostnameSafe(API_BASE_URL)}</span>
        <span>{new Date(BUILD_TIME).toLocaleDateString()}</span>
      </div>
    </footer>
  );
}
