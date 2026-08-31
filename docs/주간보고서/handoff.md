# 주간 보고서 기능 — 작업 인수인계 (Handoff)

> **최종 갱신**: 2026-08-31
> **브랜치**: `feature/weekly-report`
> **상태**: 1차 범위 **구현 완료 + 엔드투엔드 실행 검증 완료 + 보고서 화면 목록·모달 개편 완료(브라우저 검증)**
> **관련 문서**: [주간보고서_기능_기획서.md](./주간보고서_기능_기획서.md) (v0.5), [CLAUDE.md](./CLAUDE.md)

---

## 0. 이 문서를 읽는 순서

바쁘면 **1절과 6절만** 읽으면 된다. 1절은 무엇이 만들어졌는지, 6절은 아직 안 끝난 것이다.

이전 버전(구현 착수 전)의 내용은 기획서 v0.5에 모두 흡수됐다. 이 문서는 실제로 만든 것과 그 과정에서 드러난 사실만 다룬다.

---

## 1. 무엇을 만들었나

기획서 6절의 1차 범위를 전부 구현했고, 여기에 결정 11(Word 내보내기)이 추가됐다.

### 화면

| 경로 | 내용 | 열람 권한 |
|---|---|---|
| `/teams/[teamId]/report` | 팀별 주간 보고서 목록 | 해당 팀 소속 + admin |
| `/report` | 전체 주간 보고서 목록 | admin만 |
| `…/report?week=2026-W35` | 해당 주차 보고서가 모달로 열린 상태 | 위와 동일 |

**두 화면은 생성된 보고서의 목록이다.** 주차를 좌우 화살표로 넘기던 구조를 2026-08-31에 바꿨다(아래 "보고서 화면 개편").
각 행은 `2026년 8월 24일 ~ 8월 30일` 날짜 범위로 표시되고, 확정/미확정 배지와 완료·진행·이슈 건수가 함께 붙는다.
행을 클릭하거나 Enter/Space로 열면 그 보고서가 모달로 뜬다. 모달 안에서 요약 작성, 확정, Word 내려받기를 한다.
관리자에게는 목록 헤더에 재생성 버튼이 더 보인다.
사이드바에 "주간 보고서" 항목을 추가했다. 내 팀 보고서는 소속이 있으면, 전체 보고서는 admin에게만 보인다.

### 신규 소스

```
src/types/report.ts                        타입 정의
src/lib/report/cycle-week.ts               주차 계산 (DB의 TO_CHAR과 같은 결과를 내야 한다) + 날짜 범위 표기
src/lib/report/build-report.ts             집계 — 이 기능의 핵심
src/lib/report/build-report.test.ts        검증 20건 (의존성 없이 node --test로 돈다)
src/lib/report/generate.ts                 생성 오케스트레이션
src/lib/report/docx.ts                     Word(.docx) 생성
src/lib/supabase/admin.ts                  service role 클라이언트 (cron 전용)
src/components/report/ReportView.tsx       보고서 본문 렌더러 (규칙 15 순서 고정)
src/components/report/ReportPageShell.tsx  보고서 목록 + 모달 열고 닫기(딥링크 동기화)
src/components/report/ReportDetailModal.tsx 상세 모달 — 요약 / 확정 / 다운로드 / 본문
src/app/report/page.tsx                    전체 보고서 페이지
src/app/teams/[teamId]/report/page.tsx     팀별 보고서 페이지
src/app/api/reports/generate/route.ts      수동 재생성 (admin)
src/app/api/reports/docx/route.ts          Word 내려받기
```

### 보고서 화면 개편 (2026-08-31)

주차를 화살표로 하나씩 넘기던 단일 주차 화면을, **생성된 보고서의 목록 + 상세 모달**로 바꿨다.
보고서가 쌓일수록 "언제 것이 있는지" 자체가 안 보이던 문제 때문이다.

