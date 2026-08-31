-- ⚠ 이 파일의 get_weekly_report_source / upsert_weekly_report 정의는
-- 20260831130300_restrict_report_rpc_execution.sql이 권한 가드를 붙여 대체한다.
-- 순서대로 적용하면 최종 상태는 130300 쪽이다.

-- 주간 보고서 스냅샷 (기획서 v0.4 결정 4, 5, 9 / 4.3, 4.4)

-- =======================================================
-- 1. weekly_reports
-- =======================================================
-- 스냅샷으로 저장하는 이유 세 가지.
--  (1) 진행중·이슈는 마감 시점 상태다. 저장하지 않으면 지난 주 보고서를 열었을 때
--      그 주가 아니라 오늘 상태가 나온다.
--  (2) 반복 이슈 판정의 유일한 근거다(규칙 10). issue_note를 비우면 이슈 흔적이
--      tasks에서 사라지므로 스냅샷이 이력을 대신한다.
--  (3) DRAFT / CONFIRMED 확정 상태를 기록한다.
CREATE TABLE IF NOT EXISTS public.weekly_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cycle_week TEXT NOT NULL,
    scope TEXT CHECK (scope IN ('TEAM','ALL')) NOT NULL,
    team_id TEXT REFERENCES public.teams(id) ON DELETE CASCADE,
    status TEXT CHECK (status IN ('DRAFT','CONFIRMED')) DEFAULT 'DRAFT' NOT NULL,
    summary_text TEXT,
    summary_written_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    confirmed_at TIMESTAMPTZ,
    confirmed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    payload JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,

    -- scope와 team_id는 함께 움직인다. ALL이면 팀이 없고, TEAM이면 반드시 있다.
    CONSTRAINT weekly_reports_scope_team_ck CHECK (
        (scope = 'ALL'  AND team_id IS NULL) OR
        (scope = 'TEAM' AND team_id IS NOT NULL)
    )
);

-- 기획서 4.4의 UNIQUE (cycle_week, scope, team_id)를 그대로 쓰지 않는다.
-- Postgres는 UNIQUE 제약에서 NULL을 서로 다른 값으로 취급하므로,
-- team_id가 NULL인 scope='ALL' 행이 한 주차에 여러 개 생길 수 있다.
-- 부분 유니크 인덱스 두 개로 나눠야 실제로 1건씩만 보장된다.
CREATE UNIQUE INDEX IF NOT EXISTS uq_weekly_reports_team
  ON public.weekly_reports(cycle_week, team_id) WHERE scope = 'TEAM';
CREATE UNIQUE INDEX IF NOT EXISTS uq_weekly_reports_all
  ON public.weekly_reports(cycle_week) WHERE scope = 'ALL';

CREATE INDEX IF NOT EXISTS idx_weekly_reports_cycle_week ON public.weekly_reports(cycle_week);

ALTER TABLE public.weekly_reports ENABLE ROW LEVEL SECURITY;

-- 열람·작성 권한 (결정 9)
--   팀별 보고서: 해당 팀 소속 member + admin
--   전체 보고서: admin만
-- 팀장 역할은 두지 않는다. profiles.role은 member / admin 2종뿐이다.
DROP POLICY IF EXISTS "Allow read weekly reports by scope" ON public.weekly_reports;
CREATE POLICY "Allow read weekly reports by scope"
ON public.weekly_reports FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
          AND (
                profiles.role = 'admin'
             OR (weekly_reports.scope = 'TEAM' AND profiles.team_id = weekly_reports.team_id)
          )
    )
);

-- 요약 작성과 확정은 UPDATE로 이뤄진다. 열람과 같은 범위다.
DROP POLICY IF EXISTS "Allow update weekly reports by scope" ON public.weekly_reports;
CREATE POLICY "Allow update weekly reports by scope"
ON public.weekly_reports FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
          AND (
                profiles.role = 'admin'
             OR (weekly_reports.scope = 'TEAM' AND profiles.team_id = weekly_reports.team_id)
          )
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
          AND (
                profiles.role = 'admin'
             OR (weekly_reports.scope = 'TEAM' AND profiles.team_id = weekly_reports.team_id)
          )
    )
);

