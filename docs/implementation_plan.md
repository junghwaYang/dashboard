# 📦 Supabase 주간 업무 보관(아카이빙) 및 새 주차 전환 & 복구 시스템 구현 계획

매주 월요일 완료된(`status = 'DONE'`) 업무를 안전하게 보관(Archive) 처리하고, 새 주차를 시작하며, 처리 전/후 통계 및 실패 로그를 기록하고, 실수로 완료 처리된 업무를 언제든지 복구(Rollback)할 수 있는 완결형 주간 라이프사이클 시스템을 구축합니다.

---

## 1. 주요 기능 및 아키텍처 개요

1. **주간 업무 보관 (Weekly Archive)**:
   - 완료(`DONE`) 상태인 업무를 `is_archived = true`, `archived_at = NOW()`, `cycle_week = 'YYYY-Wxx'`로 업데이트하여 현재 활성 보드에서 보관 처리.
   - 미완료 업무(`TODO`, `IN_PROGRESS`, `IN_REVIEW`)는 보관되지 않고 새 주차의 진행 업무로 유지.
2. **처리 전후 건수 및 실패 기록 (Audit Logging)**:
   - `weekly_archive_logs` 테이블을 신설하여 실행 일시, 주차, 실행자, 처리 전/후 건수, 보관 건수, 성공/실패 여부, 에러 메시지, 팀별 상세 통계를 저장.
3. **복구 (Rollback & Task Recovery)**:
   - **개별 태스크 복구**: 보관함에서 실수로 완료된 업무를 찾아 `[진행 중으로 복구]` 클릭 시 `is_archived = false`, `status = 'IN_PROGRESS'`로 즉시 활성 칸반 보드로 복원.
   - **주간 마감 일괄 롤백**: 관리자가 최근 실행된 마감 배치를 통째로 취소(Rollback)하여 보관 처리된 업무들을 이전 상태로 일괄 복구.
4. **자동화 및 수동 실행**:
   - Next.js API Route (`/api/cron/weekly-archive`)를 제공하여 Vercel Cron 또는 외부 스케줄러로 매주 월요일 자동 실행 가능.
   - 관리자(Admin) 대시보드 UI에서 언제든지 수동 즉시 실행 및 롤백 가능.

---

## 2. 데이터베이스 스키마 설계 (Supabase SQL)

### 2.1 `tasks` 테이블 컬럼 추가 및 인덱스 설정
```sql
-- 1. tasks 테이블에 아카이빙 관련 컬럼 추가
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE NOT NULL,
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS cycle_week TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS archive_batch_id UUID DEFAULT NULL;

-- 2. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_tasks_archived ON public.tasks(is_archived, team_id);
CREATE INDEX IF NOT EXISTS idx_tasks_archive_batch_id ON public.tasks(archive_batch_id);
CREATE INDEX IF NOT EXISTS idx_tasks_cycle_week ON public.tasks(cycle_week);
```

### 2.2 `weekly_archive_logs` 로그 테이블 생성
```sql
CREATE TABLE IF NOT EXISTS public.weekly_archive_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cycle_week TEXT NOT NULL,
    status TEXT CHECK (status IN ('SUCCESS', 'FAILED', 'ROLLED_BACK')) NOT NULL,
    executed_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    executed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    total_tasks_before INT NOT NULL,
    archived_count INT NOT NULL,
    active_tasks_after INT NOT NULL,
    error_message TEXT,
    details JSONB DEFAULT '{}'::jsonb
);

-- RLS 활성화 및 정책 설정
ALTER TABLE public.weekly_archive_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to view weekly archive logs"
ON public.weekly_archive_logs FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow admin to insert/update weekly archive logs"
ON public.weekly_archive_logs FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
);
```

### 2.3 핵심 Database Stored Procedures (RPC)

#### 1) 주간 마감 및 아카이빙 실행 함수 (`execute_weekly_archive`)
- 트랜잭션 내에서 전후 건수 계산, `DONE` 업무 일괄 아카이빙, 로그 기록 및 예외 발생 시 실패 로그 기록.

#### 2) 주간 마감 일괄 롤백 함수 (`rollback_weekly_archive`)
- 특정 배치 ID의 아카이브된 모든 태스크를 `is_archived = false`로 원복하고 로그 상태를 `ROLLED_BACK`으로 변경.

#### 3) 개별 업무 복구 함수 (`restore_archived_task`)
- 특정 태스크 ID를 받아 `is_archived = false`, `status = 'IN_PROGRESS'`로 복구.

#### 4) 기존 통계 함수(`get_dashboard_summary_stats`) 수정
- `is_archived = false` 조건 추가하여 현재 주차 활성 업무만 통계에 반영.