| 바뀐 것 | 내용 |
|---|---|
| 목록 | `weekly_reports`를 `cycle_week` 내림차순으로 전부 조회해 세로 리스트로 그린다 |
| 날짜 표기 | 주차 키(`2026-W35`) 대신 `2026년 8월 24일 ~ 8월 30일`. 주차 키는 보조 배지로 남겼다 |
| 상세 | 행을 열면 모달. 요약 작성·저장·확정, `ReportView` 본문, Word 내려받기가 전부 모달 안에 있다 |
| 딥링크 | `?week=` 유지. 그 URL로 직접 들어오면 모달이 열린 채 시작하고, 닫으면 파라미터가 지워진다 |
| 닫기 | ESC, 오버레이 바깥 클릭, 우상단 X 세 경로 |
| 키보드 | 목록 행은 `role="button"` + `tabIndex=0` + Enter/Space 핸들러다. `div`에 `onClick`만 달면 키보드로 도달조차 못 한다 |

**날짜 변환은 `formatCycleWeekRange`가 한다.** 기존 `cycle-week.ts` 함수는 DB의 `TO_CHAR`과 결과가 일치해야 해서
실측값 테스트가 걸려 있다. 그래서 기존 함수를 건드리지 않고 순수 함수를 새로 붙였다.
Python 표준 ISO 달력(`date.fromisocalendar`)과 대조해 53주차 연도(`2020-W53`), 연도 넘김(`2026-W01`)까지 일치를 확인했다.

**RPC와 권한 판정은 위치만 옮겼고 내용은 그대로다.** `save_weekly_report_summary`, `confirm_weekly_report`,
`canWrite`/`isAdmin` 모두 원문 유지다. 화면 구조가 바뀌어도 보안 경계는 그대로여야 한다.

> 이 개편은 Antigravity CLI(`agy`)에 위임해 구현하고 이쪽에서 검증했다.
> 절차는 `~/.claude/skills/delegate-verify-loop/SKILL.md`에 스킬로 정리해 뒀다.
> 위임 과정에서 완료 조건에 `npm run lint`를 넣은 탓에 에이전트가 ESLint를 새로 설치하고
> 규칙 두 개를 꺼서 통과시킨 일이 있었다. **그 변경분은 되돌렸다.** 이 저장소는 여전히 ESLint 설정이 없다.

### 변경된 기존 파일

| 파일 | 변경 |
|---|---|
| `src/app/api/cron/weekly-archive/route.ts` | 마감 성공 후 보고서 4건 자동 생성 추가 |
| `src/components/common/TaskModal.tsx` | 프로젝트 선택 + 이슈 입력란 추가 |
| `src/context/dashboard-context.tsx` | `projects` 조회, `createTask` 인자 확장 |
| `src/components/common/Sidebar.tsx` | 보고서 진입점 |
| `src/types/dashboard.ts` | `Task`에 `project_id`/`issue_note`, `Project` 타입 |
| `src/middleware.ts` | 매처에 `/report` 추가 |
| `tsconfig.json` | 테스트 파일 제외 (`node --test`용 `.ts` 확장자를 tsc가 거부한다) |
| `package.json` | `docx@9.7.1` 추가 |

### 마이그레이션 (전부 DB 적용 완료)

| 파일 | 내용 |
|---|---|
| `20260831130000_fix_archive_week_tagging.sql` | 주차 태깅 A안 (기획서 결정 8) |
| `20260831130100_create_projects_and_issue_note.sql` | `projects`, `tasks.project_id`, `tasks.issue_note`, 팀 일치 트리거, 소급 입력 |
| `20260831130200_create_weekly_reports.sql` | `weekly_reports` + RLS + 집계 RPC |
| `20260831130300_restrict_report_rpc_execution.sql` | 보고서 RPC 권한 잠금 (130200의 함수를 대체한다) |
| `20260831140000_restrict_weekly_report_updatable_columns.sql` | 컬럼 단위 UPDATE 제한 |
| `20260831140100_harden_report_function_search_path.sql` | `SECURITY DEFINER` 함수 `search_path` 고정 |
| `20260831150000_fix_report_write_path_and_concurrency.sql` | 쓰기 경로를 RPC로 전환, 동시성, 프로젝트 팀 변경 차단, 요약 길이 제한 |
| `20260831160000_fix_profile_privilege_escalation.sql` | **관리자 자가 승격 차단 (A안)** |

