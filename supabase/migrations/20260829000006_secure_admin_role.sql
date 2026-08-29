-- 최고관리자(Admin) 권한을 siltarre@gmail.com 계정에만 한정하는 보안 마이그레이션

-- 1. siltarre@gmail.com 계정은 role = 'admin'으로 설정
UPDATE public.profiles
SET role = 'admin'
WHERE email = 'siltarre@gmail.com';

-- 2. siltarre@gmail.com 외 다른 계정이 admin으로 되어 있다면 member로 강등
UPDATE public.profiles
SET role = 'member'
WHERE email != 'siltarre@gmail.com' AND role = 'admin';

-- 3. DB 레벨에서 오직 siltarre@gmail.com 만 role = 'admin'을 가질 수 있도록 강제하는 보안 트리거
CREATE OR REPLACE FUNCTION public.check_profile_admin_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NEW.role = 'admin' AND NEW.email != 'siltarre@gmail.com' THEN
    NEW.role := 'member';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_check_profile_admin_role ON public.profiles;
CREATE TRIGGER trigger_check_profile_admin_role
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.check_profile_admin_role();
