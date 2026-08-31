import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  // 실제 페이지 라우트에 대해서만 Supabase 세션 갱신 수행
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * 명시적으로 페이지만 매칭하여 모든 정적 리소스(_next/static, chunks, css, js 등)에
     * 미들웨어가 전혀 개입하지 않도록 원천 차단
     */
    '/',
    '/teams/:path*',
    '/report',
    '/onboarding',
    '/login',
    '/auth/:path*',
  ],
};