`130200`의 함수 정의는 `130300`이, 그 `130300`의 `upsert_weekly_report`는 다시 `150000`이 대체한다.
순서대로 적용하면 최종 상태가 맞다. 중간 파일만 보고 판단하지 말 것.

---

## 2. 설계상 알아둘 것

### 집계는 SQL이 아니라 TypeScript에서 한다

`get_weekly_report_source` RPC는 재료(팀·프로필·프로젝트·업무)만 모아 주고, 분류와 집계는 `build-report.ts`가 한다.

이유는 검증 가능성이다. 분류 규칙(기획서 3.3, 4.2, 4.5)이 문서로 확정된 표라서, 읽히는 코드로 두고 그 표를 그대로 테스트로 거는 편이 낫다. 중첩된 SQL `CASE`로는 그게 안 된다.

### 화면과 Word는 같은 payload를 읽는다

집계는 생성 시점에 한 번만 하고 `weekly_reports.payload`에 저장한다. 화면(`ReportView`)과 Word(`docx.ts`)는 그 저장된 값을 읽을 뿐, 각자 다시 계산하지 않는다. 두 산출물이 갈라지지 않는 이유가 이것이다.

지난 주 보고서를 열었을 때 그 주 상태가 나오는 것도 같은 이유다. 라이브 쿼리를 하지 않는다.

### 보고서 쓰기는 전부 RPC를 거친다

`weekly_reports`에 대한 직접 UPDATE 권한은 회수했다. 요약 저장은 `save_weekly_report_summary`, 확정은 `confirm_weekly_report`만 쓴다. 작성자·확정자는 서버가 `auth.uid()`로 박으므로 클라이언트가 위조할 수 없다.

**확정은 단방향이다.** 되돌리는 경로를 두지 않았다. 되돌리기가 필요해지면 admin 전용 함수를 따로 만들어야 한다.

---

## 3. 검증한 것

| 대상 | 방법 | 결과 |
|---|---|---|
| 주차 태깅 A안 | DB 실측 **1054건**(2024-12-25~2027-01-10)과 TS 구현 대조 | 불일치 0건 |
| 집계 규칙 | `node --test src/lib/report/build-report.test.ts` | **20건 통과** |
| 팀 불일치 트리거 | 개발팀 업무에 디자인팀 프로젝트 지정 시도 | 차단 |
| 프로젝트 팀 변경 | 업무가 붙은 프로젝트의 팀 변경 시도 | 차단 |
| 보고서 RPC 권한 | 익명 / member / admin / service_role 4경로 | 앞 둘 차단, 뒤 둘 통과 |
| 확정 보호 | CONFIRMED 상태에서 재생성 호출 | `skipped: true`, payload·요약 보존 |
| RLS 격리 | member(디자인팀) / admin으로 조회 | member는 `TEAM:design` 1건, admin은 4건 전부 |
| 보고서 쓰기 경로 | 직접 UPDATE / 타 팀 / ALL / 확정 후 수정 / 길이 초과 | 전부 차단, 정상 경로만 통과 |
| 관리자 자가 승격 | 이메일+역할 / 역할만 / 이메일만 3가지 시도 | 전부 차단 |
| 온보딩 | 팀 변경, 프로필 upsert, 슈퍼관리자 유지 | 전부 정상 |
| Word 생성 | 저장된 payload로 .docx 생성 후 압축 해제 검사 | `Microsoft Word 2007+`, 규칙 15의 7개 절 확인 |

검증하느라 건드린 데이터는 **전부 원상복구했다.** 현재 DB는 보고서 4건 DRAFT, 프로필 2건 정상이다.

### 검증 명령

```bash
node --test src/lib/report/build-report.test.ts   # 20건
npx tsc --noEmit                                   # 타입
npm run build                                      # 빌드 (lint 포함)
```

`npm run lint`는 이 저장소에 ESLint 설정이 없어 대화형 마법사가 뜬다. 기존 상태다. `npm run build`가 lint와 타입을 함께 본다.

### 엔드투엔드 실행 (2026-08-31)

개발 서버를 띄우고 실제 DB에 예시 데이터를 넣어 파이프라인을 처음부터 끝까지 돌렸다.

