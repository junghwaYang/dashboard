'use client';

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { 
  Team, 
  Profile, 
  Task, 
  TeamId, 
  TaskStatus, 
  TeamSummaryStat, 
  OverviewMetrics, 
  UserRole,
  WeeklyArchiveLog,
  ArchiveExecutionResult,
  Project
} from '@/types/dashboard';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';

// 👑 최고관리자 권한을 가진 화이트리스트 이메일 목록
export const SUPER_ADMIN_EMAILS = ['siltarre@gmail.com'];

interface DashboardContextType {
  teams: Team[];
  profiles: Profile[];
  tasks: Task[];
  projects: Project[];
  authUser: User | null;
  currentProfile: Profile | null;
  isLoading: boolean;
  isSupabaseConnected: boolean;
  isSuperAdmin: boolean;
  setUserTeam: (teamId: TeamId) => Promise<void>;
  setUserRole: (role: UserRole) => Promise<void>;
  createTask: (taskData: {
    title: string;
    description: string | null;
    status: TaskStatus;
    priority: Task['priority'];
    team_id: TeamId;
    assignee_id: string | null;
    due_date: string | null;
    project_id?: string | null;
    issue_note?: string | null;
  }) => Promise<Task>;
  updateTask: (taskId: string, updates: Partial<Task>) => Promise<Task>;
  deleteTask: (taskId: string) => Promise<void>;
  updateTaskStatus: (taskId: string, status: TaskStatus) => Promise<void>;
  executeWeeklyArchive: () => Promise<ArchiveExecutionResult>;
  rollbackWeeklyArchive: (batchId: string) => Promise<ArchiveExecutionResult>;
  restoreArchivedTask: (taskId: string, targetStatus?: TaskStatus) => Promise<boolean>;
  fetchArchivedTasks: (teamId?: TeamId, cycleWeek?: string) => Promise<Task[]>;
  fetchArchiveLogs: () => Promise<WeeklyArchiveLog[]>;
  summaryStats: TeamSummaryStat[];
  overviewMetrics: OverviewMetrics;
  getTasksByTeam: (teamId: TeamId) => Task[];
  canAccessTeam: (teamId: TeamId) => boolean;
  signOut: () => Promise<void>;
  refreshData: () => Promise<void>;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [teams, setTeams] = useState<Team[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSupabaseConnected, setIsSupabaseConnected] = useState(false);

  const isSuperAdmin = useMemo(() => {
    return !!authUser?.email && SUPER_ADMIN_EMAILS.includes(authUser.email);
  }, [authUser]);

