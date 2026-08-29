'use client';

import React, { useState, useEffect } from 'react';
import { Task, TeamId, TaskStatus, TaskPriority } from '@/types/dashboard';
import { useDashboard } from '@/context/dashboard-context';
import { X, Calendar, AlertCircle, User, Flag, CheckCircle } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  teamId: TeamId;
  taskToEdit?: Task | null;
}

export function TaskModal({ isOpen, onClose, teamId, taskToEdit }: TaskModalProps) {
  const { createTask, updateTask, profiles, teams } = useDashboard();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>('TODO');
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM');
  const [assigneeId, setAssigneeId] = useState<string>('unassigned');
  const [dueDate, setDueDate] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (taskToEdit) {
      setTitle(taskToEdit.title);
      setDescription(taskToEdit.description || '');
      setStatus(taskToEdit.status);
      setPriority(taskToEdit.priority);
      setAssigneeId(taskToEdit.assignee_id || 'unassigned');
      setDueDate(taskToEdit.due_date || '');
    } else {
      setTitle('');
      setDescription('');
      setStatus('TODO');
      setPriority('MEDIUM');
      setAssigneeId('unassigned');
      setDueDate('');
    }
    setErrorMessage(null);
  }, [taskToEdit, isOpen]);

  if (!isOpen) return null;

  const currentTeam = teams.find((t) => t.id === teamId);
  const teamProfiles = profiles.filter((p) => p.team_id === teamId || p.role === 'admin');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMessage('업무 제목을 입력해 주세요.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const actualAssigneeId = assigneeId === 'unassigned' ? null : assigneeId;

    try {
      if (taskToEdit) {
        await updateTask(taskToEdit.id, {
          title: title.trim(),
          description: description.trim() || null,
          status,
          priority,
          assignee_id: actualAssigneeId,
          due_date: dueDate || null,
        });
      } else {
        await createTask({
          title: title.trim(),
          description: description.trim() || null,
          status,
          priority,
          team_id: teamId,
          assignee_id: actualAssigneeId,
          due_date: dueDate || null,
        });
      }
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '저장 중 오류가 발생했습니다.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-150 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/80 pb-4 mb-5">
          <div>
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">
              {currentTeam?.name || teamId} 워크스페이스
            </span>
            <h2 className="text-lg font-bold text-foreground mt-0.5">
              {taskToEdit ? '업무 수정' : '새 업무 등록'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {errorMessage && (
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-destructive/10 p-3 text-xs text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              업무 제목 <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 4분기 디자인 시스템 및 컴포넌트 라이브러리 제작"
              className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              상세 설명
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="업무 목표, 참고 링크, 세부 요구사항을 자유롭게 작성해 주세요."
              className="w-full rounded-xl border border-input bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>

          {/* Status & Priority Row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1 flex items-center gap-1">
                <CheckCircle className="h-3.5 w-3.5 text-primary" /> 상태
              </label>
              <Select value={status} onValueChange={(val) => setStatus(val as TaskStatus)}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODO">대기 (TODO)</SelectItem>
                  <SelectItem value="IN_PROGRESS">진행중 (IN_PROGRESS)</SelectItem>
                  <SelectItem value="IN_REVIEW">검토중 (IN_REVIEW)</SelectItem>
                  <SelectItem value="DONE">완료 (DONE)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1 flex items-center gap-1">
                <Flag className="h-3.5 w-3.5 text-amber-500" /> 우선순위
              </label>
              <Select value={priority} onValueChange={(val) => setPriority(val as TaskPriority)}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">낮음 (LOW)</SelectItem>
                  <SelectItem value="MEDIUM">보통 (MEDIUM)</SelectItem>
                  <SelectItem value="HIGH">높음 (HIGH)</SelectItem>
                  <SelectItem value="URGENT">긴급 (URGENT)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Assignee & Due Date Row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1 flex items-center gap-1">
                <User className="h-3.5 w-3.5 text-blue-500" /> 담당자
              </label>
              <Select value={assigneeId} onValueChange={(val) => setAssigneeId(val)}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="담당자 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">담당자 미지정</SelectItem>
                  {teamProfiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name} ({p.role === 'admin' ? '관리자' : p.team_id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1 flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-red-500" /> 마감일
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full h-10 rounded-xl border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
              />
            </div>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-border/80">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2.5 text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-foreground transition"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition disabled:opacity-50"
            >
              {isSubmitting ? '저장 중...' : taskToEdit ? '수정 완료' : '업무 등록'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
