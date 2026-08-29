'use client';

import React from 'react';
import { Task, TaskStatus } from '@/types/dashboard';
import { formatDate, getDaysRemaining } from '@/lib/utils';
import { 
  Calendar, 
  MoreVertical, 
  Edit3, 
  Trash2, 
  User, 
  ArrowRight,
  GripVertical 
} from 'lucide-react';
import { useDashboard } from '@/context/dashboard-context';

interface TaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
}

export function TaskCard({ task, onEdit, onDelete }: TaskCardProps) {
  const { updateTaskStatus } = useDashboard();
  const [showMenu, setShowMenu] = React.useState(false);

  const dueInfo = getDaysRemaining(task.due_date);

  const getPriorityStyle = (priority: string) => {
    switch (priority) {
      case 'URGENT':
        return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400';
      case 'HIGH':
        return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400';
      case 'MEDIUM':
        return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400';
      case 'LOW':
        return 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-400';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', task.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className="group relative rounded-xl border border-border bg-card p-4 shadow-sm hover:shadow-md hover:border-primary/50 transition cursor-grab active:cursor-grabbing"
    >
      {/* Top row: Priority & Menu */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition" />
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${getPriorityStyle(task.priority)}`}>
            {task.priority}
          </span>
        </div>

        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition"
          >
            <MoreVertical className="h-4 w-4" />
          </button>

          {showMenu && (
            <div
              className="absolute right-0 mt-1 w-32 rounded-xl border border-border bg-card p-1 shadow-lg z-20"
              onClick={() => setShowMenu(false)}
            >
              <button
                onClick={() => onEdit(task)}
                className="flex items-center gap-2 w-full p-1.5 text-xs text-foreground hover:bg-accent rounded-lg"
              >
                <Edit3 className="h-3.5 w-3.5" /> 수정
              </button>
              <button
                onClick={() => {
                  if (confirm('정말 이 업무를 삭제하시겠습니까?')) {
                    onDelete(task.id);
                  }
                }}
                className="flex items-center gap-2 w-full p-1.5 text-xs text-destructive hover:bg-destructive/10 rounded-lg"
              >
                <Trash2 className="h-3.5 w-3.5" /> 삭제
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Title */}
      <h4 
        onClick={() => onEdit(task)}
        className="text-xs font-bold text-foreground hover:text-primary transition cursor-pointer leading-snug"
      >
        {task.title}
      </h4>

      {/* Description Preview */}
      {task.description && (
        <p className="text-[11px] text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">
          {task.description}
        </p>
      )}

      {/* Footer: Due Date & Assignee */}
      <div className="mt-3.5 pt-2.5 border-t border-border/60 flex items-center justify-between text-[11px]">
        {/* Due Date */}
        {task.due_date ? (
          <div
            className={`flex items-center gap-1 font-medium ${
              dueInfo.isOverdue ? 'text-destructive font-semibold' : 'text-muted-foreground'
            }`}
          >
            <Calendar className="h-3 w-3" />
            <span>{dueInfo.label}</span>
          </div>
        ) : (
          <span className="text-muted-foreground/60 text-[10px]">마감일 없음</span>
        )}

        {/* Assignee */}
        <div className="flex items-center gap-1.5">
          {task.assignee ? (
            <div className="flex items-center gap-1" title={`담당자: ${task.assignee.full_name}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={task.assignee.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                alt={task.assignee.full_name}
                className="h-5 w-5 rounded-full object-cover border border-border"
              />
              <span className="text-[11px] font-medium text-foreground truncate max-w-[70px]">
                {task.assignee.full_name.split(' ')[0]}
              </span>
            </div>
          ) : (
            <span className="text-[10px] text-muted-foreground/70 flex items-center gap-0.5">
              <User className="h-3 w-3" /> 미지정
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
