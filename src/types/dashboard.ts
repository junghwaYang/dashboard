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
  is_archived?: boolean;
  archived_at?: string | null;
  cycle_week?: string | null;
  archive_batch_id?: string | null;
  /** 프로젝트. NULL이면 보고서에서 "기타"로 묶인다 (기획서 3.1) */
  project_id?: string | null;
  /** 이슈 내용. 비어 있으면 이슈 없음이다 (기획서 3.2, 결정 6) */
  issue_note?: string | null;
}

/** 프로젝트는 반드시 한 팀에 속한다 (기획서 3.1, 결정 7) */
export interface Project {
  id: string;
  name: string;
  team_id: TeamId;
  is_active: boolean;
  created_at: string;
}

export type ArchiveLogStatus = 'SUCCESS' | 'FAILED' | 'ROLLED_BACK';

export interface WeeklyArchiveLog {
  id: string;
  cycle_week: string;
  status: ArchiveLogStatus;
  executed_at: string;
  executed_by: string | null;
  total_tasks_before: number;
  archived_count: number;
  active_tasks_after: number;
  error_message: string | null;
  details: {
    team_breakdown?: Record<string, number>;
    rolled_back_at?: string;
    rolled_back_by?: string | null;
    restored_count?: number;
    timestamp?: string;
    [key: string]: unknown;
  } | null;
  executor?: Profile | null;
}

export interface ArchiveExecutionResult {
  success: boolean;
  batch_id?: string;
  cycle_week?: string;
  total_before?: number;
  archived_count?: number;
  active_after?: number;
  restored_count?: number;
  error?: string;
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

