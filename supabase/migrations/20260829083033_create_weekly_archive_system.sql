-- 주간 업무 보관(아카이빙) 및 복구 시스템
-- 이 마이그레이션은 2026-08-29에 이 프로젝트의 Supabase 데이터베이스에 직접 적용되어
-- 이미 운영 중이었으나, 마이그레이션 파일 자체가 저장소에 커밋되지 않아 재현 불가능한
-- 상태였습니다. 이 파일은 실제 운영 중인 스키마·함수 정의를 그대로 옮겨 적어, 새 환경
-- (예: 신규 Supabase 프로젝트)에서도 동일하게 재현할 수 있도록 합니다.
-- 참고: docs/implementation_plan.md, docs/DATABASE_SCHEMA.md

-- =======================================================
-- 1. tasks 테이블 아카이빙 관련 컬럼 추가
-- =======================================================
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE NOT NULL,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cycle_week TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS archive_batch_id UUID DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_is_archived ON public.tasks(is_archived);
CREATE INDEX IF NOT EXISTS idx_tasks_archive_batch_id ON public.tasks(archive_batch_id);
CREATE INDEX IF NOT EXISTS idx_tasks_cycle_week ON public.tasks(cycle_week);
CREATE INDEX IF NOT EXISTS idx_tasks_team_archived ON public.tasks(team_id, is_archived);

-- =======================================================
-- 2. weekly_archive_logs 감사 로그 테이블
-- =======================================================
CREATE TABLE IF NOT EXISTS public.weekly_archive_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cycle_week TEXT NOT NULL,
    status TEXT CHECK (status IN ('SUCCESS', 'FAILED', 'ROLLED_BACK')) NOT NULL,
    executed_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    executed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    total_tasks_before INT NOT NULL DEFAULT 0,
    archived_count INT NOT NULL DEFAULT 0,
    active_tasks_after INT NOT NULL DEFAULT 0,
    error_message TEXT,
    details JSONB DEFAULT '{}'::jsonb
);

ALTER TABLE public.weekly_archive_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to view weekly archive logs" ON public.weekly_archive_logs;
CREATE POLICY "Allow authenticated users to view weekly archive logs"
ON public.weekly_archive_logs FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Allow authenticated users to manage archive logs via rpc" ON public.weekly_archive_logs;
CREATE POLICY "Allow authenticated users to manage archive logs via rpc"
ON public.weekly_archive_logs FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- =======================================================
-- 3. RPC 함수 — 주간 마감 실행
-- weekly_archive_logs.id를 곧 archive_batch_id로 재사용한다(같은 값).
-- 이 값으로 rollback_weekly_archive가 로그 행과 tasks 행을 함께 찾는다.
-- =======================================================
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
    v_cycle_week := TO_CHAR(NOW(), 'IYYY-"W"IW');
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
        gen_random_uuid(), TO_CHAR(NOW(), 'IYYY-"W"IW'), 'FAILED', TIMEZONE('utc'::text, NOW()), p_executed_by,
        COALESCE(v_total_before, 0), 0, COALESCE(v_total_before, 0),
        SQLERRM, jsonb_build_object('sqlstate', SQLSTATE)
    );

    RETURN jsonb_build_object(
        'success', FALSE,
        'error', SQLERRM
    );
END;
$function$;

-- =======================================================
-- 4. RPC 함수 — 배치 전체 롤백
-- =======================================================
CREATE OR REPLACE FUNCTION public.rollback_weekly_archive(p_batch_id uuid, p_executed_by uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_restored_count INT;
BEGIN
    WITH restored AS (
        UPDATE public.tasks
        SET is_archived = FALSE,
            archived_at = NULL,
            archive_batch_id = NULL,
            updated_at = TIMEZONE('utc'::text, NOW())
        WHERE archive_batch_id = p_batch_id AND is_archived = TRUE
        RETURNING id
    )
    SELECT COUNT(*) INTO v_restored_count FROM restored;

    UPDATE public.weekly_archive_logs
    SET status = 'ROLLED_BACK',
        details = details || jsonb_build_object(
            'rolled_back_at', NOW(),
            'rolled_back_by', p_executed_by,
            'restored_count', v_restored_count
        )
    WHERE id = p_batch_id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'batch_id', p_batch_id,
        'restored_count', v_restored_count
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', FALSE,
        'error', SQLERRM
    );
END;
$function$;

-- =======================================================
-- 5. RPC 함수 — 개별 업무 복구
-- =======================================================
CREATE OR REPLACE FUNCTION public.restore_archived_task(p_task_id uuid, p_target_status text DEFAULT 'IN_PROGRESS'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_task public.tasks%ROWTYPE;
BEGIN
    UPDATE public.tasks
    SET is_archived = FALSE,
        archived_at = NULL,
        archive_batch_id = NULL,
        status = p_target_status,
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = p_task_id
    RETURNING * INTO v_task;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Task not found');
    END IF;

    RETURN jsonb_build_object(
        'success', TRUE,
        'task_id', v_task.id,
        'new_status', v_task.status
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', FALSE,
        'error', SQLERRM
    );
END;
$function$;

-- =======================================================
-- 6. get_dashboard_summary_stats — 활성(미보관) 업무만 집계하도록 갱신
-- =======================================================
CREATE OR REPLACE FUNCTION public.get_dashboard_summary_stats()
RETURNS TABLE (
    team_id TEXT,
    team_name TEXT,
    total_count BIGINT,
    todo_count BIGINT,
    in_progress_count BIGINT,
    in_review_count BIGINT,
    done_count BIGINT,
    urgent_count BIGINT
)
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT
        t.id AS team_id,
        t.name AS team_name,
        COUNT(task.id) FILTER (WHERE task.is_archived = FALSE OR task.is_archived IS NULL) AS total_count,
        COUNT(task.id) FILTER (WHERE (task.is_archived = FALSE OR task.is_archived IS NULL) AND task.status = 'TODO') AS todo_count,
        COUNT(task.id) FILTER (WHERE (task.is_archived = FALSE OR task.is_archived IS NULL) AND task.status = 'IN_PROGRESS') AS in_progress_count,
        COUNT(task.id) FILTER (WHERE (task.is_archived = FALSE OR task.is_archived IS NULL) AND task.status = 'IN_REVIEW') AS in_review_count,
        COUNT(task.id) FILTER (WHERE (task.is_archived = FALSE OR task.is_archived IS NULL) AND task.status = 'DONE') AS done_count,
        COUNT(task.id) FILTER (WHERE (task.is_archived = FALSE OR task.is_archived IS NULL) AND task.priority = 'URGENT' AND task.status != 'DONE') AS urgent_count
    FROM public.teams t
    LEFT JOIN public.tasks task ON t.id = task.team_id
    GROUP BY t.id, t.name;
$$;
