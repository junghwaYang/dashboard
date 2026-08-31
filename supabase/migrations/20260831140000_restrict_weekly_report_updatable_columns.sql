-- 보고서에서 사람이 고칠 수 있는 컬럼을 제한한다
--
-- 발견 경위: 디자인팀 member 계정으로 자기 팀 보고서에
--   UPDATE weekly_reports SET payload = '{...완료 999건...}'
-- 을 실행했더니 통과했다.
--
-- 원인: RLS의 UPDATE 정책은 "이 행을 건드려도 되는가"만 판단한다.
--       어느 컬럼을 바꾸는지는 보지 않는다.
--
-- payload는 기계가 만든 스냅샷이고 사람이 손댈 것이 아니다. 사람이 쓸 수 있는
-- 범위를 요약과 확정으로 좁힌다. 컬럼 단위 권한은 RLS와 별개로 검사되므로
-- 정책은 그대로 두고 권한만 좁히면 된다.
--
-- 생성·재생성은 여전히 upsert_weekly_report(SECURITY DEFINER)만 할 수 있다.
-- 그 함수는 테이블 소유자 권한으로 돌기 때문에 이 제한에 걸리지 않는다.

REVOKE UPDATE ON public.weekly_reports FROM authenticated;

GRANT UPDATE (
    summary_text,        -- 사람이 쓰는 요약 (결정 4)
    summary_written_by,
    status,              -- DRAFT <-> CONFIRMED (기획서 5.3)
    confirmed_at,
    confirmed_by,
    updated_at
) ON public.weekly_reports TO authenticated;

-- INSERT / DELETE는 정책이 없어 RLS가 막지만, 권한 자체도 주지 않는다.
REVOKE INSERT, DELETE, TRUNCATE ON public.weekly_reports FROM authenticated, anon;
REVOKE ALL ON public.weekly_reports FROM anon;
