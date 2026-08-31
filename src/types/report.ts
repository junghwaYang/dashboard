import { TeamId } from './dashboard';

/** 보고서 분류. 웹앱 상태 4종을 보고서 상태 3종으로 줄인 것 (기획서 3.3) */
export type ReportBucket = 'done' | 'in_progress' | 'issue';

/** 보고서 범위. TEAM은 한 팀, ALL은 3팀 합산 */
export type ReportScope = 'TEAM' | 'ALL';

export type ReportStatus = 'DRAFT' | 'CONFIRMED';

/** get_weekly_report_source RPC가 돌려주는 원천 데이터 */
export interface ReportSource {
  cycle_week: string;
  teams: { id: TeamId; name: string }[];
  profiles: { id: string; full_name: string; team_id: TeamId | null; role: string }[];
  projects: { id: string; name: string; team_id: TeamId }[];
  tasks: {
    id: string;
    title: string;
    description: string | null;
    status: string;
    team_id: TeamId;
    assignee_id: string | null;
    project_id: string | null;
    issue_note: string | null;
    is_archived: boolean;
    cycle_week: string | null;
  }[];
}

export interface ReportTaskLine {
  task_id: string;
  title: string;
  assignee: string;
  project_name: string | null;
  bucket: ReportBucket;
  /** bucket === 'issue' 일 때만 값이 있다 */
  issue_note: string | null;
}

export interface MemberCount {
  profile_id: string;
  name: string;
  done: number;
  in_progress: number;
  issue: number;
  total: number;
}

export interface ProjectGroup {
  /** null이면 "기타" (project_id 미지정). 기획서 3.1의 2분류 */
  project_id: string | null;
  project_name: string;
  done: number;
  in_progress: number;
  issue: number;
  total: number;
  tasks: ReportTaskLine[];
}

export interface UnclassifiedItem {
  task_id: string;
  title: string;
  reason: string;
}

/** 한 팀 몫의 집계 결과 */
export interface TeamReportSection {
  team_id: TeamId;
  team_name: string;
  submission: {
    total_members: number;
    /** 대상 주 업무가 0건인 사람 (규칙 4) */
    no_task_members: string[];
  };
  counts: { done: number; in_progress: number; issue: number; total: number };
  done: ReportTaskLine[];
  in_progress: ReportTaskLine[];
  issues: ReportTaskLine[];
  by_member: MemberCount[];
  by_project: ProjectGroup[];
  unclassified: UnclassifiedItem[];
}

/** weekly_reports.payload에 그대로 저장되는 구조 */
export interface ReportPayload {
  cycle_week: string;
  scope: ReportScope;
  team_id: TeamId | null;
  generated_at: string;
  sections: TeamReportSection[];
  totals: { done: number; in_progress: number; issue: number; total: number };
}

/** weekly_reports 한 행 */
export interface WeeklyReport {
  id: string;
  cycle_week: string;
  scope: ReportScope;
  team_id: TeamId | null;
  status: ReportStatus;
  summary_text: string | null;
  summary_written_by: string | null;
  confirmed_at: string | null;
  confirmed_by: string | null;
  payload: ReportPayload;
  created_at: string;
  updated_at: string;
}
