'use client';

import React, { useState } from 'react';
import { Task, TaskStatus } from '@/types/dashboard';
import { TaskCard } from './TaskCard';
import { Plus } from 'lucide-react';

interface KanbanColumnProps {
  status: TaskStatus;
  title: string;
  tasks: Task[];
  onEditTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
  onAddTask: (status: TaskStatus) => void;
  onDropTask: (taskId: string, targetStatus: TaskStatus) => void;
}

export function KanbanColumn({
  status,
  title,
  tasks,
  onEditTask,
  onDeleteTask,
  onAddTask,
  onDropTask,
}: KanbanColumnProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const getStatusColor = (s: TaskStatus) => {
    switch (s) {
      case 'TODO':
        return {
          dot: 'bg-slate-400',
          badge: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
          border: 'hover:border-slate-300',
        };
      case 'IN_PROGRESS':
        return {
          dot: 'bg-blue-500',
          badge: 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300',
          border: 'hover:border-blue-300',
        };
      case 'IN_REVIEW':
        return {
          dot: 'bg-amber-500',
          badge: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
          border: 'hover:border-amber-300',
        };
      case 'DONE':
        return {
          dot: 'bg-emerald-500',
          badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
          border: 'hover:border-emerald-300',
        };
    }
  };

  const style = getStatusColor(status);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const taskId = e.dataTransfer.getData('text/plain');
    if (taskId) {
      onDropTask(taskId, status);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex flex-col rounded-2xl bg-secondary/30 border p-3.5 min-h-[520px] transition ${
        isDragOver ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-border/70'
      }`}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${style.dot}`} />
          <h3 className="text-xs font-bold text-foreground">{title}</h3>
          <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${style.badge}`}>
            {tasks.length}
          </span>
        </div>

        <button
          onClick={() => onAddTask(status)}
          className="p-1 rounded-lg text-muted-foreground hover:bg-card hover:text-foreground transition"
          title={`${title}에 새 업무 추가`}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* Card List */}
      <div className="space-y-3 flex-1 overflow-y-auto">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onEdit={onEditTask}
            onDelete={onDeleteTask}
          />
        ))}

        {tasks.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 rounded-xl border border-dashed border-border/80 text-muted-foreground/60 text-xs">
            <span>업무가 없습니다</span>
          </div>
        )}
      </div>
    </div>
  );
}
