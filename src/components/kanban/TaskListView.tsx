'use client';

import React, { useState, useMemo } from 'react';
import { Task, TaskStatus, TaskPriority, TeamId } from '@/types/dashboard';
import { useDashboard } from '@/context/dashboard-context';
import { formatDate, getDaysRemaining } from '@/lib/utils';
import { 
  Search, 
  Edit3, 
  Trash2, 
  Plus
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface TaskListViewProps {
  teamId: TeamId;
  tasks: Task[];
  onEditTask: (task: Task) => void;
  onAddTask: () => void;
}

export function TaskListView({ teamId, tasks, onEditTask, onAddTask }: TaskListViewProps) {
  const { deleteTask, updateTaskStatus } = useDashboard();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'due_date' | 'priority' | 'title'>('due_date');

  const filteredTasks = useMemo(() => {
    return tasks
      .filter((t) => {
        const matchesSearch =
          t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase()));
        const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;
        const matchesPriority = priorityFilter === 'ALL' || t.priority === priorityFilter;
        return matchesSearch && matchesStatus && matchesPriority;
      })
      .sort((a, b) => {
        if (sortBy === 'due_date') {
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        }
        if (sortBy === 'priority') {
          const weight: Record<TaskPriority, number> = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
          return weight[b.priority] - weight[a.priority];
        }
        return a.title.localeCompare(b.title);
      });
  }, [tasks, searchQuery, statusFilter, priorityFilter, sortBy]);

  const getPriorityStyle = (priority: TaskPriority) => {
    switch (priority) {
      case 'URGENT':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'HIGH':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'MEDIUM':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'LOW':
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-4">
      {/* Search & Filter Bar */}
      <div className="flex flex-col lg:flex-row gap-3 items-center justify-between bg-card p-4 rounded-2xl border border-border">
        <div className="relative w-full lg:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="업무 제목 또는 설명 검색..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-input bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          {/* Status Filter */}
          <div className="w-36">
            <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val)}>
              <SelectTrigger>
                <SelectValue placeholder="상태 필터" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">전체 상태</SelectItem>
                <SelectItem value="TODO">대기 (TODO)</SelectItem>
                <SelectItem value="IN_PROGRESS">진행중</SelectItem>
                <SelectItem value="IN_REVIEW">검토중</SelectItem>
                <SelectItem value="DONE">완료</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Priority Filter */}
          <div className="w-36">
            <Select value={priorityFilter} onValueChange={(val) => setPriorityFilter(val)}>
              <SelectTrigger>
                <SelectValue placeholder="우선순위 필터" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">전체 우선순위</SelectItem>
                <SelectItem value="URGENT">긴급 (URGENT)</SelectItem>
                <SelectItem value="HIGH">높음 (HIGH)</SelectItem>
                <SelectItem value="MEDIUM">보통 (MEDIUM)</SelectItem>
                <SelectItem value="LOW">낮음 (LOW)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Sort By */}
          <div className="w-36">
            <Select value={sortBy} onValueChange={(val) => setSortBy(val as 'due_date' | 'priority' | 'title')}>
              <SelectTrigger>
                <SelectValue placeholder="정렬 기준" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="due_date">마감일순 정렬</SelectItem>
                <SelectItem value="priority">우선순위순 정렬</SelectItem>
                <SelectItem value="title">가나다순 정렬</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <button
            onClick={onAddTask}
            className="flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition shadow-sm ml-auto"
          >
            <Plus className="h-4 w-4" /> 업무 추가
          </button>
        </div>
      </div>

      {/* Task Table */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-secondary/60 text-muted-foreground border-b border-border font-semibold">
              <tr>
                <th className="py-3.5 px-4 w-28">우선순위</th>
                <th className="py-3.5 px-4 min-w-[240px]">업무 제목 & 설명</th>
                <th className="py-3.5 px-4 w-36">상태</th>
                <th className="py-3.5 px-4 w-40">담당자</th>
                <th className="py-3.5 px-4 w-36">마감일</th>
                <th className="py-3.5 px-4 text-right w-24">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredTasks.map((task) => {
                const dueInfo = getDaysRemaining(task.due_date);
                return (
                  <tr key={task.id} className="hover:bg-accent/40 transition">
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded-full font-bold border text-[10px] ${getPriorityStyle(task.priority)}`}>
                        {task.priority}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div 
                        onClick={() => onEditTask(task)}
                        className="font-bold text-foreground hover:text-primary cursor-pointer text-xs"
                      >
                        {task.title}
                      </div>
                      {task.description && (
                        <div className="text-muted-foreground text-[11px] mt-0.5 line-clamp-1">
                          {task.description}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="w-28">
                        <Select
                          value={task.status}
                          onValueChange={(val) => updateTaskStatus(task.id, val as TaskStatus)}
                        >
                          <SelectTrigger className="h-8 text-xs font-semibold">
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
                    </td>
                    <td className="py-3.5 px-4">
                      {task.assignee ? (
                        <div className="flex items-center gap-1.5">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={task.assignee.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                            alt={task.assignee.full_name}
                            className="h-5 w-5 rounded-full object-cover border border-border"
                          />
                          <span className="font-medium text-foreground">{task.assignee.full_name}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-[11px]">미지정</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      {task.due_date ? (
                        <span className={`font-medium ${dueInfo.isOverdue ? 'text-destructive font-bold' : 'text-muted-foreground'}`}>
                          {formatDate(task.due_date)} ({dueInfo.label})
                        </span>
                      ) : (
                        <span className="text-muted-foreground/60">-</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => onEditTask(task)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition"
                          title="수정"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('정말 이 업무를 삭제하시겠습니까?')) {
                              deleteTask(task.id);
                            }
                          }}
                          className="p-1.5 rounded-lg text-destructive hover:bg-destructive/10 transition"
                          title="삭제"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredTasks.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground">
                    조건에 맞는 업무가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
