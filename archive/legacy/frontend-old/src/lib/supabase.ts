import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[Supabase] VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY not configured. Supabase features disabled.');
}

export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// Company context for multi-tenant
export type CompanyContext = {
  id: string;
  slug: string;
  name: string;
};

let currentCompany: CompanyContext | null = null;

export function setCompanyContext(company: CompanyContext) {
  currentCompany = company;
}

export function getCompanyContext(): CompanyContext | null {
  return currentCompany;
}

export function clearCompanyContext() {
  currentCompany = null;
}

// Helper to add company filter to queries
export function withCompanyFilter<T extends Record<string, any>>(
  query: any,
  companyId?: string
): any {
  const id = companyId || currentCompany?.id;
  if (!id) return query;
  return query.eq('company_id', id);
}

// Real-time subscriptions
export function subscribeToTable(
  table: string,
  filter: Record<string, any> = {},
  callback: (payload: any) => void
) {
  const companyId = currentCompany?.id;
  const query = supabase
    .channel(`${table}-changes`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table,
        filter: companyId ? `company_id=eq.${companyId}` : undefined,
      },
      callback
    )
    .subscribe();

  return query;
}
