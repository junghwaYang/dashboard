-- 1. public 스키마 및 테이블 권한 명시 부여 (GoTrue 및 인증 엔진 접근 허용)
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role, supabase_auth_admin;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role, supabase_auth_admin;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO postgres, anon, authenticated, service_role, supabase_auth_admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role, supabase_auth_admin;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role, supabase_auth_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres, anon, authenticated, service_role, supabase_auth_admin;

-- 2. handle_new_user 트리거 함수 안전하게 수정 (search_path 명시 및 예외 처리)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, extensions
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, role)
  VALUES (
    new.id,
    COALESCE(new.email, ''),
    COALESCE(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(COALESCE(new.email, ''), '@', 1),
      '사용자'
    ),
    new.raw_user_meta_data->>'avatar_url',
    COALESCE(new.raw_user_meta_data->>'role', 'member')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
    updated_at = NOW();

  RETURN new;
EXCEPTION
  WHEN OTHERS THEN
    -- 트리거 내부 에러가 발생해도 auth 로그인이 막히지 않도록 안전하게 예외 무시
    RETURN new;
END;
$$;

-- 트리거는 INSERT 시에만 발동하도록 변경 (UPDATE 시 불필요한 트리거 차단)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. 어드민 유저 profiles 권한 재확인
INSERT INTO public.profiles (
  id,
  email,
  full_name,
  avatar_url,
  team_id,
  role,
  created_at,
  updated_at
)
SELECT
  id,
  email,
  '최고관리자 (Admin)',
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
  NULL,
  'admin',
  NOW(),
  NOW()
FROM auth.users
WHERE email = 'admin@dashboard.app'
ON CONFLICT (id) DO UPDATE SET
  role = 'admin',
  full_name = '최고관리자 (Admin)',
  updated_at = NOW();
