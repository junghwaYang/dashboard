'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { 
  LayoutDashboard, 
  Sparkles, 
  ShieldCheck, 
  Lock, 
  ArrowRight,
  Mail,
  AlertCircle
} from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  // Email login state for direct login option
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isEmailMode, setIsEmailMode] = useState(false);

  // 1. Google OAuth Real Login
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

  // 2. Email Direct Sign In / Sign Up
  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage('이메일과 비밀번호를 입력해 주세요.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setInfoMessage(null);
    const supabase = createClient();

    if (!supabase) {
      setErrorMessage('Supabase 클라이언트를 초기화할 수 없습니다.');
      setIsLoading(false);
      return;
    }

    try {
      // Try Sign In first
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        // If not registered, attempt Sign Up
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: email.split('@')[0],
            },
          },
        });

        if (signUpError) throw signUpError;

        if (signUpData.session) {
          router.push('/onboarding');
        } else {
          setInfoMessage('인증 메일이 발송되었습니다. 메일함 또는 콘솔을 확인해 주세요.');
        }
      } else if (signInData.session) {
        router.push('/');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '인증 처리 중 오류가 발생했습니다.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo & Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md mb-2">
            <LayoutDashboard className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">
            업무현황 대시보드 로그인
          </h1>
          <p className="text-xs text-muted-foreground">
            Supabase 실시간 데이터베이스 연동 & 팀별 격리 워크스페이스
          </p>
        </div>

        {/* Error / Info Alerts */}
        {errorMessage && (
          <div className="flex items-center gap-2 rounded-xl bg-destructive/10 p-3 text-xs text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {infoMessage && (
          <div className="rounded-xl bg-blue-50 dark:bg-blue-950/40 p-3 text-xs text-blue-700 dark:text-blue-300 border border-blue-200">
            {infoMessage}
          </div>
        )}

        {/* Login Container */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
          {/* Google OAuth Button */}
          <button
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 rounded-xl border border-border bg-background hover:bg-accent/80 p-3.5 text-xs sm:text-sm font-semibold text-foreground transition shadow-sm hover:border-primary/40 disabled:opacity-50"
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
            <span>{isLoading ? 'Google 로그인 연결 중...' : 'Google 계정으로 계속하기'}</span>
          </button>

          <div className="relative flex items-center justify-center my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <span className="relative bg-card px-3 text-[11px] font-medium text-muted-foreground uppercase">
              또는 이메일 계정
            </span>
          </div>

          {/* Email / Password Form */}
          {isEmailMode ? (
            <form onSubmit={handleEmailAuth} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">이메일</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">비밀번호</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="6자리 이상 비밀번호"
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full rounded-xl bg-primary p-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition shadow-sm disabled:opacity-50"
              >
                {isLoading ? '처리 중...' : '이메일로 로그인 / 회원가입'}
              </button>
            </form>
          ) : (
            <button
              onClick={() => setIsEmailMode(true)}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-secondary/80 hover:bg-secondary p-2.5 text-xs font-semibold text-secondary-foreground transition"
            >
              <Mail className="h-4 w-4" />
              <span>이메일 및 비밀번호로 로그인</span>
            </button>
          )}
        </div>

        {/* Security Notice */}
        <div className="rounded-xl border border-border bg-secondary/30 p-3 text-xs text-muted-foreground text-center space-y-1">
          <div className="flex items-center justify-center gap-1.5 font-semibold text-foreground">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>Supabase Auth & RLS 보안 적용</span>
          </div>
          <p className="text-[11px]">
            로그인한 계정의 소속 팀 데이터만 안전하게 관리 및 격리됩니다.
          </p>
        </div>
      </div>
    </div>
  );
}
