'use client';

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { Team, Profile, Task, TeamId, TaskStatus, TeamSummaryStat, OverviewMetrics } from '@/types/dashboard';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';

interface DashboardContextType {
  teams: Team[];
  profiles: Profile[];
  tasks: Task[];
  authUser: User | null;
  currentProfile: Profile | null;
  isLoading: boolean;
  isSupabaseConnected: boolean;
  setUserTeam: (teamId: TeamId) => Promise<void>;
  createTask: (taskData: {
    title: string;
    description: string | null;
    status: TaskStatus;
    priority: Task['priority'];
    team_id: TeamId;
    assignee_id: string | null;
    due_date: string | null;
  }) => Promise<Task>;
  updateTask: (taskId: string, updates: Partial<Task>) => Promise<Task>;
  deleteTask: (taskId: string) => Promise<void>;
  updateTaskStatus: (taskId: string, status: TaskStatus) => Promise<void>;
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
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSupabaseConnected, setIsSupabaseConnected] = useState(false);

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
              role: 'member',
            })
            .select()
            .single();

          if (!profileError && newProfile) {
            profile = newProfile as Profile;
            setProfiles((prev) => [...prev.filter((p) => p.id !== profile!.id), profile!]);
          }
        }

        if (profile) {
          setCurrentProfile(profile as Profile);
        }
      } else {
        setCurrentProfile(null);
      }

      // 4. Fetch Tasks with Assignee profiles
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select('*, assignee:profiles!assignee_id(*)')
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
          // Re-fetch tasks on any insert/update/delete
          const { data } = await supabase
            .from('tasks')
            .select('*, assignee:profiles!assignee_id(*)')
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

      // Sanitize assignee relation object if present in updates
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
        authUser,
        currentProfile,
        isLoading,
        isSupabaseConnected,
        setUserTeam,
        createTask,
        updateTask,
        deleteTask,
        updateTaskStatus,
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
