'use client';

import React, { useState } from 'react';
import { useDashboard } from '@/context/dashboard-context';
import { KpiWidget } from '@/components/dashboard/KpiWidget';
import { TeamSummaryCard } from '@/components/dashboard/TeamSummaryCard';
import { MyTasksWidget } from '@/components/dashboard/MyTasksWidget';
import { TaskModal } from '@/components/common/TaskModal';
import { 
  Sparkles, 
  Plus, 
  CalendarDays, 
  Layers, 
  TrendingUp, 
  ShieldCheck 
} from 'lucide-react';
import { TeamId } from '@/types/dashboard';

export default function OverviewPage() {
  const { currentProfile, summaryStats, overviewMetrics } = useDashboard();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const todayFormatted = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });

  const userTeamId: TeamId = currentProfile.team_id || 'planning';

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Top Banner / Welcome */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-primary">
            <CalendarDays className="h-3.5 w-3.5" />
            <span>{todayFormatted}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight mt-1">
            안녕하세요, <span className="text-primary">{currentProfile.full_name}</span> 님 👋
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            오늘의 전사 업무 현황 요약 및 소속 팀의 주요 마일스톤을 확인하세요.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {currentProfile.team_id && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs sm:text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition"
            >
              <Plus className="h-4 w-4" />
              <span>새 업무 등록</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Metrics */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <span>전사 업무 진행 지표</span>
          </h2>
        </div>
        <KpiWidget metrics={overviewMetrics} />
      </section>

      {/* Team Summary Cards (3 Teams) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              <span>팀별 현황 요약 (Planning / Design / Dev)</span>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              각 팀의 업무 집계 통계입니다. 상세 업무는 본인 소속 팀만 열람 가능합니다.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {summaryStats.map((stat) => (
            <TeamSummaryCard key={stat.team_id} stat={stat} />
          ))}
        </div>
      </section>

      {/* My Tasks Section */}
      <section>
        <MyTasksWidget />
      </section>

      {/* Task Modal */}
      <TaskModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        teamId={userTeamId}
      />
    </div>
  );
}
