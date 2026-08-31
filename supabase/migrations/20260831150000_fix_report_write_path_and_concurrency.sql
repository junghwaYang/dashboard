-- Codex 리뷰(2026-08-31) 지적 #3, #5, #6, #8 수정
--
-- #3 확정 상태 전이와 감사 필드를 사람이 위조할 수 있었다
-- #5 upsert_weekly_report가 잠금 없이 SELECT -> UPDATE 해서 확정본을 덮을 수 있었다
-- #6 projects.team_id를 바꾸면 연결된 업무가 조용히 팀 불일치가 됐다
-- #8 summary_text에 길이 제한이 없어 DOCX 생성으로 서버 자원을 소모시킬 수 있었다

-- ── #8 요약 길이 제한 ────────────────────────────────────
ALTER TABLE public.weekly_reports
  DROP CONSTRAINT IF EXISTS weekly_reports_summary_len_ck;
ALTER TABLE public.weekly_reports
  ADD CONSTRAINT weekly_reports_summary_len_ck
  CHECK (summary_text IS NULL OR char_length(summary_text) <= 5000);

-- ── #3 사람의 직접 UPDATE를 끊는다 ──────────────────────
-- 컬럼 단위 권한만으로는 부족했다. status / confirmed_by / summary_written_by를
-- 열어 두면 다음이 가능했다.
--   - CONFIRMED -> DRAFT 역전 후 재생성으로 확정본 payload 덮어쓰기
--   - confirmed_by에 다른 사람 UUID를 넣어 감사 기록 위조
--   - 확정 후 요약 수정
-- 상태 전이와 감사 필드는 함수가 auth.uid()로 직접 기록해야 한다.
REVOKE UPDATE ON public.weekly_reports FROM authenticated;
DROP POLICY IF EXISTS "Allow update weekly reports by scope" ON public.weekly_reports;

