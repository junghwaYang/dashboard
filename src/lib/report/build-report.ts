import type { TeamId } from '@/types/dashboard';
import type {
  ReportSource,
  ReportPayload,
  ReportBucket,
  ReportTaskLine,
  TeamReportSection,
  MemberCount,
  ProjectGroup,
  UnclassifiedItem,
} from '@/types/report';

/**
 * 주간 보고서 집계 (기획서 v0.4 3.3, 4.2, 4.5)
 *
 * 집계를 SQL이 아니라 여기서 하는 이유: 분류 규칙이 문서로 확정된 표라서
 * 한 곳에 읽히는 형태로 두는 편이 검증 가능하다. 아래 self-check가 그 표를 그대로 건다.
 */

/**
 * 상태 -> 보고서 분류 (기획서 3.3)
 *
 * | DB 조건                                   | 분류     | 우선순위 |
 * |-------------------------------------------|----------|----------|
 * | issue_note IS NOT NULL                    | 이슈     | 1        |
 * | status = 'DONE'                           | 완료     | 2        |
 * | status IN (TODO, IN_PROGRESS, IN_REVIEW)  | 진행중   | 3        |
 *
 * 이슈가 status보다 우선하므로 한 업무가 두 곳에 중복 집계되지 않는다.
 * IN_REVIEW를 진행중에 넣는 것은 이 표로 확정한 결정이며 임의 판단이 아니다.
 */
export function classify(task: { status: string; issue_note: string | null }): ReportBucket {
  if (task.issue_note !== null && task.issue_note.trim() !== '') return 'issue';
  if (task.status === 'DONE') return 'done';
  return 'in_progress';
}

/** 빈 문자열도 이슈 없음으로 본다 (결정 6) */
function hasIssue(note: string | null): boolean {
  return note !== null && note.trim() !== '';
}

