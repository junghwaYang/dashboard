'use client';

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { Team, Profile, Task, TeamId, TaskStatus, TeamSummaryStat, OverviewMetrics } from '@/types/dashboard';
import { MOCK_TEAMS, MOCK_PROFILES, INITIAL_TASKS } from '@/lib/mock-data';
import { createClient } from '@/lib/supabase/client';

interface DashboardContextType {
  teams: Team[];
  profiles: Profile[];
  tasks: Task[];
  currentProfile: Profile;
  isLoading: boolean;
  isSupabaseConnected: boolean;
  setCurrentProfile: (profile: Profile) => void;
  setUserTeam: (teamId: TeamId) => void;
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
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY_TASKS = 'fastcampus_dashboard_tasks_v1';
const LOCAL_STORAGE_KEY_PROFILE = 'fastcampus_dashboard_profile_v1';

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const [teams] = useState<Team[]>(MOCK_TEAMS);
  const [profiles, setProfiles] = useState<Profile[]>(MOCK_PROFILES);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [currentProfile, setCurrentProfileState] = useState<Profile>(MOCK_PROFILES[0]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSupabaseConnected, setIsSupabaseConnected] = useState(false);

  // Initialize data from LocalStorage or Supabase
  useEffect(() => {
    async function initializeData() {
      setIsLoading(true);
      const supabase = createClient();

      if (supabase) {
        try {
          // Check supabase connection
          const { data: teamsData, error: teamsError } = await supabase.from('teams').select('*');
          if (!teamsError && teamsData && teamsData.length > 0) {
            setIsSupabaseConnected(true);
            const { data: tasksData } = await supabase
              .from('tasks')
              .select('*, assignee:profiles(*)');
            if (tasksData) {
              setTasks(tasksData as Task[]);
            }

            const { data: profilesData } = await supabase.from('profiles').select('*');
            if (profilesData && profilesData.length > 0) {
              setProfiles(profilesData as Profile[]);
            }

            const { data: userData } = await supabase.auth.getUser();
            if (userData?.user) {
              const current = profilesData?.find((p) => p.id === userData.user.id);
              if (current) setCurrentProfileState(current as Profile);
            }
            setIsLoading(false);
            return;
          }
        } catch {
          // Fallback to local storage
        }
      }

      // Local storage fallback for seamless offline / demo mode
      try {
        const savedTasks = localStorage.getItem(LOCAL_STORAGE_KEY_TASKS);
        if (savedTasks) {
          setTasks(JSON.parse(savedTasks));
        } else {
          setTasks(INITIAL_TASKS);
          localStorage.setItem(LOCAL_STORAGE_KEY_TASKS, JSON.stringify(INITIAL_TASKS));
        }

        const savedProfile = localStorage.getItem(LOCAL_STORAGE_KEY_PROFILE);
        if (savedProfile) {
          const parsed = JSON.parse(savedProfile);
          const found = MOCK_PROFILES.find((p) => p.id === parsed.id) || parsed;
          setCurrentProfileState(found);
        } else {
          setCurrentProfileState(MOCK_PROFILES[0]); // default to 김기획 (기획팀)
        }
      } catch {
        setTasks(INITIAL_TASKS);
      } finally {
        setIsLoading(false);
      }
    }

    initializeData();
  }, []);

