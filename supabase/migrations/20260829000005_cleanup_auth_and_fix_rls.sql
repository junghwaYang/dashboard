-- 1. auth.users에 걸린 모든 커스텀 트리거 완전 제거 (GoTrue 간섭 및 500 에러 원인 차단)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 2. auth.users에 수동 생성했던 admin@dashboard.app 레코드 정리 (GoTrue 스키마 불일치 해소)
DELETE FROM auth.identities WHERE identity_data->>'email' = 'admin@dashboard.app';
DELETE FROM auth.users WHERE email = 'admin@dashboard.app';

-- 3. public 스키마의 RLS 정책 완전 정비 (권한 충돌 및 무한 재귀 방지)
-- 3-1. teams 테이블
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all users to view teams" ON public.teams;
DROP POLICY IF EXISTS "Allow authenticated users to view teams" ON public.teams;
CREATE POLICY "Allow public read teams"
ON public.teams FOR SELECT
TO public
USING (true);

-- 3-2. profiles 테이블
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated users to view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow users to manage their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow users to insert/update their own profile" ON public.profiles;

-- 모든 유저가 프로필 목록(이름, 팀, 아바타, 역할)을 읽을 수 있도록 허용
CREATE POLICY "Allow public read profiles"
ON public.profiles FOR SELECT
TO public
USING (true);

-- 인증된 유저는 본인 프로필 생성/수정 가능
CREATE POLICY "Allow users to insert own profile"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "Allow users to update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 3-3. tasks 테이블
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow team members or admin to select tasks" ON public.tasks;
DROP POLICY IF EXISTS "Allow team members to insert tasks for their team" ON public.tasks;
DROP POLICY IF EXISTS "Allow team members to update tasks for their team" ON public.tasks;
DROP POLICY IF EXISTS "Allow team members to delete tasks for their team" ON public.tasks;

-- 조회: 본인 팀이거나 admin이거나 인증된 유저의 소속 팀 일치 시
CREATE POLICY "Allow select tasks for team members or admin"
ON public.tasks FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND (profiles.team_id = tasks.team_id OR profiles.role = 'admin')
  )
);

-- 생성: 본인 팀이거나 admin
CREATE POLICY "Allow insert tasks for team members or admin"
ON public.tasks FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND (profiles.team_id = tasks.team_id OR profiles.role = 'admin')
  )
);

-- 수정: 본인 팀이거나 admin
CREATE POLICY "Allow update tasks for team members or admin"
ON public.tasks FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND (profiles.team_id = tasks.team_id OR profiles.role = 'admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND (profiles.team_id = tasks.team_id OR profiles.role = 'admin')
  )
);

-- 삭제: 본인 팀이거나 admin
CREATE POLICY "Allow delete tasks for team members or admin"
ON public.tasks FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND (profiles.team_id = tasks.team_id OR profiles.role = 'admin')
  )
);

-- 4. public 스키마 권한 명시
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO postgres, anon, authenticated, service_role;