```
예시 업무 12건 + 프로젝트 2개 삽입
  -> execute_weekly_archive 실행 (6건 아카이브)
  -> get_weekly_report_source -> build-report.ts -> upsert_weekly_report (보고서 4건)
  -> save_weekly_report_summary / confirm_weekly_report (요약 작성 + 확정)
  -> DB의 payload를 읽어 buildReportDocx로 Word 3종 생성
```

**이 실행으로 처음 확인된 것들이다.**

| 확인 | 결과 |
|---|---|
| 🟢 A안 주차 태깅이 실제로 작동 | 월요일(08-31)에 실행했는데 마감이 `2026-W35`로 찍혔다. 수정 전이면 `2026-W36`이 나왔을 자리다 |
| 🟢 이슈가 완료보다 우선 | "컬러 시스템 확정"은 `DONE`이지만 이슈 내용이 있어 이슈로 잡히고 완료 집계에서 빠졌다 (디자인팀 완료 3이 아니라 2) |
| 🟢 미분류가 사유와 함께 출력 | 기존 업무 2건(마감 불일치) + 담당자 미정 1건이 임의 보정 없이 문서에 실렸다 |
| 🟢 프로젝트 2분류 | 지정된 것은 프로젝트별로, 미지정은 "기타"로 묶였다 |
| 🟢 확정 상태가 문서에 반영 | 개발팀 문서는 `2026-W35 · 확정`, 나머지는 `미확정(초안)` |
| 🟢 Word 3종 생성 | 전부 `Microsoft Word 2007+`. 텍스트 노드 199개, 규칙 15의 7개 절 확인 |

**HTTP 라우트 응답** (개발 서버 `localhost:3001`)

| 요청 | 결과 |
|---|---|
| 인증 없이 Word 요청 | 401 |
| `week=2026-W99` / `2026-W00` | 400 (Codex 지적 7 수정 확인) |
| `scope=TEAM`인데 `team` 누락 | 400 |
| 인증 없이 재생성(POST) | 401 |
| `/report`, `/teams/development/report` | 200 |

🟡 **이 과정에서 버그를 하나 더 잡았다.** 인증 없이 Word를 요청하면 HTTP 500에 `permission denied for table weekly_reports`가 그대로 나갔다. anon 권한을 회수하면서 생긴 부작용이다. 라우트 앞단에서 세션을 먼저 확인해 401을 돌려주고, DB 오류 메시지는 로그로만 남기도록 고쳤다.

🟡 **로그인 상태의 실제 HTTP 다운로드는 하지 않았다.** 문서 내용은 라우트와 같은 코드로 만들었지만, 응답 헤더(한글 파일명 RFC 5987 처리)는 미검증으로 남는다.

산출물: `2026-W35_전체_주간업무보고서.docx`, `2026-W35_개발팀_주간업무보고서.docx`, `2026-W35_디자인팀_주간업무보고서.docx`

---

## 4. Codex 리뷰 (2026-08-31)

구현 후 Codex MCP에 코드 리뷰를 맡겼다(모델은 기본값. 어떤 모델이 돌았는지는 확인하지 않았다). 판정은 **REQUEST CHANGES**, 지적 8건이었다. 전부 재현해보고 조치했다.

| # | 지적 | 재현 | 조치 |
|---|---|---|---|
| 1 | 🔴 일반 member가 스스로 admin이 될 수 있다 | ✅ | `160000` — A안 적용 |
| 2 | 🟡 `execute_weekly_archive`가 anon에게 열려 있다 | ✅ | **미조치** (6절 참조) |
| 3 | 🔴 확정자 위조, `CONFIRMED→DRAFT` 역전 가능 | ✅ | `150000` — 쓰기를 RPC로 전환 |
| 4 | 🔴 아카이브 안 된 `DONE`을 완료로 셌다 | ✅ | `build-report.ts` — 미분류로, 테스트 2건 추가 |
| 5 | 🟡 `upsert`에 잠금이 없어 확정본을 덮을 수 있다 | 논리 | `150000` — `FOR UPDATE` + 충돌 흡수 |
| 6 | 🟡 `projects.team_id` 변경을 트리거가 놓친다 | ✅ | `150000` — 업무 있으면 변경 차단 |
| 7 | 🟢 `W00`/`W99`가 통과한다 | ✅ | `isValidCycleWeek` 추가 |
| 8 | 🟢 요약 길이 무제한 → DOCX 자원 소모 | 논리 | 5000자 CHECK + UI 제한 |

