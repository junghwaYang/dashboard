'use client';

import React from 'react';
import Link from 'next/link';
import { TeamSummaryStat, TeamId } from '@/types/dashboard';
import { useDashboard } from '@/context/dashboard-context';
import { 
  Lightbulb, 
  Palette, 
  Code2, 
  Lock, 
  ArrowRight, 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  Search 
} from 'lucide-react';

interface TeamSummaryCardProps {
  stat: TeamSummaryStat;
}

export function TeamSummaryCard({ stat }: TeamSummaryCardProps) {
  const { canAccessTeam, currentProfile } = useDashboard();
  const isAllowed = canAccessTeam(stat.team_id);
  const isMyTeam = currentProfile?.team_id === stat.team_id;

  const getTeamDetails = (teamId: TeamId) => {
    switch (teamId) {
      case 'planning':
        return {
          icon: Lightbulb,
          color: 'text-blue-600 bg-blue-50 border-blue-200',
          gaugeColor: 'bg-blue-500',
          desc: '프로덕트 요구사항 분석, PRD 및 로드맵 관리',
        };
      case 'design':
        return {
          icon: Palette,
          color: 'text-purple-600 bg-purple-50 border-purple-200',
          gaugeColor: 'bg-purple-500',
          desc: 'UI/UX 시안, 디자인 시스템 및 사용자 경험 설계',
        };
      case 'development':
        return {
          icon: Code2,
          color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
          gaugeColor: 'bg-emerald-500',
          desc: '프론트/백엔드 아키텍처, API 및 기능 구현',
        };
    }
  };

  const details = getTeamDetails(stat.team_id);
  const Icon = details.icon;
  const completionRate =
    stat.total_count > 0 ? Math.round((stat.done_count / stat.total_count) * 100) : 0;

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-border/80 bg-card p-5 shadow-sm transition hover:shadow-md">
      <div>
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl border ${details.color}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-foreground">{stat.team_name}</h3>
                {isMyTeam && (
                  <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-bold">
                    내 소속 팀
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{details.desc}</p>
            </div>
          </div>

          {!isAllowed && (
            <span
              title="타 팀의 상세 업무는 비공개 처리됩니다."
              className="flex items-center gap-1 rounded-full bg-secondary px-2 py-1 text-[11px] font-semibold text-muted-foreground border border-border"
            >
              <Lock className="h-3 w-3" /> 비공개
            </span>
          )}
        </div>

        {/* Progress Bar & Percentage */}
        <div className="mt-5 space-y-1.5">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-muted-foreground">진행 완료율</span>
            <span className="text-foreground">{completionRate}% ({stat.done_count}/{stat.total_count})</span>
          </div>
          <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
            <div
              className={`h-full ${details.gaugeColor} transition-all duration-500 rounded-full`}
              style={{ width: `${completionRate}%` }}
            />
          </div>
        </div>

        {/* Status Breakdown Grid */}
        <div className="mt-5 grid grid-cols-4 gap-2 text-center text-xs">
          <div className="rounded-xl bg-secondary/50 p-2 border border-border/60">
            <div className="text-[10px] text-muted-foreground font-medium">대기</div>
            <div className="text-sm font-bold text-foreground mt-0.5">{stat.todo_count}</div>
          </div>
          <div className="rounded-xl bg-blue-50/60 dark:bg-blue-950/20 p-2 border border-blue-100 dark:border-blue-900/30">
            <div className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">진행중</div>
            <div className="text-sm font-bold text-blue-700 dark:text-blue-300 mt-0.5">{stat.in_progress_count}</div>
          </div>
          <div className="rounded-xl bg-amber-50/60 dark:bg-amber-950/20 p-2 border border-amber-100 dark:border-amber-900/30">
            <div className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">검토중</div>
            <div className="text-sm font-bold text-amber-700 dark:text-amber-300 mt-0.5">{stat.in_review_count}</div>
          </div>
          <div className="rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 p-2 border border-emerald-100 dark:border-emerald-900/30">
            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">완료</div>
            <div className="text-sm font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">{stat.done_count}</div>
          </div>
        </div>

        {/* Urgent indicator */}
        {stat.urgent_count > 0 && (
          <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-red-50 dark:bg-red-950/30 px-2.5 py-1.5 text-[11px] font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/40">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>긴급 조치 필요 업무 {stat.urgent_count}건</span>
          </div>
        )}
      </div>

      {/* Action CTA */}
      <div className="mt-5 pt-3 border-t border-border/60">
        {isAllowed ? (
          <Link
            href={`/teams/${stat.team_id}`}
            className="flex items-center justify-between w-full rounded-xl bg-secondary/80 hover:bg-primary hover:text-primary-foreground px-3.5 py-2.5 text-xs font-semibold transition group"
          >
            <span>{stat.team_name} 칸반 보드 열기</span>
            <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        ) : (
          <div className="flex items-center justify-between w-full rounded-xl bg-secondary/30 px-3.5 py-2.5 text-xs text-muted-foreground border border-dashed border-border">
            <span className="flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5" />
              타 팀 상세 열람 제한
            </span>
            <span className="text-[11px] font-medium">수치만 조회</span>
          </div>
        )}
      </div>
    </div>
  );
}
