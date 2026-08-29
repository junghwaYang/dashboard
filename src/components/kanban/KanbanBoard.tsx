'use client';

import React from 'react';
import { Task, TaskStatus, TeamId } from '@/types/dashboard';
import { KanbanColumn } from './KanbanColumn';
import { useDashboard } from '@/context/dashboard-context';

interface KanbanBoardProps {
  teamId: TeamId;
  tasks: Task[];
  onEditTask: (task: Task) => void;
  onAddTask: (status?: TaskStatus) => void;
}

export function KanbanBoard({ teamId, tasks, onEditTask, onAddTask }: KanbanBoardProps) {
  const { deleteTask, updateTaskStatus } = useDashboard();

  const columns: { status: TaskStatus; title: string }[] = [
    { status: 'TODO', title: '대기' },
    { status: 'IN_PROGRESS', title: '진행중' },
    { status: 'IN_REVIEW', title: '검토중' },
    { status: 'DONE', title: '완료' },
  ];

  const handleDropTask = async (taskId: string, targetStatus: TaskStatus) => {
    try {
      await updateTaskStatus(taskId, targetStatus);
    } catch (error) {
      console.error('Failed to update task status:', error);
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {columns.map((col) => {
        const colTasks = tasks.filter((t) => t.status === col.status);
        return (
          <KanbanColumn
            key={col.status}
            status={col.status}
            title={col.title}
            tasks={colTasks}
            onEditTask={onEditTask}
            onDeleteTask={deleteTask}
            onAddTask={(status) => onAddTask(status)}
            onDropTask={handleDropTask}
          />
        );
      })}
    </div>
  );
}
