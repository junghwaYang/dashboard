import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * 매주 월요일 자동 실행 또는 외부 스케줄러(Vercel Cron, GitHub Actions 등)에서 호출하는 주간 마감 API 엔드포인트
 * 
 * 보안: CRON_SECRET 환경변수가 설정된 경우 Bearer 토큰 검증 수행
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

    return NextResponse.json({
      success: true,
      message: 'Weekly archive executed successfully',
      result: data,
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
