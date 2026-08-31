-- SECURITY DEFINER 함수의 search_path 고정
--
-- search_path가 열려 있으면 호출자가 자기 스키마를 앞에 끼워 넣어, 함수 안에서
-- 참조하는 이름이 다른 객체로 해석되게 만들 수 있다. SECURITY DEFINER는 소유자
-- 권한으로 돌기 때문에 그 영향이 크다.
-- (Supabase 데이터베이스 린터의 function_search_path_mutable 항목)
--
-- 이 함수들은 이미 모든 테이블을 public.으로 명시하고 있고, 나머지 함수는
-- pg_catalog에 있다(pg_catalog는 항상 암묵적으로 검색된다). 그래서 빈 값으로 둘 수 있다.
--
-- 대상은 이번 작업에서 만들거나 고친 함수뿐이다. 기존 함수
-- (rollback_weekly_archive, restore_archived_task, get_dashboard_summary_stats,
--  check_profile_admin_role)는 손대지 않았다.

ALTER FUNCTION public.can_generate_weekly_report()                  SET search_path = '';
ALTER FUNCTION public.get_weekly_report_source(text)                SET search_path = '';
ALTER FUNCTION public.upsert_weekly_report(text, text, text, jsonb) SET search_path = '';
ALTER FUNCTION public.enforce_task_project_team_match()             SET search_path = '';
ALTER FUNCTION public.execute_weekly_archive(uuid)                  SET search_path = '';
