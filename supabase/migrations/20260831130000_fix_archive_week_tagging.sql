-- 주간 마감 주차 태깅 수정 (기획서 v0.4 결정 8 / 4.2 A안)
--
-- 문제: execute_weekly_archive가 cycle_week을 "실행 시점의 주차"로 찍는다.
--       cron은 월요일 00:00 UTC에 도는데 그 시각은 이미 새 주의 첫날이라,
--       지난 한 주 완료분이 다음 주차로 저장된다.
--         2026-08-31 00:00 UTC -> '2026-W36'  (실제로는 W35 한 주의 결과물)
--
-- 해결: 전날 기준으로 주차를 찍는다. 월요일 새벽에 돌아도 지난 주로 태깅된다.
--       화요일 이후 실행은 결과가 달라지지 않는다.
--
-- 기준 시각은 기존 스키마 관례대로 UTC를 쓴다.
-- 본문과 EXCEPTION 블록 두 군데 모두 고친다. 한쪽만 고치면 실패 로그의 주차가 어긋난다.
--
-- 소급 적용하지 않는다. 기존 weekly_archive_logs와 tasks.cycle_week 값은 건드리지 않는다.
-- 이 함수 교체 이후 실행분부터 새 규칙이 적용된다.

CREATE OR REPLACE FUNCTION public.execute_weekly_archive(p_executed_by uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_batch_id UUID;
    v_cycle_week TEXT;
    v_total_before INT;
    v_archived_count INT;
    v_active_after INT;
    v_team_breakdown JSONB;
BEGIN
    -- [변경] 실행 시점이 아니라 전날 기준으로 주차를 찍는다
    v_cycle_week := TO_CHAR(TIMEZONE('utc'::text, NOW()) - INTERVAL '1 day', 'IYYY-"W"IW');
    v_batch_id := gen_random_uuid();

    -- 처리 전 활성 태스크 총 건수 계산
    SELECT COUNT(*) INTO v_total_before
    FROM public.tasks
    WHERE is_archived = FALSE;

    -- 팀별 완료 건수 사전 집계
    SELECT COALESCE(
        jsonb_object_agg(team_id, done_count),
        '{}'::jsonb
    ) INTO v_team_breakdown
    FROM (
        SELECT team_id, COUNT(*) as done_count
        FROM public.tasks
        WHERE is_archived = FALSE AND status = 'DONE'
        GROUP BY team_id
    ) t;

    -- 완료(DONE) 상태 업무 일괄 아카이빙 업데이트
    WITH updated AS (
        UPDATE public.tasks
        SET is_archived = TRUE,
            archived_at = TIMEZONE('utc'::text, NOW()),
            cycle_week = v_cycle_week,
            archive_batch_id = v_batch_id,
            updated_at = TIMEZONE('utc'::text, NOW())
        WHERE is_archived = FALSE AND status = 'DONE'
        RETURNING id
    )
    SELECT COUNT(*) INTO v_archived_count FROM updated;

    -- 처리 후 잔여 활성 건수 계산
    SELECT COUNT(*) INTO v_active_after
    FROM public.tasks
    WHERE is_archived = FALSE;

    -- 실행 로그 기록 (id = batch_id로 사용)
    INSERT INTO public.weekly_archive_logs (
        id, cycle_week, status, executed_at, executed_by,
        total_tasks_before, archived_count, active_tasks_after,
        error_message, details
    ) VALUES (
        v_batch_id, v_cycle_week, 'SUCCESS', TIMEZONE('utc'::text, NOW()), p_executed_by,
        v_total_before, v_archived_count, v_active_after,
        NULL, jsonb_build_object('team_breakdown', v_team_breakdown, 'timestamp', NOW())
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'batch_id', v_batch_id,
        'cycle_week', v_cycle_week,
        'total_before', v_total_before,
        'archived_count', v_archived_count,
        'active_after', v_active_after
    );

EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.weekly_archive_logs (
        id, cycle_week, status, executed_at, executed_by,
        total_tasks_before, archived_count, active_tasks_after,
        error_message, details
    ) VALUES (
        -- [변경] 본문과 같은 식을 쓴다
        gen_random_uuid(),
        TO_CHAR(TIMEZONE('utc'::text, NOW()) - INTERVAL '1 day', 'IYYY-"W"IW'),
        'FAILED', TIMEZONE('utc'::text, NOW()), p_executed_by,
        COALESCE(v_total_before, 0), 0, COALESCE(v_total_before, 0),
        SQLERRM, jsonb_build_object('sqlstate', SQLSTATE)
    );

    RETURN jsonb_build_object(
        'success', FALSE,
        'error', SQLERRM
    );
END;
$function$;
