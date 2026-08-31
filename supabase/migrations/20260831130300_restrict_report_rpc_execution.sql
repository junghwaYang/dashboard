-- 보고서 생성 RPC 권한 잠금
--
-- 앞 마이그레이션에서 만든 두 함수는 SECURITY DEFINER라 RLS를 우회한다.
-- 특히 get_weekly_report_source는 전 팀의 업무를 반환하므로, Postgres 기본값
-- (PUBLIC 실행 가능) 그대로 두면 클라이언트 번들에 들어 있는 공개 anon 키만으로
-- 팀 격리를 우회할 수 있다.
--
-- 두 겹으로 막는다.
--   (1) EXECUTE 권한을 anon과 PUBLIC에서 회수한다
--   (2) 함수 안에서 호출자를 다시 확인한다 (service_role 또는 admin)
--
-- ⚠ NULL 처리에 주의한다. auth.role()은 JWT 클레임이 없으면 NULL을 돌려주고,
--   NULL = 'service_role' 은 NULL이며, IF NOT NULL THEN ... END IF 는
--   본문을 실행하지 않는다. 즉 검사가 "열린 채로" 실패한다.
--   그래서 함수는 COALESCE로 false를 보장하고, 호출부는 IS NOT TRUE로 검사한다.

CREATE OR REPLACE FUNCTION public.can_generate_weekly_report()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
AS $function$
    SELECT COALESCE(
        COALESCE(auth.role(), '') = 'service_role'
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        ),
        FALSE
    );
$function$;

CREATE OR REPLACE FUNCTION public.get_weekly_report_source(p_cycle_week text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
AS $function$
DECLARE
    v_result jsonb;
BEGIN
    IF public.can_generate_weekly_report() IS NOT TRUE THEN
        RAISE EXCEPTION '보고서 원천 데이터 조회 권한이 없습니다.'
            USING ERRCODE = '42501';
    END IF;

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
    ) INTO v_result;

    RETURN v_result;
END;
$function$;

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
    IF public.can_generate_weekly_report() IS NOT TRUE THEN
        RAISE EXCEPTION '보고서 생성 권한이 없습니다.'
            USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_existing
    FROM public.weekly_reports
    WHERE cycle_week = p_cycle_week
      AND scope = p_scope
      AND team_id IS NOT DISTINCT FROM p_team_id;

    -- DRAFT면 덮어쓰고, CONFIRMED면 거부한다 (기획서 4.3).
    -- 사람이 확정한 보고서를 자동 재생성이 덮지 않게 한다.
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

REVOKE EXECUTE ON FUNCTION public.get_weekly_report_source(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.upsert_weekly_report(text, text, text, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_generate_weekly_report() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_weekly_report_source(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.upsert_weekly_report(text, text, text, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_generate_weekly_report() TO authenticated, service_role;
