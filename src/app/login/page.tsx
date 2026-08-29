'use client';

import React, { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { 
  LayoutDashboard, 
  ShieldCheck, 
  AlertCircle,
  Users,
  Lock
} from 'lucide-react';

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Google OAuth Login
  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    const supabase = createClient();

    if (!supabase) {
      setErrorMessage('Supabase 클라이언트를 초기화할 수 없습니다.');
      setIsLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) throw error;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '구글 로그인 중 오류가 발생했습니다.';
      setErrorMessage(msg);
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo & Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg mb-2 ring-4 ring-primary/10">
            <LayoutDashboard className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
            업무현황 대시보드 로그인
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            기획팀, 디자인팀, 개발팀의 격리된 워크스페이스 & 실시간 전사 현황 관리
          </p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="flex items-center gap-2 rounded-xl bg-destructive/10 p-3 text-xs text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Login Card */}
        <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-sm space-y-6">
          <div className="space-y-1 text-center">
            <h2 className="text-sm font-bold text-foreground">사내 Google 계정으로 시작하기</h2>
            <p className="text-xs text-muted-foreground">
              Google 로그인 후 본인의 소속 팀(기획/디자인/개발)을 선택하여 업무를 관리할 수 있습니다.
            </p>
          </div>

          {/* Google OAuth Button */}
          <button
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3.5 rounded-xl border border-border bg-background hover:bg-accent/70 p-3.5 text-xs sm:text-sm font-semibold text-foreground transition shadow-sm hover:border-primary/50 disabled:opacity-50 group"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
              />
            </svg>
            <span>{isLoading ? 'Google 로그인 연결 중...' : 'Google 계정으로 로그인'}</span>
          </button>

          {/* Feature Highlights */}
          <div className="pt-2 border-t border-border/60 space-y-2 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-2">
              <Users className="h-3.5 w-3.5 text-primary" />
              <span>팀별(기획/디자인/개발) 격리된 칸반 보드 및 업무 관리</span>
            </div>
            <div className="flex items-center gap-2">
              <Lock className="h-3.5 w-3.5 text-primary" />
              <span>타 팀 업무 상세 비공개 및 메인 수치 통계만 요약 제공</span>
            </div>
          </div>
        </div>

        {/* Security Notice */}
        <div className="rounded-xl border border-border bg-secondary/30 p-3.5 text-xs text-muted-foreground text-center space-y-1">
          <div className="flex items-center justify-center gap-1.5 font-semibold text-foreground">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>Supabase RLS 보안 정책 적용</span>
          </div>
          <p className="text-[11px]">
            Google OAuth 인증을 통해 본인 소속 팀의 데이터에만 안전하게 접근합니다.
          </p>
        </div>
      </div>
    </div>
  );
}
