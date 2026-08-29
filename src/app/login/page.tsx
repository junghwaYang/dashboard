'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDashboard } from '@/context/dashboard-context';
import { createClient } from '@/lib/supabase/client';
import { 
  LayoutDashboard, 
  Sparkles, 
  ShieldCheck, 
  UserCheck, 
  ArrowRight,
  Lightbulb,
  Palette,
  Code2
} from 'lucide-react';
import { Profile } from '@/types/dashboard';

export default function LoginPage() {
  const router = useRouter();
  const { profiles, setCurrentProfile, isSupabaseConnected } = useDashboard();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    const supabase = createClient();

    if (supabase && isSupabaseConnected) {
      try {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) throw error;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '구글 로그인 중 오류가 발생했습니다.';
        setErrorMessage(msg);
        setIsLoading(false);
      }
    } else {
      // Supabase not configured: guide user to instant demo login or onboarding
      setTimeout(() => {
        router.push('/onboarding');
      }, 500);
    }
  };

  const handleSelectDemoUser = (profile: Profile) => {
    setCurrentProfile(profile);
    router.push('/');
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo & Intro */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md mb-2">
            <LayoutDashboard className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">
            업무현황 대시보드 로그인
          </h1>
          <p className="text-xs text-muted-foreground">
            기획팀, 디자인팀, 개발팀의 격리된 워크스페이스 및 전사 현황 관리
          </p>
        </div>

        {errorMessage && (
          <div className="rounded-xl bg-destructive/10 p-3 text-xs text-destructive">
            {errorMessage}
          </div>
        )}

        {/* Google Login Card */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
          <button
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 rounded-xl border border-border bg-background hover:bg-accent/80 p-3 text-xs sm:text-sm font-semibold text-foreground transition shadow-sm"
          >
            {/* Google SVG Icon */}
            <svg className="h-4 w-4" viewBox="0 0 24 24">
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
            <span>{isLoading ? '연결 중...' : 'Google 계정으로 로그인'}</span>
          </button>

          <div className="relative flex items-center justify-center my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <span className="relative bg-card px-3 text-[11px] font-medium text-muted-foreground uppercase">
              또는 데모 계정으로 즉시 체험
            </span>
          </div>

          {/* Quick Demo Accounts */}
          <div className="space-y-2">
            {profiles.map((profile) => (
              <button
                key={profile.id}
                onClick={() => handleSelectDemoUser(profile)}
                className="w-full flex items-center justify-between p-2.5 rounded-xl border border-border/70 hover:border-primary/50 hover:bg-accent/50 transition text-left"
              >
                <div className="flex items-center gap-2.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={profile.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                    alt={profile.full_name}
                    className="h-8 w-8 rounded-full object-cover border border-border"
                  />
                  <div>
                    <div className="text-xs font-bold text-foreground">{profile.full_name}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {profile.role === 'admin'
                        ? '총괄 관리자 (모든 팀 열람)'
                        : profile.team_id === 'planning'
                        ? '기획팀 멤버'
                        : profile.team_id === 'design'
                        ? '디자인팀 멤버'
                        : '개발팀 멤버'}
                    </div>
                  </div>
                </div>

                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        </div>

        {/* Info Note */}
        <div className="rounded-xl border border-border bg-secondary/40 p-3.5 text-xs text-muted-foreground text-center">
          <p className="text-[11px]">
            Supabase 환경변수 설정 시 실제 Google OAuth 및 RLS가 동작하며, 환경변수 미설정 시 데모 모드로 동작합니다.
          </p>
        </div>
      </div>
    </div>
  );
}
