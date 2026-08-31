import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateWeeklyReports } from '@/lib/report/generate';

export const dynamic = 'force-dynamic';

/**
 * 매주 월요일 자동 실행 또는 외부 스케줄러(Vercel Cron, GitHub Actions 등)에서 호출하는
 * 주간 마감 + 보고서 자동 생성 엔드포인트
 *
 * 보안: CRON_SECRET 환경변수가 설정된 경우 Bearer 토큰 검증 수행
 *
 * 순서 (기획서 4.3)
 *   1. execute_weekly_archive 실행
 *   2. 성공 시 이어서 보고서 DRAFT 생성 (팀별 3건 + 전체 1건)
 *   3. 마감 실패 시 보고서를 만들지 않고 종료
 *
 * 순서가 중요하다. 마감이 먼저 끝나야 그 주 완료 건이 is_archived = TRUE가 되고
 * 4.2의 완료 조건이 성립한다. 마감 전에 만들면 완료가 0건으로 나온다.
 */
export async function POST(request: NextRequest) {
  return handleWeeklyArchive(request);
}

export async function GET(request: NextRequest) {
  return handleWeeklyArchive(request);
}

async function handleWeeklyArchive(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // CRON_SECRET이 설정되어 있다면 인증 검증
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized. Invalid or missing CRON_SECRET token.' },
        { status: 401 }
      );
    }

    const supabase = createClient();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Supabase client is not configured' },
        { status: 500 }
      );
    }

    // ── 1단계: 주간 마감 ──────────────────────────────────────
    // RPC 함수 호출 (시스템 자동 실행이므로 p_executed_by는 NULL)
    const { data, error } = await supabase.rpc('execute_weekly_archive', {
      p_executed_by: null,
    });

    if (error) {
      console.error('[CRON API] Failed to execute weekly archive:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    const archiveResult = data as { success?: boolean; cycle_week?: string; error?: string };

    // 마감 함수가 EXCEPTION을 삼키고 success:false를 돌려주는 경우가 있다.
    // 그때는 보고서를 만들지 않는다.
    if (archiveResult?.success === false) {
      console.error('[CRON API] Weekly archive returned failure:', archiveResult.error);
      return NextResponse.json(
        { success: false, stage: 'archive', error: archiveResult.error, result: archiveResult },
        { status: 500 }
      );
    }

    // ── 2단계: 보고서 자동 생성 (기획서 4.3) ──────────────────
    const cycleWeek = archiveResult?.cycle_week;
    let reportResult: unknown = null;
    let reportSkippedReason: string | null = null;

    const admin = createAdminClient();

    if (!cycleWeek) {
      reportSkippedReason =
        '마감 결과에 cycle_week이 없어 보고서를 생성하지 않았다.';
    } else if (!admin) {
      // 조용히 넘기지 않는다. 무엇이 왜 실행되지 않았는지 응답과 로그에 남긴다.
      reportSkippedReason =
        'SUPABASE_SERVICE_ROLE_KEY가 설정되지 않아 보고서를 생성하지 않았다. ' +
        '마감은 정상 실행됐다. 자동 생성을 쓰려면 이 환경변수를 설정해야 한다.';
    } else {
      reportResult = await generateWeeklyReports(admin, cycleWeek);
    }

    if (reportSkippedReason) {
      console.warn('[CRON API] 보고서 자동 생성 건너뜀:', reportSkippedReason);
    }

    return NextResponse.json({
      success: true,
      message: 'Weekly archive executed successfully',
      result: archiveResult,
      report: reportResult,
      report_skipped_reason: reportSkippedReason,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown internal server error';
    console.error('[CRON API] Unexpected error during weekly archive:', err);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