  // Save tasks to local storage when changed in demo mode
  const persistTasks = useCallback((newTasks: Task[]) => {
    setTasks(newTasks);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_TASKS, JSON.stringify(newTasks));
    } catch {
      // ignore
    }
  }, []);

  const setCurrentProfile = useCallback((profile: Profile) => {
    setCurrentProfileState(profile);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_PROFILE, JSON.stringify(profile));
    } catch {
      // ignore
    }
  }, []);

  const setUserTeam = useCallback(
    (teamId: TeamId) => {
      const updated: Profile = {
        ...currentProfile,
        team_id: teamId,
        updated_at: new Date().toISOString(),
      };
      setCurrentProfile(updated);
      setProfiles((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    },
    [currentProfile, setCurrentProfile]
  );

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
      const assignee = profiles.find((p) => p.id === taskData.assignee_id) || null;

      if (isSupabaseConnected && supabase) {
        const { data, error } = await supabase
          .from('tasks')
          .insert({
            ...taskData,
            created_by: currentProfile.id,
          })
          .select('*, assignee:profiles(*)')
          .single();

        if (error) {
          throw new Error(error.message);
        }
        const newTask = data as Task;
        setTasks((prev) => [newTask, ...prev]);
        return newTask;
      }

      const newTask: Task = {
        id: `task-${Date.now()}`,
        team_id: taskData.team_id,
        title: taskData.title,
        description: taskData.description,
        status: taskData.status,
        priority: taskData.priority,
        assignee_id: taskData.assignee_id,
        due_date: taskData.due_date,
        created_by: currentProfile.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        assignee: assignee,
      };

      const updatedList = [newTask, ...tasks];
      persistTasks(updatedList);
      return newTask;
    },
    [currentProfile.id, isSupabaseConnected, persistTasks, profiles, tasks]
  );

  const updateTask = useCallback(
    async (taskId: string, updates: Partial<Task>): Promise<Task> => {
      const supabase = createClient();
      const assignee = updates.assignee_id
        ? profiles.find((p) => p.id === updates.assignee_id) || null
        : undefined;

      if (isSupabaseConnected && supabase) {
        const { data, error } = await supabase
          .from('tasks')
          .update({
            ...updates,
            updated_at: new Date().toISOString(),
          })
          .eq('id', taskId)
          .select('*, assignee:profiles(*)')
          .single();

        if (error) {
          throw new Error(error.message);
        }
        const updated = data as Task;
        setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
        return updated;
      }

      let updatedTask: Task | null = null;
      const updatedList = tasks.map((task) => {
        if (task.id === taskId) {
          updatedTask = {
            ...task,
            ...updates,
            assignee: assignee !== undefined ? assignee : task.assignee,
            updated_at: new Date().toISOString(),
          };
          return updatedTask;
        }
        return task;
      });

      if (!updatedTask) throw new Error('Task not found');
      persistTasks(updatedList);
      return updatedTask;
    },
    [isSupabaseConnected, persistTasks, profiles, tasks]
  );

  const deleteTask = useCallback(
    async (taskId: string): Promise<void> => {
      const supabase = createClient();

      if (isSupabaseConnected && supabase) {
        const { error } = await supabase.from('tasks').delete().eq('id', taskId);
        if (error) throw new Error(error.message);
      }

      const updatedList = tasks.filter((t) => t.id !== taskId);
      persistTasks(updatedList);
    },
    [isSupabaseConnected, persistTasks, tasks]
  );

  const updateTaskStatus = useCallback(
    async (taskId: string, status: TaskStatus): Promise<void> => {
      await updateTask(taskId, { status });
    },
    [updateTask]
  );

  const canAccessTeam = useCallback(
    (teamId: TeamId): boolean => {
      if (currentProfile.role === 'admin') return true;
      return currentProfile.team_id === teamId;
    },
    [currentProfile.role, currentProfile.team_id]
  );

  const getTasksByTeam = useCallback(
    (teamId: TeamId): Task[] => {
      return tasks.filter((task) => task.team_id === teamId);
    },
    [tasks]
  );

  // Compute summary stats for all teams
  const summaryStats = useMemo<TeamSummaryStat[]>(() => {
    return teams.map((team) => {
      const teamTasks = tasks.filter((t) => t.team_id === team.id);
      return {
        team_id: team.id,
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

  // Compute overall KPI metrics
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
        currentProfile,
        isLoading,
        isSupabaseConnected,
        setCurrentProfile,
        setUserTeam,
        createTask,
        updateTask,
        deleteTask,
        updateTaskStatus,
        summaryStats,
        overviewMetrics,
        getTasksByTeam,
        canAccessTeam,
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