Codex가 "정상"으로 확인해준 것: NULL 처리, `search_path` 강화, TEAM/ALL RLS 조건식, 미분류 중복 없음, 유효 주차의 ISO 계산, `Content-Disposition` CRLF 안전, SQL injection 없음.

### 지적 1이 왜 심각했나

```sql
UPDATE profiles SET email='siltarre@gmail.com', role='admin' WHERE id = auth.uid();
```

이게 통과했다. `profiles.email`에 실제 로그인 계정(`auth.users.email`)과의 일치 제약이 없었고, admin 제한 트리거가 그 문자열만 봤기 때문이다.

**이 기능만의 문제가 아니었다.** `tasks` RLS의 admin 분기, 전체 보고서 열람, 보고서 생성 RPC가 전부 `profiles.role`을 신뢰하므로 함께 무력화됐다. 이번 작업 이전부터 있던 상태이고, 공교롭게도 커밋 `29eaf89`("관리자 권한을 siltarre@gmail.com에 한정")에서 생겼다.

`160000`이 판단 기준을 "프로필에 적힌 이메일"에서 "실제 로그인 계정의 이메일"로 옮겼다. `auth.users`는 사용자가 쓸 수 없는 테이블이라 위조가 불가능하다.

**A안이므로 팀 변경은 그대로 뒀다.** 지금처럼 본인이 소속 팀을 고른다. B안(팀 변경도 관리자만)이 필요해지면 `160000` 안의 주석 블록을 켜면 된다. 온보딩 흐름이 바뀌므로 결정이 먼저다.

---

## 5. 구현 중 발견한 기획서 결함

기획서 9절에 같은 내용이 있다. 요약하면 셋이다.

1. **4.4의 `UNIQUE (cycle_week, scope, team_id)`는 동작하지 않는다.** Postgres는 UNIQUE에서 NULL을 서로 다른 값으로 본다. `scope='ALL'` 행이 한 주차에 여러 개 생길 수 있어 부분 유니크 인덱스 2개 + CHECK로 대체했다.
2. **집계 RPC가 anon에게 열려 있었다.** `SECURITY DEFINER`라 RLS를 우회하는데 Postgres 기본값이 PUBLIC 실행 허용이다. 공개 anon 키만으로 전 팀 업무를 읽을 수 있었다.
3. **그 권한 가드가 처음엔 열린 채로 실패했다.** `auth.role()`이 NULL이면 조건 전체가 NULL이 되고 `IF NOT NULL THEN`은 본문을 실행하지 않는다. 익명 호출을 실제로 밟아보고 잡았다.

---

## 6. 아직 안 끝난 것

### 🔴 cron 자동 생성이 지금은 동작하지 않는다

`SUPABASE_SERVICE_ROLE_KEY` 환경변수가 필요한데 설정돼 있지 않다.

cron은 사용자 세션이 없어 RLS도 통과 못 하고, 보고서 RPC의 EXECUTE 권한도 없다(anon에서 회수했다). 그래서 service role 클라이언트가 필요하다.

**현재 동작**: 마감은 정상 실행된다. 보고서 생성만 건너뛰고 그 사유를 응답(`report_skipped_reason`)과 서버 로그에 남긴다. 조용히 실패하지는 않는다.

키를 넣기 전까지 유일한 생성 경로는 **관리자의 "재생성" 버튼**이다.

설정 위치: Vercel 프로젝트 환경변수 + 로컬 `.env.local`. 값은 Supabase 대시보드 > Project Settings > API > `service_role` secret.

### 🟡 기존 함수 3개가 anon에게 열려 있다

Supabase 데이터베이스 린터가 잡아낸 것이다. **이번 작업 이전부터 있던 상태라 손대지 않았다.**

| 함수 | 위험 |
|---|---|
| `execute_weekly_archive` | 공개 키만으로 주간 마감을 실행할 수 있다 |
| `rollback_weekly_archive` | 공개 키만으로 마감을 롤백할 수 있다 |
| `restore_archived_task` | 공개 키만으로 개별 업무를 복구할 수 있다 |
| `get_dashboard_summary_stats`, `check_profile_admin_role` | anon 실행 가능 |

