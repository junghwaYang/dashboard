'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useDashboard } from '@/context/dashboard-context';
import { currentCycleWeek, formatCycleWeekRange, previousCycleWeek } from '@/lib/report/cycle-week';
import { ReportDetailModal, type ReportRow } from './ReportDetailModal';
import type { ReportScope } from '@/types/report';
import type { TeamId } from '@/types/dashboard';
import {
  RefreshCw, Lock, AlertTriangle, ChevronRight,
} from 'lucide-react';

export function ReportPageShell({
  scope,
  teamId,
  title,
}: {
  scope: ReportScope;
  teamId: TeamId | null;
  title: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { currentProfile, authUser, isLoading: isDashboardLoading } = useDashboard();

  const [reports, setReports] = useState<ReportRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const selectedWeek = searchParams.get('week');

  const isAdmin = currentProfile?.role === 'admin';
  // 작성 권한 (결정 9). 팀별은 해당 팀 소속 + admin, 전체는 admin만.
  // 화면에서 숨기더라도 실제 차단은 weekly_reports RLS가 한다.
  const canWrite =
    scope === 'ALL' ? isAdmin : isAdmin || currentProfile?.team_id === teamId;

  const load = useCallback(async () => {
    const supabase = createClient();
    if (!supabase) {
      setError('Supabase 연결이 설정되지 않았습니다.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const select = 'id, cycle_week, scope, team_id, status, summary_text, payload';
    let q = supabase.from('weekly_reports').select(select).eq('scope', scope);
    q = scope === 'TEAM' ? q.eq('team_id', teamId!) : q.is('team_id', null);

    // 해당 scope/team의 생성된 보고서를 전부 조회한다 (최신순)
    const { data, error: err } = await q.order('cycle_week', { ascending: false });

    if (err) {
      setError(err.message);
      setReports([]);
    } else {
      setReports((data as ReportRow[]) ?? []);
    }

    setIsLoading(false);
  }, [scope, teamId]);

  useEffect(() => {
    if (!isDashboardLoading) load();
  }, [load, isDashboardLoading]);

  // 보고서 재생성 (기존 로직 및 권한 유지)
  const regenerate = async () => {
    setIsGenerating(true);
    setNotice(null);
    try {
      const targetWeek = selectedWeek || currentCycleWeek();
      const res = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cycle_week: targetWeek }),
      });
      const json = await res.json();
      if (!res.ok) {
        setNotice(`재생성 실패: ${json.error ?? res.statusText}`);
      } else {
        const skipped = (json.created ?? []).filter((c: { skipped: boolean }) => c.skipped).length;
        setNotice(
          skipped > 0
            ? `재생성했다. 확정된 보고서 ${skipped}건은 덮지 않았다.`
            : '재생성했다.'
        );
        load();
      }
    } catch (e) {
      setNotice(`재생성 실패: ${e instanceof Error ? e.message : String(e)}`);
    }
    setIsGenerating(false);
  };

  const openReportModal = (weekKey: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('week', weekKey);
    router.push(`${pathname}?${params.toString()}`);
  };

  const closeReportModal = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('week');
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  const activeReport = selectedWeek
    ? reports.find((r) => r.cycle_week === selectedWeek) ?? null
    : null;

  // 지난 주 스냅샷 (반복 이슈 판정용, 규칙 10)
  const previousPayload = activeReport
    ? reports.find((r) => r.cycle_week === previousCycleWeek(activeReport.cycle_week))?.payload ?? null
    : null;

  if (isDashboardLoading || isLoading) {
    return <div className="py-20 text-center text-xs text-muted-foreground">보고서 목록을 불러오는 중…</div>;
  }

  if (!authUser) {
    return (
      <div className="py-16 text-center space-y-3">
        <Lock className="h-8 w-8 mx-auto text-muted-foreground" />
        <p className="text-sm font-semibold text-foreground">로그인이 필요합니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200 max-w-5xl">
      {/* 목록 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] bg-secondary text-secondary-foreground border border-border px-2 py-0.5 rounded-full font-semibold">
              총 {reports.length}건
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">{title}</h1>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && (
            <button
              onClick={regenerate}
              disabled={isGenerating}
              className="flex items-center gap-1.5 rounded-xl bg-secondary px-3.5 py-2 text-xs font-semibold text-secondary-foreground hover:bg-accent transition disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
              <span>재생성</span>
            </button>
          )}
        </div>
      </div>

      {notice && (
        <div className="rounded-xl border border-border bg-secondary/50 px-3.5 py-2.5 text-xs text-foreground">
          {notice}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-3.5 py-2.5 text-xs text-destructive flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* 보고서 목록 */}
      {reports.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center space-y-3">
          <p className="text-sm font-semibold text-foreground">생성된 보고서가 없습니다.</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            보고서는 주간 마감 직후 자동으로 생성된다.
            <br />
            아직 마감하지 않았거나, 열람 권한이 없으면 여기에 아무것도 나오지 않는다.
          </p>
          {isAdmin && (
            <button
              onClick={regenerate}
              disabled={isGenerating}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
              <span>지금 생성</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => {
            const counts =
              r.scope === 'ALL'
                ? r.payload?.totals
                : r.payload?.sections?.[0]?.counts;

            return (
              // 마우스 없이도 열려야 한다. div에 onClick만 달면 키보드로 도달조차 못 한다.
              <div
                key={r.id}
                role="button"
                tabIndex={0}
                aria-label={`${formatCycleWeekRange(r.cycle_week)} 보고서 열기`}
                onClick={() => openReportModal(r.cycle_week)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openReportModal(r.cycle_week);
                  }
                }}
                className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-card border border-border hover:border-primary/40 hover:shadow-sm transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                        r.status === 'CONFIRMED'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}
                    >
                      {r.status === 'CONFIRMED' ? '확정' : '미확정'}
                    </span>
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground border border-border">
                      {r.cycle_week}
                    </span>
                    {counts && (
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                        <span>완료 {counts.done}</span>
                        <span>·</span>
                        <span>진행 {counts.in_progress}</span>
                        <span>·</span>
                        <span className={counts.issue > 0 ? 'text-red-600 font-semibold' : ''}>
                          이슈 {counts.issue}
                        </span>
                      </span>
                    )}
                  </div>

                  <h3 className="text-sm sm:text-base font-bold text-foreground group-hover:text-primary transition">
                    {formatCycleWeekRange(r.cycle_week)}
                  </h3>

                  {r.summary_text && (
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {r.summary_text}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 text-muted-foreground group-hover:text-primary transition">
                  <span className="text-xs font-semibold hidden sm:inline">보고서 보기</span>
                  <ChevronRight className="h-4 w-4" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 상세 모달 */}
      <ReportDetailModal
        isOpen={Boolean(selectedWeek && activeReport)}
        onClose={closeReportModal}
        report={activeReport}
        previousPayload={previousPayload}
        canWrite={canWrite}
        scope={scope}
        teamId={teamId}
        onReportUpdated={load}
      />
    </div>
  );
}
