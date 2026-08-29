-- 1. 팀(Teams) 테이블 생성
CREATE TABLE IF NOT EXISTS public.teams (
    id TEXT PRIMARY KEY, -- 'planning', 'design', 'development'
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 초기 기본 팀 데이터 입력
INSERT INTO public.teams (id, name, description)
VALUES 
    ('planning', '기획팀', '서비스 및 프로덕트 기획 관리'),
    ('design', '디자인팀', 'UI/UX 및 그래픽 디자인 관리'),
    ('development', '개발팀', '프론트엔드/백엔드/인프라 개발 관리')
ON CONFLICT (id) DO NOTHING;

-- 2. 사용자 프로필(Profiles) 테이블 생성
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT NOT NULL,
    avatar_url TEXT,
    team_id TEXT REFERENCES public.teams(id) ON DELETE SET NULL,
    role TEXT DEFAULT 'member' CHECK (role IN ('member', 'admin')) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3. 업무(Tasks) 테이블 생성
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id TEXT NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'TODO' CHECK (status IN ('TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE')) NOT NULL,
    priority TEXT DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')) NOT NULL,
    assignee_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    due_date DATE,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_tasks_team_id ON public.tasks(team_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id ON public.tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_profiles_team_id ON public.profiles(team_id);

-- RLS 활성화
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- 팀 조회 정책: 모든 인증 유저
CREATE POLICY "Allow authenticated users to view teams"
ON public.teams FOR SELECT
TO authenticated
USING (true);

-- 프로필 조회 정책: 모든 인증 유저
CREATE POLICY "Allow authenticated users to view profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

-- 본인 프로필 생성/수정 정책
CREATE POLICY "Allow users to manage their own profile"
ON public.profiles FOR ALL
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- tasks 조회 정책: 본인 소속 팀이거나 관리자인 경우
CREATE POLICY "Allow team members or admin to select tasks"
ON public.tasks FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND (profiles.team_id = tasks.team_id OR profiles.role = 'admin')
    )
);

-- tasks 생성 정책
CREATE POLICY "Allow team members to insert tasks for their team"
ON public.tasks FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND (profiles.team_id = tasks.team_id OR profiles.role = 'admin')
    )
);

-- tasks 수정 정책
CREATE POLICY "Allow team members to update tasks for their team"
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

-- tasks 삭제 정책
CREATE POLICY "Allow team members to delete tasks for their team"
ON public.tasks FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND (profiles.team_id = tasks.team_id OR profiles.role = 'admin')
    )
);

-- 메인 대시보드 통계용 보안 함수
CREATE OR REPLACE FUNCTION get_dashboard_summary_stats()
RETURNS TABLE (
    team_id TEXT,
    team_name TEXT,
    total_count BIGINT,
    todo_count BIGINT,
    in_progress_count BIGINT,
    in_review_count BIGINT,
    done_count BIGINT,
    urgent_count BIGINT
)
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT 
        t.id AS team_id,
        t.name AS team_name,
        COUNT(task.id) AS total_count,
        COUNT(task.id) FILTER (WHERE task.status = 'TODO') AS todo_count,
        COUNT(task.id) FILTER (WHERE task.status = 'IN_PROGRESS') AS in_progress_count,
        COUNT(task.id) FILTER (WHERE task.status = 'IN_REVIEW') AS in_review_count,
        COUNT(task.id) FILTER (WHERE task.status = 'DONE') AS done_count,
        COUNT(task.id) FILTER (WHERE task.priority = 'URGENT' AND task.status != 'DONE') AS urgent_count
    FROM public.teams t
    LEFT JOIN public.tasks task ON t.id = task.team_id
    GROUP BY t.id, t.name;
$$;
