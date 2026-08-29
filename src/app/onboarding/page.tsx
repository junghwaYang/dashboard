'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useDashboard } from '@/context/dashboard-context';
import { TeamId } from '@/types/dashboard';
import { createClient } from '@/lib/supabase/client';
import { 
  Lightbulb, 
  Palette, 
  Code2, 
  CheckCircle2, 
  ArrowRight, 
  Users,
  AlertCircle
} from 'lucide-react';

export default function OnboardingPage() {
  const router = useRouter();
  const { currentProfile, authUser, setUserTeam, refreshData } = useDashboard();

  const [selectedTeam, setSelectedTeam] = useState<TeamId>(
    currentProfile?.team_id || 'planning'
  );
  const [fullName, setFullName] = useState(
    currentProfile?.full_name || authUser?.user_metadata?.full_name || ''
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (currentProfile?.team_id) {
      setSelectedTeam(currentProfile.team_id);
    }
    if (currentProfile?.full_name) {
      setFullName(currentProfile.full_name);
    }
  }, [currentProfile]);

  const teamOptions = [
    {
      id: 'planning' as TeamId,
      name: '기획팀',
      icon: Lightbulb,
      color: 'border-blue-500 bg-blue-50/50 text-blue-700',
      badge: 'bg-blue-100 text-blue-800',
      desc: '서비스 기획, 요구사항 정의, 비즈니스 모델 및 일정 로드맵 관리',
    },
    {
      id: 'design' as TeamId,
      name: '디자인팀',
      icon: Palette,
      color: 'border-purple-500 bg-purple-50/50 text-purple-700',
      badge: 'bg-purple-100 text-purple-800',
      desc: 'UI/UX 시안, 프로토타이핑, 디자인 시스템 및 브랜드 에셋 관리',
    },
    {
      id: 'development' as TeamId,
      name: '개발팀',
      icon: Code2,
      color: 'border-emerald-500 bg-emerald-50/50 text-emerald-700',
      badge: 'bg-emerald-100 text-emerald-800',
      desc: '웹/앱 프론트엔드, 백엔드 API, 데이터베이스 및 클라우드 인프라 개발',
    },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    const supabase = createClient();
    if (!supabase) {
      setErrorMessage('Supabase 클라이언트가 초기화되지 않았습니다.');
      setIsSubmitting(false);
      return;
    }

    try {
      if (authUser) {
        const { error } = await supabase
          .from('profiles')
          .update({
            full_name: fullName.trim() || '사용자',
            team_id: selectedTeam,
            updated_at: new Date().toISOString(),
          })
          .eq('id', authUser.id);

        if (error) throw error;
        await refreshData();
      } else {
        await setUserTeam(selectedTeam);
      }

      router.push(`/teams/${selectedTeam}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '팀 설정 저장 중 오류가 발생했습니다.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center p-4">
      <div className="w-full max-w-xl space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-1">
            <Users className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-black text-foreground tracking-tight">
            환영합니다! 소속 팀을 선택해 주세요
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            선택한 팀의 상세 업무를 관리할 수 있으며, 타 팀의 업무는 자동으로 격리 보호됩니다.
          </p>
        </div>

        {errorMessage && (
          <div className="flex items-center gap-2 rounded-xl bg-destructive/10 p-3 text-xs text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-6">
          {/* Name input */}
          <div>
            <label className="block text-xs font-bold text-foreground mb-1.5">
              사용자 이름 (실명)
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="예: 홍길동"
              className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>

          {/* Team Selection Cards */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-foreground">
              소속 팀 선택 <span className="text-primary">*</span>
            </label>

            <div className="grid grid-cols-1 gap-3">
              {teamOptions.map((opt) => {
                const isSelected = selectedTeam === opt.id;
                const Icon = opt.icon;
                return (
                  <div
                    key={opt.id}
                    onClick={() => setSelectedTeam(opt.id)}
                    className={`cursor-pointer rounded-xl border-2 p-4 transition flex items-center justify-between ${
                      isSelected
                        ? `${opt.color} shadow-sm ring-1 ring-primary/20`
                        : 'border-border bg-background hover:bg-accent/40'
                    }`}
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="p-2.5 rounded-xl bg-card border border-border">
                        <Icon className="h-5 w-5 text-foreground" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-foreground">{opt.name}</span>
                          <span className={`text-[10px] px-2 py-0.2 rounded-full font-bold ${opt.badge}`}>
                            {opt.id}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                      </div>
                    </div>

                    <div className="shrink-0 ml-3">
                      {isSelected ? (
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                      ) : (
                        <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/40" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-xs sm:text-sm font-bold text-primary-foreground shadow-sm hover:bg-primary/90 transition disabled:opacity-50"
            >
              <span>{isSubmitting ? '설정 저장 중...' : '소속 팀 설정 완료 및 시작하기'}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
