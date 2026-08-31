'use client';

import React, { Suspense } from 'react';
import { ReportPageShell } from '@/components/report/ReportPageShell';

/**
 * 전체 주간 보고서 (기획서 5.2)
 *   /report?week=2026-W35
 *
 * 열람·작성 권한은 admin만이다(결정 9). member는 타 팀 상세를 볼 권한이 없다.
 * 차단은 weekly_reports RLS가 한다.
 */
export default function AllReportPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-xs text-muted-foreground">불러오는 중…</div>}>
      <ReportPageShell scope="ALL" teamId={null} title="전체 주간 업무 보고서" />
    </Suspense>
  );
}
