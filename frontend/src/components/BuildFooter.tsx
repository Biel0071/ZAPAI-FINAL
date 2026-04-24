/**
 * ============================================================================
 * BUILD FOOTER
 * ============================================================================
 * 
 * Rodapé com informações de build para produção.
 * ============================================================================
 */

import { BUILD_ID, BUILD_TIME, ENV_NAME, API_BASE_URL } from '@/config/runtime';

export function BuildFooter() {
  // Em desenvolvimento, não mostrar
  if (ENV_NAME === 'development') {
    return null;
  }

  return (
    <footer className="fixed bottom-0 left-0 right-0 bg-slate-900 text-slate-400 text-xs py-1 px-4 flex justify-between items-center border-t border-slate-800">
      <div className="flex gap-4">
        <span>BUILD: {BUILD_ID.slice(0, 8)}</span>
        <span>ENV: {ENV_NAME}</span>
      </div>
      <div className="flex gap-4">
        <span>API: {new URL(API_BASE_URL).hostname}</span>
        <span>{new Date(BUILD_TIME).toLocaleDateString()}</span>
      </div>
    </footer>
  );
}
