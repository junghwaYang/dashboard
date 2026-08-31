import type { SupabaseClient } from '@supabase/supabase-js';
import type { TeamId } from '@/types/dashboard';
import type { ReportSource, ReportPayload } from '@/types/report';
import { buildReportPayload } from './build-report';
export { currentCycleWeek, previousCycleWeek, isoWeekKey } from './cycle-week';

/**
 * 마감 직후 보고서 자동 생성 (기획서 4.3)
 *
 * 순서가 중요하다. 마감이 먼저 끝나야 그 주 완료 건이 is_archived = TRUE가 되고
 * 4.2의 완료 조건이 성립한다. 마감 전에 만들면 완료가 0건으로 나온다.
 */

export interface GenerateResult {
  cycle_week: string;
  created: { scope: string; team_id: string | null; id: string; skipped: boolean }[];
  errors: string[];
}

/**
 * 대상 주차의 보고서 4건(팀별 3 + 전체 1)을 DRAFT로 만든다.
 * 이미 CONFIRMED인 건은 upsert_weekly_report가 건너뛴다.
 */
export async function generateWeeklyReports(
  supabase: SupabaseClient,
  cycleWeek: string
): Promise<GenerateResult> {
  const result: GenerateResult = { cycle_week: cycleWeek, created: [], errors: [] };

  const { data: source, error: sourceError } = await supabase.rpc('get_weekly_report_source', {
    p_cycle_week: cycleWeek,
  });

  if (sourceError) {
    result.errors.push(`원천 데이터 조회 실패: ${sourceError.message}`);
    return result;
  }

  const src = source as ReportSource;

  const targets: { scope: 'TEAM' | 'ALL'; teamId: TeamId | null }[] = [
    ...src.teams.map((t) => ({ scope: 'TEAM' as const, teamId: t.id })),
    { scope: 'ALL' as const, teamId: null },
  ];

  for (const target of targets) {
    const payload = buildReportPayload(src, target.scope, target.teamId);
    const { data, error } = await supabase.rpc('upsert_weekly_report', {
      p_cycle_week: cycleWeek,
      p_scope: target.scope,
      p_team_id: target.teamId,
      p_payload: payload,
    });

    if (error) {
      result.errors.push(`${target.scope} ${target.teamId ?? ''} 저장 실패: ${error.message}`);
      continue;
    }

    result.created.push({
      scope: target.scope,
      team_id: target.teamId,
      id: (data as { id: string }).id,
      skipped: (data as { skipped: boolean }).skipped,
    });
  }

  return result;
}

export type { ReportPayload };
