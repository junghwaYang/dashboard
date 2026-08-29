'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { useDashboard } from '@/context/dashboard-context';
import { TeamId, Task, TaskStatus } from '@/types/dashboard';
import { KanbanBoard } from '@/components/kanban/KanbanBoard';
import { TaskListView } from '@/components/kanban/TaskListView';
import { TaskModal } from '@/components/common/TaskModal';
import Link from 'next/link';
import { 
  Lightbulb, 
  Palette, 
  Code2, 
  Lock, 
  Plus, 
  Kanban, 
  List, 
  ArrowLeft,
  Users,
  LogIn
} from 'lucide-react';

export default function TeamWorkspacePage() {
  const params = useParams();
  const teamId = params.teamId as TeamId;

  const { teams, getTasksByTeam, canAccessTeam, currentProfile, authUser } = useDashboard();
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
  const [, setInitialStatusForModal] = useState<TaskStatus>('TODO');

  const validTeams: TeamId[] = ['planning', 'design', 'development'];
  if (!validTeams.includes(teamId)) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <h2 className="text-xl font-bold text-foreground">존재하지 않는 팀입니다.</h2>
        <Link href="/" className="mt-4 text-xs font-semibold text-primary hover:underline">
          메인 대시보드로 돌아가기
        </Link>
      </div>
    );
  }

  const team = teams.find((t) => t.id === teamId);
  const isAllowed = canAccessTeam(teamId);
  const teamTasks = getTasksByTeam(teamId);

  const getTeamIcon = (id: TeamId) => {
    switch (id) {
      case 'planning':
        return <Lightbulb className="h-6 w-6 text-blue-600" />;
      case 'design':
        return <Palette className="h-6 w-6 text-purple-600" />;
      case 'development':
        return <Code2 className="h-6 w-6 text-emerald-600" />;
    }
  };

  const handleOpenAddModal = (status?: TaskStatus) => {
    setTaskToEdit(null);
    setInitialStatusForModal(status || 'TODO');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (task: Task) => {
    setTaskToEdit(task);
    setIsModalOpen(true);
  };

  // 🔒 ACCESS DENIED / TEAM ISOLATION VIEW
  if (!isAllowed) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 max-w-lg mx-auto text-center animate-in fade-in duration-200">
        <div className="h-16 w-16 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mb-5 border border-destructive/20">
          <Lock className="h-8 w-8" />
        </div>

        <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
          접근 권한이 제한되었습니다
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-2 leading-relaxed">
          <strong className="text-foreground">[{team?.name || teamId}]</strong> 워크스페이스는 해당 팀 소속 멤버 및 관리자만 상세 업무를 열람하고 관리할 수 있습니다.
        </p>

        <div className="mt-6 w-full rounded-xl border border-border bg-card p-4 text-left text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">내 현재 상태:</span>
            <span className="font-semibold text-foreground">
              {authUser
                ? currentProfile?.team_id
                  ? `${currentProfile.team_id.toUpperCase()}팀`
                  : '팀 미지정'
                : '로그인 필요'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">접근 시도 대상:</span>
            <span className="font-semibold text-destructive">{team?.name || teamId}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">보안 정책:</span>
            <span className="font-semibold text-destructive">팀별 격리 (RLS 적용)</span>
          </div>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row items-center gap-3 w-full">
          <Link
            href="/"
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-secondary px-4 py-2.5 text-xs font-semibold text-secondary-foreground hover:bg-accent transition"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>메인 대시보드로 돌아가기</span>
          </Link>
          {authUser ? (
            <Link
              href="/onboarding"
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition shadow-sm"
            >
              <Users className="h-4 w-4" />
              <span>소속 팀 설정하기</span>
            </Link>
          ) : (
            <Link
              href="/login"
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition shadow-sm"
            >
              <LogIn className="h-4 w-4" />
              <span>로그인하러 가기</span>
            </Link>
          )}
        </div>
      </div>
    );
  }

  const isMyTeam = currentProfile?.team_id === teamId;

  // ✅ AUTHORIZED TEAM WORKSPACE VIEW
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Workspace Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-5">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-secondary border border-border">
            {getTeamIcon(teamId)}
          </div>
          <div>
            {/* Top Label (내 팀 / 업무 수) */}
            <div className="flex items-center gap-2 mb-1">
              {isMyTeam && (
                <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-bold inline-flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  내 팀
                </span>
              )}
              <span className="text-[11px] bg-secondary text-secondary-foreground border border-border px-2 py-0.5 rounded-full font-semibold">
                {teamTasks.length}개의 업무
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">
              {team?.name || teamId} 워크스페이스
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">{team?.description}</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* View Switcher Tabs */}
          <div className="flex items-center rounded-xl bg-secondary p-1 border border-border">
            <button
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                viewMode === 'kanban'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Kanban className="h-3.5 w-3.5" />
              <span>칸반 보드</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                viewMode === 'list'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <List className="h-3.5 w-3.5" />
              <span>리스트 뷰</span>
            </button>
          </div>

          <button
            onClick={() => handleOpenAddModal()}
            className="flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span>새 업무</span>
          </button>
        </div>
      </div>

      {/* Main View Area */}
      {viewMode === 'kanban' ? (
        <KanbanBoard
          teamId={teamId}
          tasks={teamTasks}
          onEditTask={handleOpenEditModal}
          onAddTask={handleOpenAddModal}
        />
      ) : (
        <TaskListView
          teamId={teamId}
          tasks={teamTasks}
          onEditTask={handleOpenEditModal}
          onAddTask={() => handleOpenAddModal()}
        />
      )}

      {/* Task Modal */}
      <TaskModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        teamId={teamId}
        taskToEdit={taskToEdit}
      />
    </div>
  );
}
