'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useDashboard } from '@/context/dashboard-context';
import { ReportView } from './ReportView';
import { markRepeatedIssues } from '@/lib/report/build-report';
import { currentCycleWeek, previousCycleWeek, nextCycleWeek } from '@/lib/report/cycle-week';
import type { ReportPayload, ReportScope, ReportStatus } from '@/types/report';
import type { TeamId } from '@/types/dashboard';
import {
  FileDown, RefreshCw, CheckCircle2, ChevronLeft, ChevronRight,
  Lock, AlertTriangle, Save,
} from 'lucide-react';

interface ReportRow {
  id: string;
  cycle_week: string;
  scope: ReportScope;
  team_id: TeamId | null;
  status: ReportStatus;
  summary_text: string | null;
  payload: ReportPayload;
}

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
  const searchParams = useSearchParams();
  const { currentProfile, authUser, isLoading: isDashboardLoading } = useDashboard();

  const week = searchParams.get('week') || currentCycleWeek();

  const [report, setReport] = useState<ReportRow | null>(null);
  const [previousPayload, setPreviousPayload] = useState<ReportPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draftSummary, setDraftSummary] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

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
    const base = () => {
      const q = supabase.from('weekly_reports').select(select).eq('scope', scope);
      return scope === 'TEAM' ? q.eq('team_id', teamId!) : q.is('team_id', null);
    };

    const { data, error: err } = await base().eq('cycle_week', week).maybeSingle();

    if (err) {
      setError(err.message);
      setReport(null);
    } else {
      setReport((data as ReportRow | null) ?? null);
      setDraftSummary((data as ReportRow | null)?.summary_text ?? '');
    }

    // 반복 이슈 판정용 지난 주 스냅샷 (규칙 10)
    const { data: prev } = await base().eq('cycle_week', previousCycleWeek(week)).maybeSingle();
    setPreviousPayload(((prev as ReportRow | null)?.payload as ReportPayload) ?? null);

    setIsLoading(false);
  }, [scope, teamId, week]);

  useEffect(() => {
    if (!isDashboardLoading) load();
  }, [load, isDashboardLoading]);

  const repeatedIssueIds = useMemo(
    () => (report ? markRepeatedIssues(report.payload, previousPayload) : new Set<string>()),
    [report, previousPayload]
  );

  const goWeek = (target: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('week', target);
    router.push(`?${params.toString()}`);
  };

  // 요약 저장과 확정은 RPC로만 한다. 테이블 직접 UPDATE 권한은 회수했다.
  // 작성자·확정자는 서버가 auth.uid()로 박으므로 클라이언트가 위조할 수 없다.
  const saveSummary = async () => {
    if (!report) return;
    const supabase = createClient();
    if (!supabase || !authUser) return;

    setIsSaving(true);
    setNotice(null);
    const { error: err } = await supabase.rpc('save_weekly_report_summary', {
      p_report_id: report.id,
      p_summary: draftSummary,
    });
    setIsSaving(false);

    if (err) {
      setNotice(`요약 저장 실패: ${err.message}`);
      return;
    }
    setNotice('요약을 저장했다.');
    load();
  };

  const confirmReport = async () => {
    if (!report) return;
    const supabase = createClient();
    if (!supabase || !authUser) return;

    setIsSaving(true);
    setNotice(null);
    const { error: err } = await supabase.rpc('confirm_weekly_report', {
      p_report_id: report.id,
      p_summary: draftSummary,
    });
    setIsSaving(false);

    if (err) {
      setNotice(`확정 실패: ${err.message}`);
      return;
    }
    setNotice('보고서를 확정했다. 확정은 되돌릴 수 없고, 이후 자동 재생성이 덮지 않는다.');
    load();
  };

  const regenerate = async () => {
    setIsGenerating(true);
    setNotice(null);
    try {
      const res = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cycle_week: week }),
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

  const docxHref = `/api/reports/docx?week=${encodeURIComponent(week)}&scope=${scope}${
    scope === 'TEAM' ? `&team=${teamId}` : ''
  }`;

  if (isDashboardLoading || isLoading) {
    return <div className="py-20 text-center text-xs text-muted-foreground">보고서를 불러오는 중…</div>;
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
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] bg-secondary text-secondary-foreground border border-border px-2 py-0.5 rounded-full font-semibold">
              {week}
            </span>
            {report && (
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                  report.status === 'CONFIRMED'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}
              >
                {report.status === 'CONFIRMED' ? '확정' : '미확정'}
              </span>
            )}
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">{title}</h1>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center rounded-xl bg-secondary p-1 border border-border">
            <button
              onClick={() => goWeek(previousCycleWeek(week))}
              className="p-1.5 rounded-lg hover:bg-card text-muted-foreground hover:text-foreground transition"
              title="이전 주"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => goWeek(currentCycleWeek())}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold text-muted-foreground hover:bg-card hover:text-foreground transition"
            >
              이번 주
            </button>
            <button
              onClick={() => goWeek(nextCycleWeek(week))}
              className="p-1.5 rounded-lg hover:bg-card text-muted-foreground hover:text-foreground transition"
              title="다음 주"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {isAdmin && (
            <button
              onClick={regenerate}
              disabled={isGenerating}
              className="flex items-center gap-1.5 rounded-xl bg-secondary px-3 py-2 text-xs font-semibold text-secondary-foreground hover:bg-accent transition disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
              <span>재생성</span>
            </button>
          )}

          {report && (
            <a
              href={docxHref}
              className="flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition shadow-sm"
            >
              <FileDown className="h-4 w-4" />
              <span>Word 내려받기</span>
            </a>
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

      {!report ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center space-y-3">
          <p className="text-sm font-semibold text-foreground">{week} 보고서가 없습니다.</p>
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
        <>
          {/* 요약 작성 영역 (결정 4). 자동 생성 직후에는 비어 있다. */}
          {canWrite && (
            <div className="rounded-2xl border border-border bg-card p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-foreground">이번 주 요약 작성</label>
                <span className="text-[10px] text-muted-foreground">
                  짧게 쓴다. 한 항목 두 줄 이내. 추측 표현을 쓰지 않는다. ({draftSummary.length}/5000)
                </span>
              </div>
              <textarea
                value={draftSummary}
                onChange={(e) => setDraftSummary(e.target.value)}
                rows={4}
                maxLength={5000}
                placeholder="완료된 일은 과거형으로, 진행중인 일은 현재형으로 쓴다."
                disabled={report.status === 'CONFIRMED'}
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-xs text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60 resize-y"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={saveSummary}
                  disabled={isSaving || report.status === 'CONFIRMED'}
                  className="flex items-center gap-1.5 rounded-xl bg-secondary px-3 py-2 text-xs font-semibold text-secondary-foreground hover:bg-accent transition disabled:opacity-50"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>요약 저장</span>
                </button>
                <button
                  onClick={confirmReport}
                  disabled={isSaving || report.status === 'CONFIRMED'}
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition disabled:opacity-50"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>{report.status === 'CONFIRMED' ? '확정됨' : '확정하기'}</span>
                </button>
                <span className="text-[11px] text-muted-foreground">
                  {report.status === 'CONFIRMED'
                    ? '확정됐다. 되돌릴 수 없고 자동 재생성이 덮어쓰지 않는다.'
                    : '확정하면 되돌릴 수 없다.'}
                </span>
              </div>
            </div>
          )}

          <ReportView
            payload={report.payload}
            summaryText={report.summary_text}
            repeatedIssueIds={repeatedIssueIds}
          />
        </>
      )}
    </div>
  );
}
