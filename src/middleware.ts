import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Next.js 내부 정적 파일, 에셋, HMR 청크 및 서비스 워커는 미들웨어 로직 건너뛰기
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/static') ||
    pathname === '/sw.js' ||
    pathname === '/favicon.ico' ||
    /\.(.*)$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  // 2. 일반 페이지 라우트에 대해서만 Supabase 세션 갱신 수행
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - static image/font extensions
     */
    '/((?!_next/static|_next/image|_next/chunks|favicon.ico|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js|map|woff|woff2|ttf|eot|ico)$).*)',
  ],
};
