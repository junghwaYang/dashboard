/**
 * 집계 로직 자체 검증. 의존성 없이 돈다.
 *   node --test src/lib/report/build-report.test.ts
 *
 * 여기서 거는 것은 기획서 3.3 매핑표와 4.2 이중 조건, 4.5 미분류 규칙이다.
 * 이 셋이 틀리면 보고서 숫자가 조용히 틀린다. 화면으로는 안 드러난다.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, buildTeamSection, buildReportPayload, markRepeatedIssues } from './build-report.ts';

const WEEK = '2026-W35';

function makeSource(tasks: any[]): any {
  return {
    cycle_week: WEEK,
    teams: [
      { id: 'planning', name: '기획팀' },
      { id: 'design', name: '디자인팀' },
      { id: 'development', name: '개발팀' },
    ],
    profiles: [
      { id: 'u1', full_name: '실타래', team_id: 'development', role: 'admin' },
      { id: 'u2', full_name: '김드림', team_id: 'design', role: 'member' },
    ],
    projects: [
      { id: 'p-dev', name: '주간업무 대시보드', team_id: 'development' },
      { id: 'p-dsn', name: '주간업무 대시보드', team_id: 'design' },
    ],
    tasks,
  };
}

function task(over: any = {}) {
  return {
    id: 't1', title: '업무', description: null, status: 'IN_PROGRESS',
    team_id: 'development', assignee_id: 'u1', project_id: 'p-dev',
    issue_note: null, is_archived: false, cycle_week: null,
    ...over,
  };
}

test('3.3 매핑표 — 이슈가 status보다 우선한다', () => {
  assert.equal(classify({ status: 'DONE', issue_note: '막혔다' }), 'issue');
  assert.equal(classify({ status: 'DONE', issue_note: null }), 'done');
  assert.equal(classify({ status: 'TODO', issue_note: null }), 'in_progress');
  assert.equal(classify({ status: 'IN_PROGRESS', issue_note: null }), 'in_progress');
  // IN_REVIEW는 진행중이다. 표로 확정한 결정이다.
  assert.equal(classify({ status: 'IN_REVIEW', issue_note: null }), 'in_progress');
  // 빈 문자열은 이슈 없음이다 (결정 6)
  assert.equal(classify({ status: 'DONE', issue_note: '   ' }), 'done');
});

test('3.3 — 한 업무가 두 분류에 중복 집계되지 않는다', () => {
  const s = buildTeamSection(
    makeSource([task({ status: 'DONE', is_archived: true, cycle_week: WEEK, issue_note: '막혔다' })]),
    'development' as any
  );
  assert.equal(s.counts.issue, 1);
  assert.equal(s.counts.done, 0);
  assert.equal(s.counts.total, 1, '총합은 항목 수와 같아야 한다');
});

test('4.2 — cycle_week만 맞고 is_archived가 false면 완료로 세지 않는다', () => {
  // 복구된 업무. 현재 DB에 실제로 2건 있는 상태다.
  const s = buildTeamSection(
    makeSource([task({ status: 'IN_PROGRESS', is_archived: false, cycle_week: WEEK })]),
    'development' as any
  );
  assert.equal(s.counts.done, 0);
  assert.equal(s.counts.total, 0, '집계에서 빠져야 한다');
  assert.equal(s.unclassified.length, 1, '미분류로 사유와 함께 남아야 한다');
  assert.match(s.unclassified[0].reason, /마감 데이터 불일치/);
});

test('4.2 — 다른 주차의 아카이브 건은 이번 주에 세지 않는다', () => {
  const s = buildTeamSection(
    makeSource([task({ status: 'DONE', is_archived: true, cycle_week: '2026-W34' })]),
    'development' as any
  );
  assert.equal(s.counts.total, 0);
  assert.equal(s.unclassified.length, 0, '남의 주차 건은 미분류도 아니다');
});

test('4.2 — 이번 주 아카이브 완료 건은 완료로 센다', () => {
  const s = buildTeamSection(
    makeSource([task({ status: 'DONE', is_archived: true, cycle_week: WEEK })]),
    'development' as any
  );
  assert.equal(s.counts.done, 1);
});

test('4.5 — 담당자 미지정은 미분류다', () => {
  const s = buildTeamSection(makeSource([task({ assignee_id: null })]), 'development' as any);
  assert.equal(s.counts.total, 0);
  assert.match(s.unclassified[0].reason, /담당자 미지정/);
});

test('4.5 — 프로젝트 팀 불일치는 미분류다 (트리거 우회 시)', () => {
  const s = buildTeamSection(
    makeSource([task({ team_id: 'development', project_id: 'p-dsn' })]),
    'development' as any
  );
  assert.equal(s.counts.total, 0);
  assert.match(s.unclassified[0].reason, /프로젝트 소속 오류/);
});

test('규칙 4 — 업무 0건인 팀원이 제출 현황에 잡힌다', () => {
  const s = buildTeamSection(makeSource([]), 'development' as any);
  assert.deepEqual(s.submission.no_task_members, ['실타래']);
  // 기획팀은 프로필이 0명이라 팀 전체가 여기 걸린다
  const planning = buildTeamSection(makeSource([]), 'planning' as any);
  assert.equal(planning.submission.total_members, 0);
  assert.deepEqual(planning.submission.no_task_members, []);
});

test('규칙 12 — 프로젝트 미지정은 기타로 모이고 항상 마지막에 온다', () => {
  const s = buildTeamSection(
    makeSource([
      task({ id: 'a', project_id: null }),
      task({ id: 'b', project_id: 'p-dev' }),
    ]),
    'development' as any
  );
  assert.equal(s.by_project.length, 2);
  assert.equal(s.by_project[s.by_project.length - 1].project_name, '기타');
  assert.equal(s.by_project[0].project_name, '주간업무 대시보드');
});

test('결정 7 — 이름이 같아도 팀이 다르면 합치지 않는다', () => {
  const p = buildReportPayload(
    makeSource([
      task({ id: 'a', team_id: 'development', assignee_id: 'u1', project_id: 'p-dev' }),
      task({ id: 'b', team_id: 'design', assignee_id: 'u2', project_id: 'p-dsn' }),
    ]),
    'ALL',
    null
  );
  const dev = p.sections.find((s: any) => s.team_id === 'development')!;
  const dsn = p.sections.find((s: any) => s.team_id === 'design')!;
  assert.equal(dev.by_project[0].total, 1);
  assert.equal(dsn.by_project[0].total, 1);
  assert.notEqual(dev.by_project[0].project_id, dsn.by_project[0].project_id);
});

test('합계는 팀별 합과 일치한다', () => {
  const p = buildReportPayload(
    makeSource([
      task({ id: 'a', team_id: 'development', assignee_id: 'u1', project_id: 'p-dev' }),
      task({ id: 'b', team_id: 'design', assignee_id: 'u2', project_id: 'p-dsn', issue_note: '막힘' }),
    ]),
    'ALL',
    null
  );
  assert.equal(p.totals.total, 2);
  assert.equal(p.totals.in_progress, 1);
  assert.equal(p.totals.issue, 1);
  assert.equal(
    p.totals.total,
    p.sections.reduce((s: number, x: any) => s + x.counts.total, 0)
  );
});

test('규칙 10 — 반복 이슈는 task id 대조로 판정한다', () => {
  const src = makeSource([task({ id: 'x', issue_note: '막힘' })]);
  const prev = buildReportPayload(src, 'TEAM', 'development' as any);
  const cur = buildReportPayload(src, 'TEAM', 'development' as any);
  assert.deepEqual([...markRepeatedIssues(cur, prev)], ['x']);
  assert.equal(markRepeatedIssues(cur, null).size, 0, '이전 주가 없으면 반복 이슈도 없다');

  const other = buildReportPayload(makeSource([task({ id: 'y', issue_note: '다른 막힘' })]), 'TEAM', 'development' as any);
  assert.equal(markRepeatedIssues(cur, other).size, 0, 'id가 다르면 반복이 아니다');
});

// ─────────────────────────────────────────────────────────────
// 주차 계산 — DB의 TO_CHAR(..., 'IYYY-"W"IW')와 같은 값을 내야 한다
// 아래 기대값은 전부 이 프로젝트 Postgres에서 뽑은 실측값이다.
// (2024-12-25 ~ 2027-01-10 구간 1054건을 대조해 전건 일치를 확인했고,
//  그중 연말·연초 경계와 cron 실행일을 회귀 테스트로 고정한다)
// ─────────────────────────────────────────────────────────────
import { currentCycleWeek, previousCycleWeek, nextCycleWeek } from './cycle-week.ts';

test('4.2 — 주차 계산이 DB 실측값과 일치한다 (연도 경계 포함)', () => {
  const fromDb: [string, string][] = [
    ['2024-12-28T13:00:00Z', '2024-W52'],
    ['2024-12-29T06:00:00Z', '2024-W52'],
    ['2024-12-31T09:00:00Z', '2025-W01'],
    ['2025-01-01T02:00:00Z', '2025-W01'],
    ['2025-01-04T15:00:00Z', '2025-W01'],
    ['2025-12-28T08:00:00Z', '2025-W52'],
    ['2025-12-31T04:00:00Z', '2026-W01'],
    ['2026-01-01T14:00:00Z', '2026-W01'],
    // 53주짜리 해
    ['2026-12-28T03:00:00Z', '2026-W52'],
    ['2026-12-29T13:00:00Z', '2026-W53'],
    ['2027-01-01T09:00:00Z', '2026-W53'],
    ['2027-01-04T05:00:00Z', '2026-W53'],
  ];
  for (const [ts, expected] of fromDb) {
    assert.equal(currentCycleWeek(new Date(ts)), expected, `${ts} 기준 주차`);
  }
});

test('4.2 A안 — 월요일 cron 실행이 지난 주로 태깅된다', () => {
  // 이 두 건이 A안의 존재 이유다. 전날 기준을 빼면 각각 W36, W37로 밀린다.
  assert.equal(currentCycleWeek(new Date('2026-08-31T00:00:00Z')), '2026-W35');
  assert.equal(currentCycleWeek(new Date('2026-09-07T00:00:00Z')), '2026-W36');
});

test('직전 주차 — 연초 1주차는 작년 마지막 주로 돌아간다', () => {
  assert.equal(previousCycleWeek('2026-W35'), '2026-W34');
  assert.equal(previousCycleWeek('2026-W01'), '2025-W52');
  // 2026년은 53주짜리다
  assert.equal(previousCycleWeek('2027-W01'), '2026-W53');
});

test('다음 주차 — 이전/다음이 서로 되돌린다 (53주 경계 포함)', () => {
  for (const w of ['2026-W01', '2026-W35', '2026-W52', '2026-W53', '2025-W52', '2027-W01']) {
    assert.equal(previousCycleWeek(nextCycleWeek(w)), w, `${w} 왕복`);
  }
  // 53주짜리 해를 건너뛰지 않는다
  assert.equal(nextCycleWeek('2026-W52'), '2026-W53');
  assert.equal(nextCycleWeek('2026-W53'), '2027-W01');
  assert.equal(nextCycleWeek('2025-W52'), '2026-W01');
});

// ─────────────────────────────────────────────────────────────
// Codex 리뷰(2026-08-31)에서 지적된 케이스. 기존 16건에는 이 조합이 없었다.
// ─────────────────────────────────────────────────────────────
import { isValidCycleWeek, formatCycleWeekRange } from './cycle-week.ts';

test('4.2 — 아카이브 안 된 DONE은 완료로 세지 않는다 (마감 전 수동 재생성)', () => {
  const s = buildTeamSection(
    makeSource([task({ status: 'DONE', is_archived: false, cycle_week: null })]),
    'development' as any
  );
  assert.equal(s.counts.done, 0, '완료로 세면 안 된다');
  assert.equal(s.counts.in_progress, 0, '임의로 진행중으로 내리지도 않는다');
  assert.equal(s.counts.total, 0);
  assert.equal(s.unclassified.length, 1);
  assert.match(s.unclassified[0].reason, /완료 상태지만 아직 마감되지 않았다/);
});

test('4.2 — 그 행에 이슈가 있으면 이슈가 우선한다', () => {
  // 이슈는 status와 직교하므로 마감 여부와 무관하게 이슈로 잡힌다 (3.3 우선순위 1)
  const s = buildTeamSection(
    makeSource([task({ status: 'DONE', is_archived: false, cycle_week: null, issue_note: '막힘' })]),
    'development' as any
  );
  assert.equal(s.counts.issue, 1);
  assert.equal(s.unclassified.length, 0);
});

test('주차 문자열 검증 — W00 / W99를 걸러낸다', () => {
  assert.equal(isValidCycleWeek('2026-W35'), true);
  assert.equal(isValidCycleWeek('2026-W01'), true);
  assert.equal(isValidCycleWeek('2026-W53'), true);
  assert.equal(isValidCycleWeek('2026-W00'), false, 'W00은 없는 주차다');
  assert.equal(isValidCycleWeek('2026-W54'), false);
  assert.equal(isValidCycleWeek('2026-W99'), false);
  assert.equal(isValidCycleWeek('2026-35'), false);
  assert.equal(isValidCycleWeek(null), false);
  assert.equal(isValidCycleWeek(''), false);
});

test('주차 날짜 범위 변환 — ISO 주차를 한국어 날짜 범위로 변환한다', () => {
  assert.equal(formatCycleWeekRange('2026-W35'), '2026년 8월 24일 ~ 8월 30일');
  assert.equal(formatCycleWeekRange('2026-W01'), '2025년 12월 29일 ~ 2026년 1월 4일');
  assert.equal(formatCycleWeekRange('2026-W36'), '2026년 8월 31일 ~ 9월 6일');
  assert.equal(formatCycleWeekRange('2024-W52'), '2024년 12월 23일 ~ 12월 29일');
  assert.equal(formatCycleWeekRange('invalid'), 'invalid');
});

