export type TeamId = 'planning' | 'design' | 'development';

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE';

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type UserRole = 'member' | 'admin';

export interface Team {
  id: TeamId;
  name: string;
  description: string | null;
  created_at: string;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  team_id: TeamId | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  team_id: TeamId;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assignee_id: string | null;
  due_date: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  assignee?: Profile | null;
}

export interface TeamSummaryStat {
  team_id: TeamId;
  team_name: string;
  total_count: number;
  todo_count: number;
  in_progress_count: number;
  in_review_count: number;
  done_count: number;
  urgent_count: number;
}

export interface OverviewMetrics {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  urgentTasks: number;
  completionRate: number;
}
