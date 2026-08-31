import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildReportDocx } from '@/lib/report/docx';
import { markRepeatedIssues } from '@/lib/report/build-report';
import { previousCycleWeek, isValidCycleWeek } from '@/lib/report/cycle-week';
import type { ReportPayload } from '@/types/report';

export const dynamic = 'force-dynamic';

/**
 * 주간 보고서 Word(.docx) 내려받기
 *
 *   GET /api/reports/docx?week=2026-W35&scope=TEAM&team=development
 *   GET /api/reports/docx?week=2026-W35&scope=ALL
 *
 * 열람 권한은 weekly_reports RLS가 강제한다(결정 9). 사용자 세션으로 조회하므로
 * 권한이 없으면 행 자체가 조회되지 않는다.
 *
 * 화면(ReportView)과 같은 payload를 읽는다. 여기서 집계를 다시 하지 않는다.
 */
export async function GET(request: NextRequest) {
  const supabase = createClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase client is not configured' }, { status: 500 });
  }

  // 로그인부터 확인한다. anon은 weekly_reports에 SELECT 권한 자체가 없어서
  // 여기서 걸러내지 않으면 DB 권한 오류가 500으로 새어 나간다.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const week = searchParams.get('week');
  const scope = searchParams.get('scope') ?? 'ALL';
  const teamId = searchParams.get('team');

  if (!isValidCycleWeek(week)) {
    return NextResponse.json(
      { error: `주차 형식이 올바르지 않습니다: ${week ?? '(없음)'} (예: 2026-W35)` },
      { status: 400 }
    );
  }
  if (scope !== 'TEAM' && scope !== 'ALL') {
    return NextResponse.json({ error: `scope는 TEAM 또는 ALL이어야 합니다: ${scope}` }, { status: 400 });
  }
  if (scope === 'TEAM' && !teamId) {
    return NextResponse.json({ error: 'scope=TEAM이면 team 파라미터가 필요합니다.' }, { status: 400 });
  }

  let query = supabase
    .from('weekly_reports')
    .select('id, cycle_week, scope, team_id, status, summary_text, payload')
    .eq('cycle_week', week)
    .eq('scope', scope);
  query = scope === 'TEAM' ? query.eq('team_id', teamId!) : query.is('team_id', null);

  const { data: report, error } = await query.maybeSingle();

  if (error) {
    // DB 내부 메시지를 그대로 내보내지 않는다. 테이블 이름 같은 것이 새어 나간다.
    console.error('[reports/docx] 보고서 조회 실패:', error);
    return NextResponse.json({ error: '보고서를 조회하지 못했습니다.' }, { status: 500 });
  }
  if (!report) {
    // 권한이 없어도 여기로 온다. RLS가 행을 감추기 때문이다.
    return NextResponse.json(
      { error: '보고서를 찾을 수 없습니다. 아직 생성되지 않았거나 열람 권한이 없습니다.' },
      { status: 404 }
    );
  }

  // 반복 이슈 판정 (규칙 10). 지난 주 스냅샷의 task id 목록과 직접 대조한다.
  // 요약 문장은 읽지 않는다.
  let previousPayload: ReportPayload | null = null;
  {
    let prevQuery = supabase
      .from('weekly_reports')
      .select('payload')
      .eq('cycle_week', previousCycleWeek(week))
      .eq('scope', scope);
    prevQuery = scope === 'TEAM' ? prevQuery.eq('team_id', teamId!) : prevQuery.is('team_id', null);
    const { data: prev } = await prevQuery.maybeSingle();
    previousPayload = (prev?.payload as ReportPayload | undefined) ?? null;
  }

  const payload = report.payload as ReportPayload;
  const teamName = payload.sections?.[0]?.team_name ?? report.team_id ?? '';
  const title = scope === 'ALL' ? '전체 주간 업무 보고서' : `${teamName} 주간 업무 보고서`;

  const buffer = await buildReportDocx({
    payload,
    summaryText: report.summary_text,
    status: report.status as 'DRAFT' | 'CONFIRMED',
    repeatedIssueIds: markRepeatedIssues(payload, previousPayload),
    title,
  });

  const filename = `${week}_${scope === 'ALL' ? '전체' : teamName}_주간업무보고서.docx`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      // 한글 파일명은 RFC 5987 형식으로 넘긴다. filename*만 쓰면 구형 클라이언트가
      // 이름을 잃으므로 ASCII 대체 이름을 함께 준다.
      'Content-Disposition': `attachment; filename="${week}_report.docx"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Cache-Control': 'no-store',
    },
  });
}