CREATE OR REPLACE FUNCTION public.can_write_weekly_report(p_report_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $function$
    SELECT COALESCE((
        SELECT p.role = 'admin' OR (r.scope = 'TEAM' AND p.team_id = r.team_id)
        FROM public.weekly_reports r
        JOIN public.profiles p ON p.id = auth.uid()
        WHERE r.id = p_report_id
    ), FALSE);
$function$;

CREATE OR REPLACE FUNCTION public.save_weekly_report_summary(p_report_id uuid, p_summary text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE v_status TEXT;
BEGIN
    IF public.can_write_weekly_report(p_report_id) IS NOT TRUE THEN
        RAISE EXCEPTION '이 보고서에 요약을 쓸 권한이 없습니다.' USING ERRCODE = '42501';
    END IF;
    IF p_summary IS NOT NULL AND char_length(p_summary) > 5000 THEN
        RAISE EXCEPTION '요약은 5000자를 넘을 수 없습니다.' USING ERRCODE = '22001';
    END IF;

    SELECT status INTO v_status FROM public.weekly_reports WHERE id = p_report_id FOR UPDATE;
    IF v_status = 'CONFIRMED' THEN
        RAISE EXCEPTION '확정된 보고서는 수정할 수 없습니다.' USING ERRCODE = '55000';
    END IF;

    UPDATE public.weekly_reports
       SET summary_text = p_summary,
           summary_written_by = auth.uid(),
           updated_at = TIMEZONE('utc'::text, NOW())
     WHERE id = p_report_id;

    RETURN jsonb_build_object('success', TRUE, 'id', p_report_id);
END;
$function$;

-- 확정은 DRAFT -> CONFIRMED 단방향이다. 되돌리는 경로를 두지 않는다.
-- 되돌리기가 필요해지면 admin 전용 함수를 따로 만들어야 한다(현재 범위 밖).
CREATE OR REPLACE FUNCTION public.confirm_weekly_report(p_report_id uuid, p_summary text DEFAULT NULL)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE v_status TEXT;
BEGIN
    IF public.can_write_weekly_report(p_report_id) IS NOT TRUE THEN
        RAISE EXCEPTION '이 보고서를 확정할 권한이 없습니다.' USING ERRCODE = '42501';
    END IF;
    IF p_summary IS NOT NULL AND char_length(p_summary) > 5000 THEN
        RAISE EXCEPTION '요약은 5000자를 넘을 수 없습니다.' USING ERRCODE = '22001';
    END IF;

    SELECT status INTO v_status FROM public.weekly_reports WHERE id = p_report_id FOR UPDATE;
    IF v_status = 'CONFIRMED' THEN
        RETURN jsonb_build_object('success', TRUE, 'already_confirmed', TRUE, 'id', p_report_id);
    END IF;

    UPDATE public.weekly_reports
       SET status = 'CONFIRMED',
           summary_text = COALESCE(p_summary, summary_text),
           summary_written_by = CASE WHEN p_summary IS NOT NULL THEN auth.uid()
                                     ELSE summary_written_by END,
           confirmed_at = TIMEZONE('utc'::text, NOW()),
           confirmed_by = auth.uid(),
           updated_at = TIMEZONE('utc'::text, NOW())
     WHERE id = p_report_id;

    RETURN jsonb_build_object('success', TRUE, 'already_confirmed', FALSE, 'id', p_report_id);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.can_write_weekly_report(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.save_weekly_report_summary(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.confirm_weekly_report(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_write_weekly_report(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_weekly_report_summary(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_weekly_report(uuid, text) TO authenticated;

-- ── #5 upsert 동시성 ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.upsert_weekly_report(
    p_cycle_week text, p_scope text, p_team_id text, p_payload jsonb)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
    v_existing public.weekly_reports%ROWTYPE;
    v_id UUID;
BEGIN
    IF public.can_generate_weekly_report() IS NOT TRUE THEN
        RAISE EXCEPTION '보고서 생성 권한이 없습니다.' USING ERRCODE = '42501';
    END IF;

    -- FOR UPDATE로 잠근다. 확정 여부를 읽은 뒤 다른 트랜잭션이 바꿀 수 없다.
    SELECT * INTO v_existing FROM public.weekly_reports
    WHERE cycle_week = p_cycle_week AND scope = p_scope
      AND team_id IS NOT DISTINCT FROM p_team_id
    FOR UPDATE;

    IF FOUND THEN
        IF v_existing.status = 'CONFIRMED' THEN
            RETURN jsonb_build_object('success', TRUE, 'skipped', TRUE, 'reason', 'CONFIRMED',
                                      'id', v_existing.id, 'scope', p_scope, 'team_id', p_team_id);
        END IF;
        UPDATE public.weekly_reports
           SET payload = p_payload, updated_at = TIMEZONE('utc'::text, NOW())
         WHERE id = v_existing.id;
        RETURN jsonb_build_object('success', TRUE, 'skipped', FALSE,
                                  'id', v_existing.id, 'scope', p_scope, 'team_id', p_team_id);
    END IF;

    -- 행이 없었다. 그 사이 다른 호출이 먼저 넣었을 수 있으므로 충돌을 흡수한다.
    BEGIN
        INSERT INTO public.weekly_reports (cycle_week, scope, team_id, payload)
        VALUES (p_cycle_week, p_scope, p_team_id, p_payload)
        RETURNING id INTO v_id;
    EXCEPTION WHEN unique_violation THEN
        SELECT * INTO v_existing FROM public.weekly_reports
        WHERE cycle_week = p_cycle_week AND scope = p_scope
          AND team_id IS NOT DISTINCT FROM p_team_id
        FOR UPDATE;
        IF v_existing.status = 'CONFIRMED' THEN
            RETURN jsonb_build_object('success', TRUE, 'skipped', TRUE, 'reason', 'CONFIRMED',
                                      'id', v_existing.id, 'scope', p_scope, 'team_id', p_team_id);
        END IF;
        UPDATE public.weekly_reports
           SET payload = p_payload, updated_at = TIMEZONE('utc'::text, NOW())
         WHERE id = v_existing.id;
        v_id := v_existing.id;
    END;

    RETURN jsonb_build_object('success', TRUE, 'skipped', FALSE,
                              'id', v_id, 'scope', p_scope, 'team_id', p_team_id);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.upsert_weekly_report(text, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_weekly_report(text, text, text, jsonb) TO authenticated, service_role;

-- ── #6 프로젝트의 팀 변경 ───────────────────────────────
-- 기존 트리거는 tasks 쪽 변경만 감시했다. projects.team_id를 바꾸면
-- tasks 행은 UPDATE되지 않아 트리거가 돌지 않았다.
CREATE OR REPLACE FUNCTION public.enforce_project_team_change()
 RETURNS TRIGGER LANGUAGE plpgsql SET search_path = ''
AS $function$
DECLARE v_task_count INT;
BEGIN
    IF NEW.team_id IS NOT DISTINCT FROM OLD.team_id THEN RETURN NEW; END IF;

    SELECT COUNT(*) INTO v_task_count FROM public.tasks WHERE project_id = NEW.id;
    IF v_task_count > 0 THEN
        RAISE EXCEPTION
            '이 프로젝트에 연결된 업무가 %건 있어 소속 팀을 바꿀 수 없습니다. 업무를 먼저 옮기세요.',
            v_task_count;
    END IF;
    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_project_team_change ON public.projects;
CREATE TRIGGER trg_project_team_change
BEFORE UPDATE OF team_id ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.enforce_project_team_change();