-- INSERT 정책은 두지 않는다. 보고서 행 생성은 아래 upsert_weekly_report
-- (SECURITY DEFINER)로만 이뤄진다. cron은 사용자 세션이 없어 RLS를 통과할 수 없다.

-- =======================================================
-- 2. 보고서 원천 데이터 조회 (4.2)
-- =======================================================
-- 집계와 분류는 애플리케이션(src/lib/report/build-report.ts)에서 한다.
-- 이 함수는 그 재료만 모아 준다. cron이 세션 없이 호출하므로 SECURITY DEFINER다.
--
-- cycle_week만 믿고 완료 건을 세면 안 된다(4.2).
-- 복구된 업무에는 cycle_week이 남아 있고 is_archived만 false인 행이 계속 생긴다.
--   완료 건        : is_archived = TRUE  AND cycle_week = :week
--   진행중 / 이슈  : is_archived = FALSE  (마감 직후 시점의 잔여 업무)
CREATE OR REPLACE FUNCTION public.get_weekly_report_source(p_cycle_week text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
AS $function$
    SELECT jsonb_build_object(
        'cycle_week', p_cycle_week,
        'teams', COALESCE((
            SELECT jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name) ORDER BY t.id)
            FROM public.teams t
        ), '[]'::jsonb),
        'profiles', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'id', p.id, 'full_name', p.full_name, 'team_id', p.team_id, 'role', p.role
            ) ORDER BY p.full_name)
            FROM public.profiles p
        ), '[]'::jsonb),
        'projects', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'id', pr.id, 'name', pr.name, 'team_id', pr.team_id
            ) ORDER BY pr.team_id, pr.name)
            FROM public.projects pr
        ), '[]'::jsonb),
        'tasks', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'id', tk.id,
                'title', tk.title,
                'description', tk.description,
                'status', tk.status,
                'team_id', tk.team_id,
                'assignee_id', tk.assignee_id,
                'project_id', tk.project_id,
                'issue_note', tk.issue_note,
                'is_archived', tk.is_archived,
                'cycle_week', tk.cycle_week
            ) ORDER BY tk.created_at)
            FROM public.tasks tk
            WHERE (tk.is_archived = TRUE AND tk.cycle_week = p_cycle_week)
               OR (tk.is_archived = FALSE)
        ), '[]'::jsonb)
    );
$function$;

-- =======================================================
-- 3. 보고서 스냅샷 저장 (4.3 재생성 규칙)
-- =======================================================
-- DRAFT면 덮어쓰고, CONFIRMED면 거부한다.
-- 사람이 확정한 보고서를 자동 재생성이 덮지 않게 한다.
CREATE OR REPLACE FUNCTION public.upsert_weekly_report(
    p_cycle_week text,
    p_scope text,
    p_team_id text,
    p_payload jsonb
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_existing public.weekly_reports%ROWTYPE;
    v_id UUID;
BEGIN
    SELECT * INTO v_existing
    FROM public.weekly_reports
    WHERE cycle_week = p_cycle_week
      AND scope = p_scope
      AND team_id IS NOT DISTINCT FROM p_team_id;

    IF FOUND AND v_existing.status = 'CONFIRMED' THEN
        RETURN jsonb_build_object(
            'success', TRUE, 'skipped', TRUE, 'reason', 'CONFIRMED',
            'id', v_existing.id, 'scope', p_scope, 'team_id', p_team_id
        );
    END IF;

    IF FOUND THEN
        UPDATE public.weekly_reports
        SET payload = p_payload,
            updated_at = TIMEZONE('utc'::text, NOW())
        WHERE id = v_existing.id;
        v_id := v_existing.id;
    ELSE
        INSERT INTO public.weekly_reports (cycle_week, scope, team_id, payload)
        VALUES (p_cycle_week, p_scope, p_team_id, p_payload)
        RETURNING id INTO v_id;
    END IF;

    RETURN jsonb_build_object(
        'success', TRUE, 'skipped', FALSE,
        'id', v_id, 'scope', p_scope, 'team_id', p_team_id
    );
END;
$function$;
