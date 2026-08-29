'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useDashboard } from '@/context/dashboard-context';
import { Task, TeamId, WeeklyArchiveLog, TaskPriority } from '@/types/dashboard';
import {
  X,
  Archive,
  RotateCcw,
  History,
  CheckCircle2,
  AlertTriangle,
  Play,
  Search,
  Calendar,
  Layers,
  ShieldAlert,
  Loader2,
  RefreshCw,
} from 'lucide-react';

interface WeeklyArchiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTeamId?: TeamId;
}

const PRIORITY_STYLES: Record<TaskPriority, { label: string; bg: string; text: string }> = {
  LOW: { label: '낮음', bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-600 dark:text-slate-400' },
  MEDIUM: { label: '보통', bg: 'bg-blue-50 dark:bg-blue-950/40', text: 'text-blue-600 dark:text-blue-400' },
  HIGH: { label: '높음', bg: 'bg-amber-50 dark:bg-amber-950/40', text: 'text-amber-600 dark:text-amber-400' },
  URGENT: { label: '긴급', bg: 'bg-rose-50 dark:bg-rose-950/40', text: 'text-rose-600 dark:text-rose-400' },
};

const TEAM_NAMES: Record<string, string> = {
  planning: '기획팀',
  design: '디자인팀',
  development: '개발팀',
};

export function WeeklyArchiveModal({ isOpen, onClose, initialTeamId }: WeeklyArchiveModalProps) {
  const {
    tasks,
    teams,
    currentProfile,
    isSuperAdmin,
    executeWeeklyArchive,
    rollbackWeeklyArchive,
    restoreArchivedTask,
    fetchArchivedTasks,
    fetchArchiveLogs,
  } = useDashboard();

  const [activeTab, setActiveTab] = useState<'archive' | 'admin'>('archive');
  const [archivedTasks, setArchivedTasks] = useState<Task[]>([]);
  const [logs, setLogs] = useState<WeeklyArchiveLog[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  // Filters
  const [selectedTeam, setSelectedTeam] = useState<string>(initialTeamId || 'ALL');
  const [selectedWeek, setSelectedWeek] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Processing state
  const [processingTaskId, setProcessingTaskId] = useState<string | null>(null);
  const [isExecutingArchive, setIsExecutingArchive] = useState(false);
  const [rollingBackBatchId, setRollingBackBatchId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showConfirmArchive, setShowConfirmArchive] = useState(false);

  // Check if current user is admin
  const isAdmin = currentProfile?.role === 'admin' || isSuperAdmin;

  // Load archived tasks
  const loadArchivedTasks = useCallback(async () => {
    setIsLoadingTasks(true);
    try {
      const data = await fetchArchivedTasks();
      setArchivedTasks(data);
    } catch (err) {
      console.error('Failed to load archived tasks:', err);
    } finally {
      setIsLoadingTasks(false);
    }
  }, [fetchArchivedTasks]);

  // Load audit logs
  const loadLogs = useCallback(async () => {
    setIsLoadingLogs(true);
    try {
      const data = await fetchArchiveLogs();
      setLogs(data);
    } catch (err) {
      console.error('Failed to load archive logs:', err);
    } finally {
      setIsLoadingLogs(false);
    }
  }, [fetchArchiveLogs]);

  useEffect(() => {
    if (isOpen) {
      loadArchivedTasks();
      loadLogs();
      setActionMessage(null);
      setShowConfirmArchive(false);
    }
  }, [isOpen, loadArchivedTasks, loadLogs]);

  // Distinct weeks from archived tasks & logs
  const availableWeeks = useMemo(() => {
    const weeks = new Set<string>();
    archivedTasks.forEach((t) => {
      if (t.cycle_week) weeks.add(t.cycle_week);
    });
    logs.forEach((l) => {
      if (l.cycle_week) weeks.add(l.cycle_week);
    });
    return Array.from(weeks).sort().reverse();
  }, [archivedTasks, logs]);

  // Filtered archived tasks
  const filteredTasks = useMemo(() => {
    return archivedTasks.filter((task) => {
      if (selectedTeam !== 'ALL' && task.team_id !== selectedTeam) return false;
      if (selectedWeek !== 'ALL' && task.cycle_week !== selectedWeek) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = task.title.toLowerCase().includes(query);
        const matchesAssignee = task.assignee?.full_name.toLowerCase().includes(query) || false;
        if (!matchesTitle && !matchesAssignee) return false;
      }
      return true;
    });
  }, [archivedTasks, selectedTeam, selectedWeek, searchQuery]);

  // Count of pending DONE tasks in active list
  const pendingDoneCount = useMemo(() => {
    return tasks.filter((t) => t.status === 'DONE').length;
  }, [tasks]);

  // Handle restoring a single task
  const handleRestoreTask = async (taskId: string) => {
    setProcessingTaskId(taskId);
    setActionMessage(null);
    try {
      await restoreArchivedTask(taskId, 'IN_PROGRESS');
      setActionMessage({
        type: 'success',
        text: '업무가 성공적으로 활성 보드(진행 중)로 복구되었습니다.',
      });
      await loadArchivedTasks();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '업무 복구 중 오류가 발생했습니다.';
      setActionMessage({ type: 'error', text: msg });
    } finally {
      setProcessingTaskId(null);
    }
  };

  // Handle weekly archive manual execution
  const handleExecuteArchive = async () => {
    setIsExecutingArchive(true);
    setActionMessage(null);
    setShowConfirmArchive(false);
    try {
      const res = await executeWeeklyArchive();
      if (res.success) {
        setActionMessage({
          type: 'success',
          text: `주간 마감이 완료되었습니다! 총 ${res.archived_count || 0}건의 완료 업무가 보관 처리되었습니다. (처리 전: ${res.total_before}건 -> 현재 활성: ${res.active_after}건)`,
        });
        await Promise.all([loadArchivedTasks(), loadLogs()]);
      } else {
        setActionMessage({
          type: 'error',
          text: `주간 마감 실행 중 실패: ${res.error || '알 수 없는 오류'}`,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '주간 마감 실행 중 오류가 발생했습니다.';
      setActionMessage({ type: 'error', text: msg });
    } finally {
      setIsExecutingArchive(false);
    }
  };

  // Handle batch rollback
  const handleRollbackBatch = async (batchId: string) => {
    if (!window.confirm('이 주간 마감 배치를 정말 롤백하시겠습니까? 보관 처리되었던 완료 업무들이 활성 보드로 다시 복원됩니다.')) {
      return;
    }
    setRollingBackBatchId(batchId);
    setActionMessage(null);
    try {
      const res = await rollbackWeeklyArchive(batchId);
      if (res.success) {
        setActionMessage({
          type: 'success',
          text: `배치 롤백이 성공적으로 완료되었습니다! 총 ${res.restored_count || 0}건의 업무가 복구되었습니다.`,
        });
        await Promise.all([loadArchivedTasks(), loadLogs()]);
      } else {
        setActionMessage({
          type: 'error',
          text: `배치 롤백 실패: ${res.error || '알 수 없는 오류'}`,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '롤백 처리 중 오류가 발생했습니다.';
      setActionMessage({ type: 'error', text: msg });
    } finally {
      setRollingBackBatchId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl h-[88vh] flex flex-col bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/80 bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <Archive className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <span>주간 업무 보관함 & 마감 관리</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                  Supabase 연동
                </span>
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                완료된 업무를 주차별로 안전하게 보관하고, 실수로 완료된 업무는 언제든지 복구할 수 있습니다.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                loadArchivedTasks();
                loadLogs();
              }}
              title="새로고침"
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/80 transition"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/80 transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-border/80 bg-card">
          <button
            onClick={() => setActiveTab('archive')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-t-xl transition border-b-2 ${
              activeTab === 'archive'
                ? 'border-primary text-primary bg-primary/5'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            <Archive className="h-4 w-4" />
            <span>보관된 업무 목록</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-xs bg-muted text-muted-foreground">
              {archivedTasks.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('admin')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-t-xl transition border-b-2 ${
              activeTab === 'admin'
                ? 'border-primary text-primary bg-primary/5'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            <History className="h-4 w-4" />
            <span>주간 마감 실행 & 로그</span>
            {logs.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-xs bg-muted text-muted-foreground">
                {logs.length}
              </span>
            )}
          </button>
        </div>

        {/* Action Notification Alert */}
        {actionMessage && (
          <div
            className={`mx-6 mt-4 p-3.5 rounded-xl text-xs sm:text-sm flex items-center justify-between gap-3 ${
              actionMessage.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
            }`}
          >
            <div className="flex items-center gap-2">
              {actionMessage.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <AlertTriangle className="h-4 w-4 shrink-0" />
              )}
              <span>{actionMessage.text}</span>
            </div>
            <button
              onClick={() => setActionMessage(null)}
              className="text-xs opacity-70 hover:opacity-100"
            >
              닫기
            </button>
          </div>
        )}

        {/* Tab 1: Archived Tasks Explorer */}
        {activeTab === 'archive' && (
          <div className="flex-1 flex flex-col p-6 overflow-hidden space-y-4">
            {/* Filter Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-muted/40 rounded-xl border border-border/80">
              <div className="flex flex-wrap items-center gap-2">
                {/* Team Filter */}
                <div className="flex items-center gap-1.5 bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs">
                  <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                  <select
                    value={selectedTeam}
                    onChange={(e) => setSelectedTeam(e.target.value)}
                    className="bg-transparent border-none text-xs text-foreground focus:outline-none cursor-pointer"
                  >
                    <option value="ALL">모든 팀 전체</option>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Week Filter */}
                <div className="flex items-center gap-1.5 bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  <select
                    value={selectedWeek}
                    onChange={(e) => setSelectedWeek(e.target.value)}
                    className="bg-transparent border-none text-xs text-foreground focus:outline-none cursor-pointer"
                  >
                    <option value="ALL">모든 보관 주차</option>
                    {availableWeeks.map((week) => (
                      <option key={week} value={week}>
                        {week} 주차
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Search */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="업무명 또는 담당자 검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-card border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            {/* Tasks List */}
            <div className="flex-1 overflow-y-auto pr-1">
              {isLoadingTasks ? (
                <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="text-xs">보관된 업무 목록을 불러오는 중...</span>
                </div>
              ) : filteredTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 gap-2 text-center text-muted-foreground border-2 border-dashed border-border/80 rounded-2xl">
                  <Archive className="h-8 w-8 text-muted-foreground/60" />
                  <p className="text-sm font-semibold text-foreground">보관된 업무가 없습니다.</p>
                  <p className="text-xs max-w-sm">
                    완료된 업무는 매주 월요일 주간 마감 실행 시 자동으로 보관 처리됩니다.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredTasks.map((task) => {
                    const priorityConfig = PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.MEDIUM;
                    const isProcessing = processingTaskId === task.id;

                    return (
                      <div
                        key={task.id}
                        className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-card border border-border hover:border-primary/40 hover:shadow-sm transition"
                      >
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${priorityConfig.bg} ${priorityConfig.text}`}
                            >
                              {priorityConfig.label}
                            </span>
                            <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground">
                              {TEAM_NAMES[task.team_id] || task.team_id}
                            </span>
                            {task.cycle_week && (
                              <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                                📅 {task.cycle_week}
                              </span>
                            )}
                            <span className="text-[11px] text-muted-foreground">
                              보관일:{' '}
                              {task.archived_at
                                ? new Date(task.archived_at).toLocaleDateString('ko-KR', {
                                    month: 'short',
                                    day: 'numeric',
                                  })
                                : '-'}
                            </span>
                          </div>

                          <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition line-clamp-1">
                            {task.title}
                          </h3>

                          {task.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {task.description}
                            </p>
                          )}
                        </div>

                        {/* Assignee & Restore Action */}
                        <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/60">
                          {task.assignee ? (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">
                                {task.assignee.full_name.charAt(0)}
                              </span>
                              <span>{task.assignee.full_name}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">담당자 없음</span>
                          )}

                          <button
                            onClick={() => handleRestoreTask(task.id)}
                            disabled={isProcessing}
                            title="실수로 완료된 업무를 활성 보드(진행 중)로 되돌립니다"
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-secondary text-secondary-foreground hover:bg-primary hover:text-primary-foreground transition disabled:opacity-50"
                          >
                            {isProcessing ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <RotateCcw className="h-3.5 w-3.5" />
                            )}
                            <span>활성 보드로 복구</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Weekly Admin & Audit Logs */}
        {activeTab === 'admin' && (
          <div className="flex-1 flex flex-col p-6 overflow-y-auto space-y-6">
            {/* Action Banner */}
            <div className="p-5 rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-muted/40 border border-primary/20 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Play className="h-4 w-4 text-primary" />
                    <span>주간 마감 및 새 주차 시작 수동 실행</span>
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    현재 완료(`DONE`) 상태인 모든 업무를 이번 주차 아카이브로 보관하고, 미완료 업무는 새 주차로 유지합니다.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-xs text-muted-foreground">보관 대상 완료 업무</span>
                    <p className="text-lg font-extrabold text-primary">{pendingDoneCount} 건</p>
                  </div>

                  {isAdmin ? (
                    <button
                      onClick={() => setShowConfirmArchive(true)}
                      disabled={isExecutingArchive || pendingDoneCount === 0}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-xs sm:text-sm hover:bg-primary/90 transition shadow-sm disabled:opacity-50"
                    >
                      {isExecutingArchive ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Play className="h-4 w-4 fill-current" />
                      )}
                      <span>지금 주간 마감 실행</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-muted text-xs text-muted-foreground">
                      <ShieldAlert className="h-4 w-4 text-amber-500" />
                      <span>관리자 전용 기능</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Confirmation Box */}
              {showConfirmArchive && (
                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 space-y-3 animate-in fade-in">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div className="text-xs sm:text-sm text-amber-800 dark:text-amber-200">
                      <p className="font-bold">주간 마감을 실행하시겠습니까?</p>
                      <p className="mt-0.5">
                        완료(`DONE`) 상태인 총 <strong>{pendingDoneCount}건</strong>의 업무가 보관 처리되고 활성 보드에서 제외됩니다. 처리 전/후 건수가 감사 로그에 안전하게 기록됩니다.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => setShowConfirmArchive(false)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-background border border-border hover:bg-muted transition"
                    >
                      취소
                    </button>
                    <button
                      onClick={handleExecuteArchive}
                      disabled={isExecutingArchive}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition"
                    >
                      {isExecutingArchive && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      <span>확인 및 마감 실행</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Audit Logs Table */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <History className="h-4 w-4 text-primary" />
                  <span>주간 마감 실행 이력 (Audit Logs)</span>
                </h3>
                <span className="text-xs text-muted-foreground">총 {logs.length}회 기록됨</span>
              </div>

              {isLoadingLogs ? (
                <div className="flex items-center justify-center h-36 text-muted-foreground text-xs">
                  <Loader2 className="h-5 w-5 animate-spin text-primary mr-2" />
                  로그를 불러오는 중...
                </div>
              ) : logs.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground bg-muted/20 border border-border rounded-xl">
                  아직 기록된 주간 마감 이력이 없습니다.
                </div>
              ) : (
                <div className="border border-border rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-muted/60 text-muted-foreground font-semibold border-b border-border">
                        <tr>
                          <th className="px-4 py-3">실행 일시</th>
                          <th className="px-4 py-3">주차</th>
                          <th className="px-4 py-3">상태</th>
                          <th className="px-4 py-3">처리 전 총 건수</th>
                          <th className="px-4 py-3">보관 건수</th>
                          <th className="px-4 py-3">처리 후 활성</th>
                          <th className="px-4 py-3">실행자</th>
                          <th className="px-4 py-3 text-right">관리</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {logs.map((log) => {
                          const isRollingBack = rollingBackBatchId === log.id;
                          const isSuccess = log.status === 'SUCCESS';
                          const isRolledBack = log.status === 'ROLLED_BACK';

                          return (
                            <tr key={log.id} className="hover:bg-muted/30 transition">
                              <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">
                                {new Date(log.executed_at).toLocaleString('ko-KR', {
                                  year: 'numeric',
                                  month: '2-digit',
                                  day: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </td>
                              <td className="px-4 py-3 font-semibold text-primary">
                                {log.cycle_week}
                              </td>
                              <td className="px-4 py-3">
                                {isSuccess && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-semibold text-[11px]">
                                    <CheckCircle2 className="h-3 w-3" />
                                    성공
                                  </span>
                                )}
                                {isRolledBack && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-semibold text-[11px]">
                                    <RotateCcw className="h-3 w-3" />
                                    롤백됨
                                  </span>
                                )}
                                {log.status === 'FAILED' && (
                                  <span
                                    title={log.error_message || '실패'}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-semibold text-[11px]"
                                  >
                                    <AlertTriangle className="h-3 w-3" />
                                    실패
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-muted-foreground">
                                {log.total_tasks_before}건
                              </td>
                              <td className="px-4 py-3 font-bold text-foreground">
                                {log.archived_count}건
                              </td>
                              <td className="px-4 py-3 text-muted-foreground">
                                {log.active_tasks_after}건
                              </td>
                              <td className="px-4 py-3 text-muted-foreground">
                                {log.executor?.full_name || '시스템(자동)'}
                              </td>
                              <td className="px-4 py-3 text-right whitespace-nowrap">
                                {isAdmin && isSuccess && (
                                  <button
                                    onClick={() => handleRollbackBatch(log.id)}
                                    disabled={isRollingBack}
                                    title="이 마감 배치 전체를 취소하고 업무들을 복구합니다"
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-muted hover:bg-rose-500 hover:text-white transition disabled:opacity-50"
                                  >
                                    {isRollingBack ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <RotateCcw className="h-3 w-3" />
                                    )}
                                    <span>전체 롤백</span>
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
