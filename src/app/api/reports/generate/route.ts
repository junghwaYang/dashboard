import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateWeeklyReports, currentCycleWeek } from '@/lib/report/generate';
import { isValidCycleWeek } from '@/lib/report/cycle-week';

export const dynamic = 'force-dynamic';

/**
 * 보고서 수동 재생성 (기획서 4.3)
 *
 * DRAFT면 덮어쓰고, CONFIRMED면 거부한다 — 그 판단은 upsert_weekly_report가 한다.
 * 사람이 확정한 보고서를 자동 재생성이 덮지 않게 한다.
 *
 * 권한: admin만. DB 쪽에서도 can_generate_weekly_report()가 다시 확인하므로
 * 이 검사를 우회해도 RPC 단계에서 막힌다.
 */
export async function POST(request: NextRequest) {
  const supabase = createClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase client is not configured' }, { status: 500 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    return NextResponse.json(
      { error: '보고서 생성은 관리자만 할 수 있습니다.' },
      { status: 403 }
    );
  }

  let cycleWeek: string;
  try {
    const body = await request.json().catch(() => ({}));
    cycleWeek = typeof body?.cycle_week === 'string' ? body.cycle_week : currentCycleWeek();
  } catch {
    cycleWeek = currentCycleWeek();
  }

  if (!isValidCycleWeek(cycleWeek)) {
    return NextResponse.json(
      { error: `주차 형식이 올바르지 않습니다: ${cycleWeek} (예: 2026-W35)` },
      { status: 400 }
    );
  }

  const result = await generateWeeklyReports(supabase, cycleWeek);

  return NextResponse.json(
    { success: result.errors.length === 0, ...result },
    { status: result.errors.length === 0 ? 200 : 500 }
  );
}