---

## 3. UI 및 프론트엔드 구현 계획

### 3.1 `WeeklyArchiveModal` 신규 컴포넌트 (`src/components/archive/WeeklyArchiveModal.tsx`)
- **Tab 1: 보관함 (Archive Items)**
  - 주차별(예: 2026-W35, 전체 등) 및 팀별 필터.
  - 보관된 완료 업무 카드/테이블 리스트.
  - 개별 태스크 **[활성 업무로 복구]** 버튼 (클릭 시 상태를 '진행 중'으로 변경하며 활성 보드로 즉시 이동).
- **Tab 2: 주간 마감 관리 & 실행 로그 (Admin 전용)**
  - 현재 활성 업무 중 보관 대상(`DONE`) 건수 요약.
  - **[지금 주간 마감 실행]** 버튼 (확인 모달 포함).
  - 마감 실행 이력 테이블 (실행일시, 주차, 실행자, 처리 전/후 건수, 보관 건수, 상태 배지, 실패 사유).
  - 최근 성공한 배치에 대해 **[마감 취소(전체 롤백)]** 버튼 제공.

### 3.2 `DashboardContext` 및 타입 확장
- `src/types/dashboard.ts`: `WeeklyArchiveLog`, `ArchiveSummary` 인터페이스 추가, `Task` 인터페이스에 `is_archived`, `archived_at`, `cycle_week`, `archive_batch_id` 추가.
- `src/context/dashboard-context.tsx`:
  - `tasks` 조회 시 기본적으로 `is_archived = false`인 활성 태스크만 조회하도록 필터 적용.
  - `executeWeeklyArchive`, `rollbackWeeklyArchive`, `restoreArchivedTask`, `fetchArchivedTasks`, `fetchArchiveLogs` 메서드 추가.

### 3.3 상단 네비게이션바 연동 (`src/components/common/Navbar.tsx`)
- 우측 액션 영역에 **[📦 주간 보관함]** 버튼 추가하여 언제든지 모달을 열람할 수 있도록 지원.

### 3.4 API Route (`src/app/api/cron/weekly-archive/route.ts`)
- Cron 스케줄러(Vercel Cron 또는 외부 Webhook) 연동용 엔드포인트.
- `Authorization: Bearer <CRON_SECRET>` 인증 검증 후 `execute_weekly_archive` RPC 실행.

---

## 4. 변경 대상 파일 목록

### [NEW]
- `supabase/migrations/20260829_weekly_archive_system.sql`: DB 스키마 변경, 로그 테이블 및 RPC 함수 정의 마이그레이션 파일.
- `src/components/archive/WeeklyArchiveModal.tsx`: 보관함 조회, 개별 복구, 주간 마감 수동 실행 및 로그/롤백 관리 모달.
- `src/app/api/cron/weekly-archive/route.ts`: 주간 마감 자동화 Cron API 엔드포인트.

### [MODIFY]
- `docs/DATABASE_SCHEMA.md`: 새로 추가된 테이블, 컬럼 및 RPC 함수 명세 업데이트.
- `src/types/dashboard.ts`: 아카이빙 관련 타입 및 로그 인터페이스 추가.
- `src/context/dashboard-context.tsx`: 아카이빙/복구/로그 비즈니스 로직 및 컨텍스트 함수 구현.
- `src/components/common/Navbar.tsx`: 주간 보관함 열기 버튼 추가.

---

## 5. 검증 계획

### 5.1 기능 검증 시나리오
1. **정상 보관 테스트**:
   - `DONE` 상태의 태스크 생성 후 주간 마감 실행 -> 해당 태스크가 보관함으로 이동하고 활성 칸반 보드에서 제외되는지 확인.
   - `TODO`, `IN_PROGRESS` 태스크는 그대로 활성 상태로 유지되는지 확인.
2. **실행 로그 기록 검증**:
   - `weekly_archive_logs`에 실행 시간, 처리 전 건수, 보관 건수, 처리 후 건수가 정확히 기록되는지 확인.
3. **개별 태스크 복구(Rollback) 테스트**:
   - 보관함 탭에서 특정 보관 업무의 [복구] 버튼 클릭 -> 상태가 `IN_PROGRESS`로 변경되며 칸반 보드에 다시 나타나는지 확인.
4. **배치 전체 롤백 테스트**:
   - 관리자 탭에서 최근 마감 배치의 [마감 취소(전체 롤백)] 클릭 -> 해당 배치로 보관되었던 모든 태스크가 원복되는지 확인.
5. **빌드 및 타입 무결성 검증**:
   - Next.js TypeScript 컴파일 및 린트 정상 통과 확인.