잠그면 현재 cron 라우트(anon 키 사용)가 함께 막힌다. **위 service role 전환과 묶어서 처리해야 한다.** 순서는 service role 설정 → cron 라우트를 service role로 전환 → anon 권한 회수다.

### 🟡 첫 cron 자동 실행이 아직 관측되지 않았다

2026-08-31 00:00 UTC 예정이던 실행에 흔적이 없다. **원인은 밝혀졌다** — cron 스케줄을 처음 추가한 커밋 `0c1a444`가 그날 10:39 UTC였다. 예정 시각보다 10시간 40분 늦었으니 실행될 수 없었다. 버그가 아니다.

`0c1a444`는 `main`에 있고 `vercel.json`과 cron 라우트도 main에 있다. 배포가 정상이라면 **첫 자동 실행은 2026-09-07 00:00 UTC**다. 그 이후 `weekly_archive_logs`에 `executed_by IS NULL` 행이 생기는지가 최종 확인이다.

Vercel 대시보드에서 cron이 실제 등록됐는지는 **보지 않았다.**

### 🟢 브라우저 확인 — 완료 (2026-08-31)

로그인한 상태로 `/report`와 `/teams/development/report`를 실제 브라우저에서 열어 눌러봤다.
목록 렌더링, 행 클릭, 모달 표시, 모달 내부 스크롤, ESC·바깥 클릭 닫기, `?week=` 딥링크 진입,
키보드 Enter로 열기, 확정/미확정 배지 구분까지 확인했다. 콘솔 에러는 없었다.

**아직 안 본 것 둘이 남는다.**

- **Word 내려받기 버튼을 실제로 누르지 않았다.** 응답 헤더의 한글 파일명(RFC 5987) 처리는 여전히 미검증이다.
- **요약 저장·확정 버튼을 실제로 누르지 않았다.** 확정은 되돌릴 수 없어서 실데이터로 밟지 않았다.
  RPC 호출 코드는 개편 전과 동일하고 개편 전 경로는 DB 레벨에서 검증돼 있다(3절).

### 🟡 보고서가 여러 주차 쌓인 화면을 못 봤다

DB에 `2026-W35` 한 주차뿐이라 목록에 항상 1건만 뜬다.
정렬(`cycle_week` 내림차순)과 여러 행이 쌓인 모습은 **코드로만 확인했고 화면으로는 못 봤다.**
다음 주차 보고서가 생기면 자연히 드러난다. 급하면 임시 행을 넣어 확인하고 지우면 된다.

---

## 7. 현재 데이터 상태 (2026-08-31 기준)

프로젝트 `pbjxzfuouzjvkjjwlgnl`.

🟡 **엔드투엔드 테스트용 예시 데이터가 그대로 남아 있다.** 지우지 않기로 했다(화면에서 확인하기 위해서다).
아래 건수는 원래 데이터 + 테스트 데이터가 섞인 값이다.

| 테이블 | 현재 | 원래 (테스트 전) |
|---|---|---|
| `tasks` | 14건 (아카이브 6, 이슈 2) | 2건 |
| `projects` | 4건 | 2건 |
| `weekly_reports` | 4건 (CONFIRMED 1, DRAFT 3) | 4건 (전부 DRAFT, 집계 0) |
| `weekly_archive_logs` | 2건 | 1건 |
| `profiles` | 2건 — 실타래(development/admin), 김드림(design/member) | 동일 |

프로젝트 4건: 브랜드 리뉴얼(design), 주간업무 대시보드(design), 사내 위키 개편(development), 주간업무 대시보드(development).

**원래 업무 2건은 그대로 있다.** `supabase 연결하기`(개발팀), `와이어프레임 작업`(디자인팀). 둘 다 `cycle_week`이 W35인데 아카이브되지 않은 상태라 보고서에서 미분류로 잡힌다. 기획서 결정 1과 4.5대로다.

### 테스트 데이터를 지우려면

원래 상태로 되돌리는 기준값이다.

