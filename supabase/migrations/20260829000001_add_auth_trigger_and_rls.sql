-- 1. 구글 및 이메일 로그인 시 profiles 자동 생성/동기화 트리거 함수
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, role)
  VALUES (
    new.id,
    COALESCE(new.email, ''),
    COALESCE(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(COALESCE(new.email, ''), '@', 1)
    ),
    new.raw_user_meta_data->>'avatar_url',
    'member'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
    updated_at = NOW();
  RETURN new;
END;
$$;

-- 트리거 연결
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. profiles 테이블 RLS 보강 (인증된 유저 본인 프로필 upsert/update 및 다른 유저 읽기)
DROP POLICY IF EXISTS "Allow authenticated users to view profiles" ON public.profiles;
CREATE POLICY "Allow authenticated users to view profiles"
ON public.profiles FOR SELECT
TO authenticated, anon
USING (true);

DROP POLICY IF EXISTS "Allow users to manage their own profile" ON public.profiles;
CREATE POLICY "Allow users to manage their own profile"
ON public.profiles FOR ALL
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 3. teams 테이블 RLS (anon도 조회 가능하여 온보딩/초기화 시 팀 목록 로드)
DROP POLICY IF EXISTS "Allow authenticated users to view teams" ON public.teams;
CREATE POLICY "Allow all users to view teams"
ON public.teams FOR SELECT
TO authenticated, anon
USING (true);

-- 4. Realtime 활성화 (tasks 테이블 실시간 동기화)
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
