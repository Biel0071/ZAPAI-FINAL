// Supabase client — production-safe initialization.
// When VITE_SUPABASE_URL is not set (production uses backend API directly),
// this provides a safe no-op client that won't crash on import.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL ?? '').trim();
const SUPABASE_PUBLISHABLE_KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '').trim();

function createSafeClient(): SupabaseClient<Database> {
  if (SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY) {
    try {
      return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        auth: {
          storage: typeof window !== 'undefined' ? window.localStorage : undefined,
          persistSession: true,
          autoRefreshToken: true,
        },
      });
    } catch (err) {
      console.warn('[Supabase] Failed to create client:', err);
    }
  }

  // Return a stub client that won't crash when methods are called.
  // In production, all auth goes through the backend API — Supabase is not used.
  console.info('[Supabase] No VITE_SUPABASE_URL configured — using stub client (backend API mode).');

  const stubAuth = {
    getSession: () => Promise.resolve({ data: { session: null }, error: null }),
    onAuthStateChange: (_callback: unknown) => ({
      data: { subscription: { unsubscribe: () => {} } },
    }),
    getUser: () => Promise.resolve({ data: { user: null }, error: null }),
    signOut: () => Promise.resolve({ error: null }),
  };

  const stubFunctions = {
    invoke: (_name: string, _opts?: unknown) =>
      Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
  };

  return {
    auth: stubAuth,
    functions: stubFunctions,
  } as unknown as SupabaseClient<Database>;
}

export const supabase = createSafeClient();