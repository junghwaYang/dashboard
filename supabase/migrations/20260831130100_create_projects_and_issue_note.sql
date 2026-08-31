-- 프로젝트 테이블과 이슈 필드 (기획서 v0.4 결정 2, 3, 6, 7, 10 / 3.1, 3.2)

-- =======================================================
-- 1. projects — 프로젝트는 반드시 한 팀에 속한다 (결정 7)
-- =======================================================
-- 자유 텍스트 컬럼이 아니라 별도 테이블 + 외래키로 둔다.
-- UNIQUE (team_id, name)이 표기 흔들림(띄어쓰기 차이 등)을 원천에서 막는다.
-- 팀이 다르면 같은 이름의 프로젝트가 존재할 수 있고, 둘은 별개 프로젝트다.
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    team_id TEXT NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE (team_id, name)
);

CREATE INDEX IF NOT EXISTS idx_projects_team_id ON public.projects(team_id);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- 열람은 전원 허용. 전체 보고서가 팀별 프로젝트 목록을 나란히 나열해야 하고,
-- 프로젝트명 자체는 팀 격리 대상 정보가 아니다(업무 상세는 tasks RLS가 막는다).
DROP POLICY IF EXISTS "Allow authenticated read projects" ON public.projects;
CREATE POLICY "Allow authenticated read projects"
ON public.projects FOR SELECT
TO authenticated
USING (true);

-- 생성·수정·삭제는 해당 팀 소속 또는 admin. 기존 tasks 정책과 같은 형태다.
DROP POLICY IF EXISTS "Allow manage projects for team members or admin" ON public.projects;
CREATE POLICY "Allow manage projects for team members or admin"
ON public.projects FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
          AND (profiles.team_id = projects.team_id OR profiles.role = 'admin')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
          AND (profiles.team_id = projects.team_id OR profiles.role = 'admin')
    )
);

-- =======================================================
-- 2. tasks에 project_id / issue_note 추가 (3.1, 3.2)
-- =======================================================
-- issue_note는 단일 필드다. NOT NULL이면 이슈, 비어 있으면 이슈 없음(결정 6).
-- is_issue BOOLEAN을 따로 두지 않는 이유: 플래그는 켜졌는데 내용이 빈
-- 어긋난 상태를 만들 수 있고, 내용 없는 이슈는 규칙 9상 성립하지 않는다.
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS issue_note TEXT;

CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON public.tasks(project_id);

-- =======================================================
-- 3. 업무와 프로젝트의 팀 일치 검증 (3.1)
-- =======================================================
-- UI에서 선택 목록을 해당 팀 프로젝트로 제한하지만, 그것만 믿지 않는다.
-- CHECK 제약으로는 다른 테이블을 참조할 수 없어 트리거를 쓴다.
CREATE OR REPLACE FUNCTION public.enforce_task_project_team_match()
 RETURNS TRIGGER
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_project_team TEXT;
BEGIN
    IF NEW.project_id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT team_id INTO v_project_team
    FROM public.projects
    WHERE id = NEW.project_id;

    IF v_project_team IS DISTINCT FROM NEW.team_id THEN
        RAISE EXCEPTION
            '업무의 팀(%)과 프로젝트의 팀(%)이 다릅니다. 같은 팀의 프로젝트만 지정할 수 있습니다.',
            NEW.team_id, v_project_team;
    END IF;

    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_task_project_team_match ON public.tasks;
CREATE TRIGGER trg_task_project_team_match
BEFORE INSERT OR UPDATE OF project_id, team_id ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.enforce_task_project_team_match();

-- =======================================================
-- 4. 기존 업무 프로젝트 소급 입력 (결정 10)
-- =======================================================
-- 적용 시점 실측: tasks 2건 (supabase 연결하기 / 개발팀, 와이어프레임 작업 / 디자인팀).
-- 팀이 다르므로 이름은 같아도 별개 프로젝트 2건이 된다(결정 7).
INSERT INTO public.projects (name, team_id) VALUES
  ('주간업무 대시보드', 'development'),
  ('주간업무 대시보드', 'design')
ON CONFLICT (team_id, name) DO NOTHING;

-- project_id가 비어 있는 건만 채운다. 재실행해도 이미 지정된 업무를 덮지 않는다.
UPDATE public.tasks t
   SET project_id = p.id
  FROM public.projects p
 WHERE p.team_id = t.team_id
   AND p.name = '주간업무 대시보드'
   AND t.project_id IS NULL;
