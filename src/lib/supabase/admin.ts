import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * service role 클라이언트. 서버에서만 쓴다.
 *
 * cron은 사용자 세션이 없어 RLS도 통과하지 못하고, 보고서 생성 RPC의
 * EXECUTE 권한도 없다(anon에서 회수했다). 그 경로에만 이 클라이언트를 쓴다.
 *
 * 키가 없으면 null을 돌려준다. 호출부는 그 경우를 조용히 넘기지 말고
 * 무엇이 실행되지 않았는지 남겨야 한다.
 */
export function createAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) return null;

  return createSupabaseClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