export function buildTeamSection(source: ReportSource, teamId: TeamId): TeamReportSection {
  const team = source.teams.find((t) => t.id === teamId);
  const profileById = new Map(source.profiles.map((p) => [p.id, p]));
  const projectById = new Map(source.projects.map((p) => [p.id, p]));
  const teamMembers = source.profiles.filter((p) => p.team_id === teamId);

  const unclassified: UnclassifiedItem[] = [];

  /**
   * 대상 업무 선별 (기획서 4.2)
   *
   *   완료 건        : is_archived = TRUE  AND cycle_week = :week
   *   진행중 / 이슈  : is_archived = FALSE
   *
   * cycle_week만 믿으면 안 된다. 복구된 업무에는 cycle_week이 남아 있고
   * is_archived만 false인 행이 계속 생긴다. 그 행은 아래 미분류로 빠진다.
   */
  const teamTasks = source.tasks.filter((t) => t.team_id === teamId);
  const counted: ReportTaskLine[] = [];

  for (const task of teamTasks) {
    const isDoneRow = task.is_archived === true && task.cycle_week === source.cycle_week;
    const isActiveRow = task.is_archived === false;

    // 마감 데이터 불일치 (기획서 4.5). 임의로 보정하지 않는다.
    if (isActiveRow && task.cycle_week !== null) {
      unclassified.push({
        task_id: task.id,
        title: task.title,
        reason: `마감 데이터 불일치 — cycle_week=${task.cycle_week}인데 아카이브되지 않았다`,
      });
      continue;
    }

    if (!isDoneRow && !isActiveRow) continue;

    // 담당자 미지정 (기획서 4.5). 팀원별 집계가 불가능하다.
    if (task.assignee_id === null) {
      unclassified.push({
        task_id: task.id,
        title: task.title,
        reason: '담당자 미지정 — 팀원별 집계 불가',
      });
      continue;
    }

    const project = task.project_id ? projectById.get(task.project_id) : undefined;

    // 프로젝트 소속 오류 (기획서 4.5). DB 트리거를 우회해 들어온 경우.
    if (project && project.team_id !== task.team_id) {
      unclassified.push({
        task_id: task.id,
        title: task.title,
        reason: `프로젝트 소속 오류 — 업무는 ${task.team_id}, 프로젝트는 ${project.team_id}`,
      });
      continue;
    }

    const bucket = classify(task);

    // 완료로 셀 수 있는 것은 "이번 주에 아카이브된 행"뿐이다 (기획서 4.2).
    // status가 DONE이어도 아직 마감되지 않았으면 이번 주 완료가 아니다.
    // 마감 전에 관리자가 수동 재생성을 누르면 이 상태가 실제로 나온다.
    // 임의로 진행중으로 내리지 않고, 사유와 함께 미분류로 남긴다.
    if (bucket === 'done' && !isDoneRow) {
      unclassified.push({
        task_id: task.id,
        title: task.title,
        reason: '완료 상태지만 아직 마감되지 않았다 — 이번 주 완료로 셀 수 없다',
      });
      continue;
    }

    counted.push({
      task_id: task.id,
      title: task.title,
      assignee: profileById.get(task.assignee_id)?.full_name ?? '(알 수 없음)',
      project_name: project?.name ?? null,
      bucket,
      issue_note: hasIssue(task.issue_note) ? task.issue_note : null,
    });
  }

  const done = counted.filter((t) => t.bucket === 'done');
  const inProgress = counted.filter((t) => t.bucket === 'in_progress');
  const issues = counted.filter((t) => t.bucket === 'issue');

  // 팀원별 건수 (규칙 11). 미분류로 빠진 건은 담당자를 알 수 없으므로 세지 않는다.
  const byMember: MemberCount[] = teamMembers.map((member) => {
    const mine = counted.filter((t) => t.assignee === member.full_name);
    return {
      profile_id: member.id,
      name: member.full_name,
      done: mine.filter((t) => t.bucket === 'done').length,
      in_progress: mine.filter((t) => t.bucket === 'in_progress').length,
      issue: mine.filter((t) => t.bucket === 'issue').length,
      total: mine.length,
    };
  });

  // 프로젝트별 묶음 (규칙 12, 기획서 3.1). 확정 / 기타 2분류다. "추정" 그룹은 없다.
  const groups = new Map<string | null, ProjectGroup>();
  for (const line of counted) {
    const key = line.project_name;
    if (!groups.has(key)) {
      groups.set(key, {
        project_id: source.projects.find((p) => p.name === key && p.team_id === teamId)?.id ?? null,
        project_name: key ?? '기타',
        done: 0,
        in_progress: 0,
        issue: 0,
        total: 0,
        tasks: [],
      });
    }
    const g = groups.get(key)!;
    g[line.bucket] += 1;
    g.total += 1;
    g.tasks.push(line);
  }
  // 기타는 항상 마지막에 놓는다
  const byProject = Array.from(groups.values()).sort((a, b) => {
    if (a.project_id === null) return 1;
    if (b.project_id === null) return -1;
    return a.project_name.localeCompare(b.project_name, 'ko');
  });

  return {
    team_id: teamId,
    team_name: team?.name ?? teamId,
    submission: {
      total_members: teamMembers.length,
      // 규칙 4. 대상 주 업무가 0건인 사람을 "업무 없음"으로 표시한다.
      no_task_members: byMember.filter((m) => m.total === 0).map((m) => m.name),
    },
    counts: {
      done: done.length,
      in_progress: inProgress.length,
      issue: issues.length,
      total: counted.length,
    },
    done,
    in_progress: inProgress,
    issues,
    by_member: byMember,
    by_project: byProject,
    unclassified,
  };
}

export function buildReportPayload(
  source: ReportSource,
  scope: 'TEAM' | 'ALL',
  teamId: TeamId | null
): ReportPayload {
  const targetTeams: TeamId[] =
    scope === 'ALL' ? source.teams.map((t) => t.id) : [teamId as TeamId];

  const sections = targetTeams.map((id) => buildTeamSection(source, id));

  return {
    cycle_week: source.cycle_week,
    scope,
    team_id: scope === 'ALL' ? null : teamId,
    generated_at: new Date().toISOString(),
    sections,
    totals: {
      done: sections.reduce((s, x) => s + x.counts.done, 0),
      in_progress: sections.reduce((s, x) => s + x.counts.in_progress, 0),
      issue: sections.reduce((s, x) => s + x.counts.issue, 0),
      total: sections.reduce((s, x) => s + x.counts.total, 0),
    },
  };
}

/**
 * 반복 이슈 판정 (규칙 10, 기획서 4.4)
 *
 * 지난 주 스냅샷의 요약 문장을 읽지 않는다. task id 목록을 행 단위로 직접 대조한다.
 * 문서에 결론이 적혀 있어도 그것을 근거로 삼지 않는다.
 */
export function markRepeatedIssues(
  current: ReportPayload,
  previous: ReportPayload | null
): Set<string> {
  if (!previous) return new Set();
  const previousIssueIds = new Set(
    previous.sections.flatMap((s) => s.issues.map((i) => i.task_id))
  );
  return new Set(
    current.sections
      .flatMap((s) => s.issues.map((i) => i.task_id))
      .filter((id) => previousIssueIds.has(id))
  );
}
