-- 관리자 자가 승격 차단 (A안 — 2026-08-31 승인)
--
-- 문제: 일반 member가 스스로 admin이 될 수 있었다.
--
--   UPDATE profiles SET email='siltarre@gmail.com', role='admin' WHERE id = auth.uid();
--
-- 이 UPDATE가 실제로 통과하는 것을 확인했다(확인 후 즉시 원복).
--
-- 원인이 둘 겹쳤다.
--   (1) 프로필 UPDATE 정책이 자기 행의 모든 컬럼을 열어 둔다
--   (2) 기존 트리거 check_profile_admin_role이 NEW.email 문자열만 봤다.
--       그 값이 실제 로그인 계정(auth.users.email)과 같은지 확인하지 않았고,
--       profiles.email에는 유일성 제약도 auth.users와의 일치 제약도 없었다.
--
-- 영향은 이 기능에 국한되지 않았다. tasks RLS의 admin 분기, 전체 보고서 열람,
-- 보고서 생성 RPC가 전부 profiles.role을 신뢰하므로 함께 무력화됐다.
--
-- 해결: 판단 기준을 "프로필에 적힌 이메일"에서 "실제 로그인 계정의 이메일"로 옮긴다.
--       auth.users는 사용자가 임의로 쓸 수 없으므로 위조가 불가능하다.
--
-- A안이므로 팀 변경은 그대로 둔다. 지금처럼 본인이 소속 팀을 고른다.
-- (B안 = 팀 변경도 관리자만. 아래 주석 블록을 켜면 된다. 온보딩 흐름이 바뀐다.)
--
-- 예외를 던지지 않고 값을 바로잡는 기존 방식을 유지한다. 앱의 프로필 upsert가
-- 실패하지 않게 하기 위해서다. 보안 결과는 같다.
--
-- 전제 확인 (적용 전 실측):
--   - profiles.id는 auth.users(id)를 참조한다 → 계정 없는 프로필이 생길 수 없다
--   - auth.users의 프로필 생성 트리거는 마이그레이션 000005에서 제거됐다
--     → 프로필은 로그인 후 앱이 만든다. 즉 이 트리거가 도는 시점에 계정이 이미 있다

CREATE OR REPLACE FUNCTION public.check_profile_admin_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_auth_email TEXT;
BEGIN
  SELECT email INTO v_auth_email FROM auth.users WHERE id = NEW.id;

  IF v_auth_email IS NULL THEN
    -- 참조가 깨진 경우에만 도달한다. 판단 근거가 없으므로 권한을 주지 않는다.
    NEW.role := 'member';
    RETURN NEW;
  END IF;

  -- 프로필 이메일은 실제 계정 이메일로 고정한다. 사용자가 바꿔 써도 되돌린다.
  NEW.email := v_auth_email;

  -- 관리자는 실제 로그인 계정이 슈퍼관리자일 때만 가능하다.
  IF NEW.role = 'admin' AND v_auth_email <> 'siltarre@gmail.com' THEN
    NEW.role := 'member';
  END IF;

  -- [B안 전용] 팀 변경을 관리자만 하게 하려면 아래를 켠다.
  -- IF TG_OP = 'UPDATE' AND NEW.team_id IS DISTINCT FROM OLD.team_id
  --    AND NOT EXISTS (SELECT 1 FROM public.profiles
  --                     WHERE id = auth.uid() AND role = 'admin') THEN
  --   RAISE EXCEPTION '소속 팀은 관리자만 변경할 수 있습니다.';
  -- END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_check_profile_admin_role ON public.profiles;
CREATE TRIGGER trigger_check_profile_admin_role
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.check_profile_admin_role();
