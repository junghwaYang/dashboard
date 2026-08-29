import { createBrowserClient } from '@supabase/ssr';

const FALLBACK_SUPABASE_URL = 'https://pbjxzfuouzjvkjjwlgnl.supabase.co';
const FALLBACK_SUPABASE_KEY = 'sb_publishable_oZJtTezeQk7gmuZ23iaV_A_FrvB258c';

export function createClient() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    FALLBACK_SUPABASE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Supabase credentials missing');
    return null;
  }

  return createBrowserClient(supabaseUrl, supabaseKey);
}
