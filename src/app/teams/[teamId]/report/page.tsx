'use client';

import React, { Suspense } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ReportPageShell } from '@/components/report/ReportPageShell';
import { useDashboard } from '@/context/dashboard-context';
import type { TeamId } from '@/types/dashboard';

/**
 * 팀별 주간 보고서 (기획서 5.1)
 *   /teams/[teamId]/report?week=2026-W35
 *
 * 열람·작성 권한은 weekly_reports RLS가 강제한다(결정 9).
 * 권한이 없으면 행이 조회되지 않아 "보고서 없음"으로 보인다.
 */
export default function TeamReportPage() {
  const params = useParams();
  const teamId = params.teamId as TeamId;
  const { teams } = useDashboard();

  const validTeams: TeamId[] = ['planning', 'design', 'development'];
  if (!validTeams.includes(teamId)) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <h2 className="text-xl font-bold text-foreground">존재하지 않는 팀입니다.</h2>
        <Link href="/" className="mt-4 text-xs font-semibold text-primary hover:underline">
          메인 대시보드로 돌아가기
        </Link>
      </div>
    );
  }

  const team = teams.find((t) => t.id === teamId);

  return (
    <Suspense fallback={<div className="py-20 text-center text-xs text-muted-foreground">불러오는 중…</div>}>
      <ReportPageShell
        scope="TEAM"
        teamId={teamId}
        title={`${team?.name || teamId} 주간 업무 보고서`}
      />
    </Suspense>
  );
}