  // Fetch all live data from Supabase
  const fetchData = useCallback(async (user: User | null) => {
    const supabase = createClient();
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    try {
      // 1. Fetch Teams
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select('*')
        .order('id');

      if (!teamsError && teamsData) {
        setTeams(teamsData as Team[]);
        setIsSupabaseConnected(true);
      }

      // 2. Fetch Profiles
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('*');

      if (profilesData) {
        setProfiles(profilesData as Profile[]);
      }

      // 3. Set Current Profile from logged in User
      if (user) {
        const isUserAdmin = !!user.email && SUPER_ADMIN_EMAILS.includes(user.email);
        const expectedRole: UserRole = isUserAdmin ? 'admin' : 'member';

        let profile = profilesData?.find((p) => p.id === user.id);

        if (!profile) {
          // If profile doesn't exist yet, create or upsert profile
          const { data: newProfile, error: profileError } = await supabase
            .from('profiles')
            .upsert({
              id: user.id,
              email: user.email || '',
              full_name:
                user.user_metadata?.full_name ||
                user.user_metadata?.name ||
                user.email?.split('@')[0] ||
                '사용자',
              avatar_url: user.user_metadata?.avatar_url || null,
              role: expectedRole,
            })
            .select()
            .single();

          if (!profileError && newProfile) {
            profile = newProfile as Profile;
            setProfiles((prev) => [...prev.filter((p) => p.id !== profile!.id), profile!]);
          }
        } else if (isUserAdmin && profile.role !== 'admin') {
          // If super admin email but role is not admin, upgrade role
          const { data: updatedProfile } = await supabase
            .from('profiles')
            .update({ role: 'admin', updated_at: new Date().toISOString() })
            .eq('id', user.id)
            .select()
            .single();
          if (updatedProfile) profile = updatedProfile as Profile;
        } else if (!isUserAdmin && profile.role === 'admin') {
          // If not super admin email but has admin role, downgrade to member
          const { data: updatedProfile } = await supabase
            .from('profiles')
            .update({ role: 'member', updated_at: new Date().toISOString() })
            .eq('id', user.id)
            .select()
            .single();
          if (updatedProfile) profile = updatedProfile as Profile;
        }

        if (profile) {
          setCurrentProfile(profile as Profile);
        }
      } else {
        setCurrentProfile(null);
      }

      // 3-1. Fetch Projects (보고서 프로젝트별 묶음 / 업무 등록 시 선택 목록)
      const { data: projectsData } = await supabase
        .from('projects')
        .select('*')
        .order('team_id')
        .order('name');

      if (projectsData) {
        setProjects(projectsData as Project[]);
      }

      // 4. Fetch Active Tasks with Assignee profiles (is_archived = false)
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select('*, assignee:profiles!assignee_id(*)')
        .eq('is_archived', false)
        .order('created_at', { ascending: false });

      if (!tasksError && tasksData) {
        setTasks(tasksData as Task[]);
      }
    } catch (err) {
      console.error('Failed to fetch data from Supabase:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initialize Supabase Auth and Realtime Subscription
  useEffect(() => {
    const supabase = createClient();
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    // Get current active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      const user = session?.user ?? null;
      setAuthUser(user);
      fetchData(user);
    });

    // Listen to Auth State changes (Login, Logout, Token Refresh)
    const {
      data: { subscription: authSubscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null;
      setAuthUser(user);
      fetchData(user);
    });

    // Listen to Realtime Tasks table changes
    const tasksChannel = supabase
      .channel('public:tasks')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        async () => {
          const { data } = await supabase
            .from('tasks')
            .select('*, assignee:profiles!assignee_id(*)')
            .eq('is_archived', false)
            .order('created_at', { ascending: false });
          if (data) {
            setTasks(data as Task[]);
          }
        }
      )
      .subscribe();

    return () => {
      authSubscription.unsubscribe();
      supabase.removeChannel(tasksChannel);
    };
  }, [fetchData]);

  // Set / Update User's Team in Supabase
  const setUserTeam = useCallback(
    async (teamId: TeamId) => {
      const supabase = createClient();
      if (!supabase || !authUser) return;

      const { data, error } = await supabase
        .from('profiles')
        .update({
          team_id: teamId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', authUser.id)
        .select()
        .single();

      if (!error && data) {
        const updated = data as Profile;
        setCurrentProfile(updated);
        setProfiles((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      }
    },
    [authUser]
  );

  // Set / Toggle User's Role (오직 siltarre@gmail.com 만 가능)
  const setUserRole = useCallback(
    async (role: UserRole) => {
      const supabase = createClient();
      if (!supabase || !authUser) return;

      // 보안 검증: siltarre@gmail.com 계정이 아닌 경우 admin 승격 불가
      if (role === 'admin' && !SUPER_ADMIN_EMAILS.includes(authUser.email || '')) {
        console.warn('관리자 권한은 siltarre@gmail.com 계정만 부여받을 수 있습니다.');
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .update({
          role: role,
          updated_at: new Date().toISOString(),
        })
        .eq('id', authUser.id)
        .select()
        .single();

      if (!error && data) {
        const updated = data as Profile;
        setCurrentProfile(updated);
        setProfiles((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      }
    },
    [authUser]
  );

  // Create Task in Supabase
  const createTask = useCallback(
    async (taskData: {
      title: string;
      description: string | null;
      status: TaskStatus;
      priority: Task['priority'];
      team_id: TeamId;
      assignee_id: string | null;
      due_date: string | null;
      project_id?: string | null;
      issue_note?: string | null;
    }): Promise<Task> => {
      const supabase = createClient();
      if (!supabase) throw new Error('Supabase client is not available');

      const { data, error } = await supabase
        .from('tasks')
        .insert({
          ...taskData,
          created_by: authUser?.id || null,
        })
        .select('*, assignee:profiles!assignee_id(*)')
        .single();

      if (error) {
        throw new Error(error.message);
      }

      const newTask = data as Task;
      setTasks((prev) => [newTask, ...prev]);
      return newTask;
    },
    [authUser]
  );

  // Update Task in Supabase
  const updateTask = useCallback(
    async (taskId: string, updates: Partial<Task>): Promise<Task> => {
      const supabase = createClient();
      if (!supabase) throw new Error('Supabase client is not available');

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { assignee, ...cleanUpdates } = updates;

      const { data, error } = await supabase
        .from('tasks')
        .update({
          ...cleanUpdates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', taskId)
        .select('*, assignee:profiles!assignee_id(*)')
        .single();

      if (error) {
        throw new Error(error.message);
      }

      const updated = data as Task;
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
      return updated;
    },
    []
  );

  // Delete Task in Supabase
  const deleteTask = useCallback(async (taskId: string): Promise<void> => {
    const supabase = createClient();
    if (!supabase) throw new Error('Supabase client is not available');

    const { error } = await supabase.from('tasks').delete().eq('id', taskId);
    if (error) {
      throw new Error(error.message);
    }

    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  }, []);

  // Update Task Status
  const updateTaskStatus = useCallback(
    async (taskId: string, status: TaskStatus): Promise<void> => {
      await updateTask(taskId, { status });
    },
    [updateTask]
  );

  // Execute Weekly Archive (주간 업무 마감 및 아카이빙)
  const executeWeeklyArchive = useCallback(async (): Promise<ArchiveExecutionResult> => {
    const supabase = createClient();
    if (!supabase) throw new Error('Supabase client is not available');

    const { data, error } = await supabase.rpc('execute_weekly_archive', {
      p_executed_by: authUser?.id || null,
    });

    if (error) {
      throw new Error(error.message);
    }

    const result = data as ArchiveExecutionResult;
    await fetchData(authUser);
    return result;
  }, [authUser, fetchData]);

  // Rollback Weekly Archive (주간 마감 일괄 롤백)
  const rollbackWeeklyArchive = useCallback(
    async (batchId: string): Promise<ArchiveExecutionResult> => {
      const supabase = createClient();
      if (!supabase) throw new Error('Supabase client is not available');

      const { data, error } = await supabase.rpc('rollback_weekly_archive', {
        p_batch_id: batchId,
        p_executed_by: authUser?.id || null,
      });

      if (error) {
        throw new Error(error.message);
      }

      const result = data as ArchiveExecutionResult;
      await fetchData(authUser);
      return result;
    },
    [authUser, fetchData]
  );

  // Restore Archived Task (실수로 보관된 개별 업무 복구)
  const restoreArchivedTask = useCallback(
    async (taskId: string, targetStatus: TaskStatus = 'IN_PROGRESS'): Promise<boolean> => {
      const supabase = createClient();
      if (!supabase) throw new Error('Supabase client is not available');

      const { data, error } = await supabase.rpc('restore_archived_task', {
        p_task_id: taskId,
        p_target_status: targetStatus,
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data?.success) {
        throw new Error(data?.error || '업무 복구에 실패했습니다.');
      }

      await fetchData(authUser);
      return true;
    },
    [authUser, fetchData]
  );

  // Fetch Archived Tasks (보관된 업무 목록 조회)
  const fetchArchivedTasks = useCallback(
    async (teamId?: TeamId, cycleWeek?: string): Promise<Task[]> => {
      const supabase = createClient();
      if (!supabase) return [];

      let query = supabase
        .from('tasks')
        .select('*, assignee:profiles!assignee_id(*)')
        .eq('is_archived', true)
        .order('archived_at', { ascending: false });

      if (teamId) {
        query = query.eq('team_id', teamId);
      }
      if (cycleWeek) {
        query = query.eq('cycle_week', cycleWeek);
      }

      const { data, error } = await query;
      if (error) {
        console.error('Failed to fetch archived tasks:', error);
        return [];
      }

      return (data as Task[]) || [];
    },
    []
  );

  // Fetch Archive Logs (주간 마감 실행 이력 조회)
  const fetchArchiveLogs = useCallback(async (): Promise<WeeklyArchiveLog[]> => {
    const supabase = createClient();
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('weekly_archive_logs')
      .select('*, executor:profiles!executed_by(*)')
      .order('executed_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch archive logs:', error);
      return [];
    }

    return (data as WeeklyArchiveLog[]) || [];
  }, []);

  // Sign Out from Google / Supabase
  const signOut = useCallback(async () => {
    const supabase = createClient();
    if (supabase) {
      await supabase.auth.signOut();
      setAuthUser(null);
      setCurrentProfile(null);
      router.push('/login');
    }
  }, [router]);

  // Team Access Control Check
  const canAccessTeam = useCallback(
    (teamId: TeamId): boolean => {
      if (!currentProfile) return false;
      if (currentProfile.role === 'admin') return true;
      return currentProfile.team_id === teamId;
    },
    [currentProfile]
  );

  const getTasksByTeam = useCallback(
    (teamId: TeamId): Task[] => {
      return tasks.filter((task) => task.team_id === teamId);
    },
    [tasks]
  );

  // Summary stats for all teams
  const summaryStats = useMemo<TeamSummaryStat[]>(() => {
    const defaultTeams: { id: TeamId; name: string }[] = [
      { id: 'planning', name: '기획팀' },
      { id: 'design', name: '디자인팀' },
      { id: 'development', name: '개발팀' },
    ];

    const teamList = teams.length > 0 ? teams : defaultTeams;

    return teamList.map((team) => {
      const teamTasks = tasks.filter((t) => t.team_id === team.id);
      return {
        team_id: team.id as TeamId,
        team_name: team.name,
        total_count: teamTasks.length,
        todo_count: teamTasks.filter((t) => t.status === 'TODO').length,
        in_progress_count: teamTasks.filter((t) => t.status === 'IN_PROGRESS').length,
        in_review_count: teamTasks.filter((t) => t.status === 'IN_REVIEW').length,
        done_count: teamTasks.filter((t) => t.status === 'DONE').length,
        urgent_count: teamTasks.filter((t) => t.priority === 'URGENT' && t.status !== 'DONE').length,
      };
    });
  }, [teams, tasks]);

  // Overall KPI metrics
  const overviewMetrics = useMemo<OverviewMetrics>(() => {
    const total = tasks.length;
    const completed = tasks.filter((t) => t.status === 'DONE').length;
    const inProgress = tasks.filter((t) => t.status === 'IN_PROGRESS').length;
    const urgent = tasks.filter((t) => t.priority === 'URGENT' && t.status !== 'DONE').length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      totalTasks: total,
      completedTasks: completed,
      inProgressTasks: inProgress,
      urgentTasks: urgent,
      completionRate,
    };
  }, [tasks]);

  return (
    <DashboardContext.Provider
      value={{
        teams,
        profiles,
        tasks,
        projects,
        authUser,
        currentProfile,
        isLoading,
        isSupabaseConnected,
        isSuperAdmin,
        setUserTeam,
        setUserRole,
        createTask,
        updateTask,
        deleteTask,
        updateTaskStatus,
        executeWeeklyArchive,
        rollbackWeeklyArchive,
        restoreArchivedTask,
        fetchArchivedTasks,
        fetchArchiveLogs,
        summaryStats,
        overviewMetrics,
        getTasksByTeam,
        canAccessTeam,
        signOut,
        refreshData: () => fetchData(authUser),
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
}
