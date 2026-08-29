'use client';

import React from 'react';
import Link from 'next/link';
import { useDashboard } from '@/context/dashboard-context';
import { formatDate, getDaysRemaining } from '@/lib/utils';
import { 
  CheckCircle2, 
  ArrowRight, 
  Calendar, 
  Inbox
} from 'lucide-react';
import { TaskStatus } from '@/types/dashboard';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function MyTasksWidget() {
  const { currentProfile, authUser, tasks, updateTaskStatus } = useDashboard();

  const userId = currentProfile?.id || authUser?.id;
  const myTasks = userId ? tasks.filter((t) => t.assignee_id === userId) : [];

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'URGENT':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'HIGH':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'MEDIUM':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'LOW':
        return 'bg-slate-100 text-slate-700 border-slate-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getStatusBadge = (status: TaskStatus) => {
    switch (status) {
      case 'TODO':
        return 'bg-secondary text-secondary-foreground';
      case 'IN_PROGRESS':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'IN_REVIEW':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'DONE':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
  };

  return (
    <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between border-b border-border/80 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-foreground">내 담당 업무 (My Tasks)</h3>
            <p className="text-[11px] text-muted-foreground">
              {currentProfile?.full_name || authUser?.email?.split('@')[0] || '나'} 님에게 배정된 실시간 업무 목록
            </p>
          </div>
        </div>

        {currentProfile?.team_id && (
          <Link
            href={`/teams/${currentProfile.team_id}`}
            className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
          >
            내 팀 보드로 이동 <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>

      {myTasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
          <Inbox className="h-10 w-10 stroke-[1.5] mb-2 opacity-50" />
          <p className="text-xs font-semibold">현재 배정된 업무가 없습니다.</p>
          <p className="text-[11px] mt-0.5">소속 팀 워크스페이스에서 새 업무를 생성하거나 담당자를 지정해 보세요.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {myTasks.map((task) => {
            const dueInfo = getDaysRemaining(task.due_date);
            return (
              <div
                key={task.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl border border-border bg-background hover:border-primary/40 transition gap-3"
              >
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${getPriorityBadge(task.priority)}`}>
                      {task.priority}
                    </span>
                    <span className="font-semibold text-xs text-foreground">{task.title}</span>
                  </div>
                  {task.description && (
                    <p className="text-[11px] text-muted-foreground line-clamp-1">{task.description}</p>
                  )}
                </div>

                <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                  {/* Due Date Indicator */}
                  {task.due_date && (
                    <span
                      className={`text-[11px] flex items-center gap-1 font-medium ${
                        dueInfo.isOverdue ? 'text-destructive font-bold' : 'text-muted-foreground'
                      }`}
                    >
                      <Calendar className="h-3.5 w-3.5" />
                      {formatDate(task.due_date)} ({dueInfo.label})
                    </span>
                  )}

                  {/* shadcn Custom Select */}
                  <div className="w-28">
                    <Select
                      value={task.status}
                      onValueChange={(val) => updateTaskStatus(task.id, val as TaskStatus)}
                    >
                      <SelectTrigger className={`h-8 text-xs font-semibold border ${getStatusBadge(task.status)}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TODO">대기</SelectItem>
                        <SelectItem value="IN_PROGRESS">진행중</SelectItem>
                        <SelectItem value="IN_REVIEW">검토중</SelectItem>
                        <SelectItem value="DONE">완료</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
