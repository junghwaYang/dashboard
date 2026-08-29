# 🗄️ 데이터베이스 스키마 및 RLS 보안 명세서

> **대상 데이터베이스**: Supabase (PostgreSQL 15+)  
> **관련 문서**: [PRD.md](file:///Users/yangjeonghwa/fast/fastcampus-ai/dashboard/docs/PRD.md)

---

## 1. 테이블 정의 (DDL)

```sql
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
    is_archived BOOLEAN DEFAULT FALSE NOT NULL,
    archived_at TIMESTAMPTZ DEFAULT NULL,
    cycle_week TEXT DEFAULT NULL,
    archive_batch_id UUID DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 4. 주간 마감 감사 로그(Weekly Archive Logs) 테이블 생성
CREATE TABLE IF NOT EXISTS public.weekly_archive_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cycle_week TEXT NOT NULL,
    status TEXT CHECK (status IN ('SUCCESS', 'FAILED', 'ROLLED_BACK')) NOT NULL,
    executed_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    executed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    total_tasks_before INT NOT NULL DEFAULT 0,
    archived_count INT NOT NULL DEFAULT 0,
    active_tasks_after INT NOT NULL DEFAULT 0,
    error_message TEXT,
    details JSONB DEFAULT '{}'::jsonb
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_tasks_team_id ON public.tasks(team_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id ON public.tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_is_archived ON public.tasks(is_archived);
CREATE INDEX IF NOT EXISTS idx_tasks_archive_batch_id ON public.tasks(archive_batch_id);
CREATE INDEX IF NOT EXISTS idx_tasks_cycle_week ON public.tasks(cycle_week);
CREATE INDEX IF NOT EXISTS idx_profiles_team_id ON public.profiles(team_id);
```

---

## 2. Row Level Security (RLS) 보안 정책

```sql
-- RLS 활성화
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_archive_logs ENABLE ROW LEVEL SECURITY;

-- =======================================================
-- 1. teams 테이블 정책
-- =======================================================
CREATE POLICY "Allow authenticated users to view teams"
ON public.teams FOR SELECT
TO authenticated
USING (true);

-- =======================================================
-- 2. profiles 테이블 정책
-- =======================================================
CREATE POLICY "Allow authenticated users to view profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow users to insert/update their own profile"
ON public.profiles FOR ALL
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- =======================================================
-- 3. tasks 테이블 정책 (본인 팀 격리 및 관리자 전체 접근)
-- =======================================================
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

-- =======================================================
-- 4. weekly_archive_logs 테이블 정책
-- =======================================================
CREATE POLICY "Allow authenticated users to view weekly archive logs"
ON public.weekly_archive_logs FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to manage archive logs via rpc"
ON public.weekly_archive_logs FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
```

---

## 3. Database Functions (RPC)

### 3.1 메인 대시보드 통계 집계 (`get_dashboard_summary_stats`)
활성 업무(`is_archived = false`)를 기준으로 팀별 통계를 집계합니다.

```sql
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
        COUNT(task.id) FILTER (WHERE task.is_archived = FALSE OR task.is_archived IS NULL) AS total_count,
        COUNT(task.id) FILTER (WHERE (task.is_archived = FALSE OR task.is_archived IS NULL) AND task.status = 'TODO') AS todo_count,
        COUNT(task.id) FILTER (WHERE (task.is_archived = FALSE OR task.is_archived IS NULL) AND task.status = 'IN_PROGRESS') AS in_progress_count,
        COUNT(task.id) FILTER (WHERE (task.is_archived = FALSE OR task.is_archived IS NULL) AND task.status = 'IN_REVIEW') AS in_review_count,
        COUNT(task.id) FILTER (WHERE (task.is_archived = FALSE OR task.is_archived IS NULL) AND task.status = 'DONE') AS done_count,
        COUNT(task.id) FILTER (WHERE (task.is_archived = FALSE OR task.is_archived IS NULL) AND task.priority = 'URGENT' AND task.status != 'DONE') AS urgent_count
    FROM public.teams t
    LEFT JOIN public.tasks task ON t.id = task.team_id
    GROUP BY t.id, t.name;
$$;
```

### 3.2 주간 마감 및 업무 보관 실행 (`execute_weekly_archive`)
완료(`DONE`) 업무를 일괄 보관 처리하고 처리 전후 건수 및 실패 기록을 `weekly_archive_logs`에 저장합니다.

```sql
CREATE OR REPLACE FUNCTION execute_weekly_archive(p_executed_by UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
... (상세 로직 구현)
$$;
```

### 3.3 주간 마감 배치 전체 롤백 (`rollback_weekly_archive`)
특정 마감 배치로 보관 처리된 업무 전체를 활성 보드로 원복하고 로그를 `ROLLED_BACK`으로 기록합니다.

```sql
CREATE OR REPLACE FUNCTION rollback_weekly_archive(p_batch_id UUID, p_executed_by UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
... (상세 로직 구현)
$$;
```

### 3.4 실수로 완료된 개별 업무 복구 (`restore_archived_task`)
보관된 특정 업무의 `is_archived`를 해제하고 원하는 상태(기본: `IN_PROGRESS`)로 복원합니다.

```sql
CREATE OR REPLACE FUNCTION restore_archived_task(p_task_id UUID, p_target_status TEXT DEFAULT 'IN_PROGRESS')
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
... (상세 로직 구현)
$$;
```
