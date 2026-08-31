'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useDashboard } from '@/context/dashboard-context';
import { ReportView } from './ReportView';
import { markRepeatedIssues } from '@/lib/report/build-report';
import { formatCycleWeekRange } from '@/lib/report/cycle-week';
import type { ReportPayload, ReportScope, ReportStatus } from '@/types/report';
import type { TeamId } from '@/types/dashboard';
import {
  X, FileDown, CheckCircle2, Save, FileText,
} from 'lucide-react';

export interface ReportRow {
  id: string;
  cycle_week: string;
  scope: ReportScope;
  team_id: TeamId | null;
  status: ReportStatus;
  summary_text: string | null;
  payload: ReportPayload;
}

interface ReportDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: ReportRow | null;
  previousPayload: ReportPayload | null;
  canWrite: boolean;
  scope: ReportScope;
  teamId: TeamId | null;
  onReportUpdated: () => void;
}

/**
 * 주간 보고서 상세 모달
 *
 * WeeklyArchiveModal과 동일한 톤의 오버레이 마크업을 사용하며,
 * 요약 작성/저장/확정 기능과 본문(ReportView), Word 다운로드를 제공한다.
 */
export function ReportDetailModal({
  isOpen,
  onClose,
  report,
  previousPayload,
  canWrite,
  scope,
  teamId,
  onReportUpdated,
}: ReportDetailModalProps) {
  const { authUser } = useDashboard();
  const [draftSummary, setDraftSummary] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // 보고서 데이터 변경 시 draftSummary 동기화한다
  useEffect(() => {
    setDraftSummary(report?.summary_text ?? '');
    setNotice(null);
  }, [report]);

  // ESC 키로 모달을 닫는다
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // 반복 이슈 판정 (규칙 10)
  const repeatedIssueIds = useMemo(
    () => (report ? markRepeatedIssues(report.payload, previousPayload) : new Set<string>()),
    [report, previousPayload]
  );

  if (!isOpen || !report) return null;

  // 요약 저장과 확정은 RPC로만 한다. 테이블 직접 UPDATE 권한은 회수했다.
  // 작성자·확정자는 서버가 auth.uid()로 박으므로 클라이언트가 위조할 수 없다.
  const saveSummary = async () => {
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
    onReportUpdated();
  };

  const confirmReport = async () => {
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
    onReportUpdated();
  };

  const docxHref = `/api/reports/docx?week=${encodeURIComponent(report.cycle_week)}&scope=${scope}${
    scope === 'TEAM' ? `&team=${teamId}` : ''
  }`;

  const teamName = report.payload?.sections?.[0]?.team_name ?? report.team_id ?? '';
  const modalSubtitle = scope === 'ALL' ? '전체 주간 업무 보고서' : `${teamName} 주간 업무 보고서`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-5xl h-[88vh] flex flex-col bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/80 bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                <span className="text-base font-bold text-foreground">
                  {formatCycleWeekRange(report.cycle_week)}
                </span>
                <span className="text-[11px] bg-secondary text-secondary-foreground border border-border px-2 py-0.5 rounded-full font-semibold">
                  {report.cycle_week}
                </span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                    report.status === 'CONFIRMED'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}
                >
                  {report.status === 'CONFIRMED' ? '확정' : '미확정'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{modalSubtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={docxHref}
              className="flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition shadow-sm"
            >
              <FileDown className="h-4 w-4" />
              <span>Word 내려받기</span>
            </a>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/80 transition"
              title="닫기"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* 본문 (세로 스크롤) */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {notice && (
            <div className="rounded-xl border border-border bg-secondary/50 px-3.5 py-2.5 text-xs text-foreground">
              {notice}
            </div>
          )}

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
        </div>
      </div>
    </div>
  );
}