```sql
-- 남길 업무 2건 (이 둘만 남기고 나머지는 테스트용)
--   913a32f3-b14e-45d7-9d56-c0d72c7cbb47  supabase 연결하기
--   b79aec1e-8666-416f-a14a-a9dbda4529b6  와이어프레임 작업
DELETE FROM public.tasks
 WHERE id NOT IN ('913a32f3-b14e-45d7-9d56-c0d72c7cbb47',
                  'b79aec1e-8666-416f-a14a-a9dbda4529b6');

-- 남길 프로젝트 2건 (소급 입력분)
DELETE FROM public.projects
 WHERE id NOT IN ('84f421a5-6c61-4d5a-ae9d-ae5e9469b775',
                  '5a732598-7576-4e63-8b3a-6c90ba91506c');

-- 테스트로 생긴 마감 로그 (batch_id 97ff4141-603b-49e1-96ae-c9b071ac3855)
DELETE FROM public.weekly_archive_logs
 WHERE id = '97ff4141-603b-49e1-96ae-c9b071ac3855';

-- 보고서는 관리자 화면의 "재생성" 버튼으로 다시 만들면 된다.
-- 단 개발팀 보고서는 CONFIRMED라 재생성이 건너뛴다. 필요하면 먼저 DRAFT로 되돌려야 하는데,
-- 되돌리는 RPC를 두지 않았으므로 DB에서 직접 status를 바꿔야 한다.
```

⚠ `projects` 삭제는 `tasks.project_id`가 `ON DELETE SET NULL`이라 업무가 지워지지는 않는다.
다만 프로젝트에 업무가 붙어 있으면 팀 변경은 트리거가 막는다(삭제는 막지 않는다).

---

## 8. 함정 (넘겨받는 사람용)

- **`cycle_week`만으로 완료 건을 세면 안 된다.** 반드시 `is_archived`와 함께 볼 것 (기획서 4.2)
- **`status='DONE'`이어도 아카이브 전이면 완료가 아니다.** Codex 지적 4번이 이것이었다. 마감 전 수동 재생성에서 실제로 나온다
- **보고서는 마감 이후에 생성해야 한다.** 마감 전에 만들면 완료가 0건으로 나온다
- **기획팀에 소속 프로필이 0명이다.** 제출 현황에서 팀 전체가 걸린다. 버그가 아니라 데이터 상태다
- **주중에 해소된 이슈는 보고서에 안 남는다.** 보고서는 마감 시점 스냅샷이다 (결정 6의 알려진 한계)
- **`weekly_reports`를 직접 UPDATE하면 실패한다.** 권한을 회수했다. RPC를 쓸 것
- **확정은 되돌릴 수 없다.** 되돌리기가 필요하면 admin 전용 함수를 새로 만들어야 한다
- **목록 행처럼 `div`에 `onClick`만 다는 패턴을 쓰지 말 것.** 키보드로 도달조차 못 한다. `role="button"` + `tabIndex` + `onKeyDown`이 같이 가야 한다
- **테스트 파일은 `.ts` 확장자로 import한다.** `node --test`가 요구하는 형식이고 tsc는 거부하므로 `tsconfig.json`에서 제외했다. 이 구조를 바꾸면 둘 중 하나가 깨진다

---

## 9. 다음에 할 일 (권장 순서)

1. **`SUPABASE_SERVICE_ROLE_KEY`를 설정한다.** 이게 있어야 cron 자동 생성이 동작한다 (6절)
2. **cron 라우트를 service role로 전환하고, 기존 함수 3개의 anon 권한을 회수한다** (6절)
3. **2026-09-07 이후 첫 자동 실행을 확인한다.** 그때 두 번째 주차가 생기므로
   목록이 여러 행으로 쌓인 화면도 이때 같이 본다 (6절)
4. **Word 내려받기와 요약 저장·확정을 브라우저에서 한 번 눌러본다** (6절)
5. 필요해지면 **테스트 데이터를 정리한다** (7절에 SQL 있음)

2차 범위(기획서 6절)는 인쇄용 PDF와 반복 이슈 자동 판정이다. 반복 이슈 판정은 `markRepeatedIssues`로 이미 구현돼 화면과 Word에 "반복/신규"로 표시된다. 남은 것은 인쇄 CSS뿐이다.
