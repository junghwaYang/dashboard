# 📊 업무현황 대시보드 (Task & Operations Dashboard)

> 팀 및 개인의 프로젝트 진행 상황, 업무 상태, 주요 지표(KPI/OKR)를 한눈에 파악하고 효율적으로 관리할 수 있는 업무현황 대시보드 웹 애플리케이션입니다.

---

## 🎯 프로젝트 개요

- **프로젝트명**: 업무현황 대시보드 (Workspace Dashboard)
- **목적**:
  - 분산된 업무 데이터(작업 진행률, 마감일, 우선순위, 담당자 등)를 통합 시각화
  - 팀/프로젝트 단위의 병목 현상 조기 발견 및 리소스 최적화
  - 직관적인 UI/UX를 통한 실시간 업무 트래킹 및 커뮤니케이션 강화

---

## 🚀 주요 기능 (기획 예정)

### 1. 종합 개요 대시보드 (Overview)
- **요약 카드 (KPI Widget)**: 전체 진행률, 오늘 마감 업무, 지연 업무, 완료율 요약
- **상태별/우선순위별 차트**: 진행 중, 대기, 완료, 긴급 등 상태별 통계 시각화
- **최근 활동 로그 (Activity Feed)**: 팀원들의 상태 변경, 댓글, 신규 등록 내역 실시간 표시

### 2. 업무 관리 및 트래킹 (Task Management)
- **다양한 뷰 모드**:
  - 📋 **칸반 보드 (Kanban Board)**: 드래그 앤 드롭을 통한 상태(To-do, In-Progress, Review, Done) 관리
  - 📅 **캘린더/간트차트 (Calendar & Timeline)**: 일정 기반 일정/마감일 관리
  - 📑 **테이블/리스트 뷰 (List/Table View)**: 필터링, 정렬, 일괄 수정 지원
- **업무 상세 모달/페이지**: 태스크 생성/수정, 하위 태스크(Checklist), 담당자 할당, 첨부파일

### 3. 프로젝트 및 팀 관리 (Projects & Teams)
- 프로젝트별 진행 상황 및 마일스톤 관리
- 팀원별 업무 부하량(Workload) 및 리소스 분배 현황

### 4. 알림 및 필터링
- 중요 마감일 알림, 상태 변경 알림
- 담당자, 태그, 상태, 프로젝트별 커스텀 필터 및 검색

---

## 🛠 추천 기술 스택 (예시)

| 구분 | 기술 스택 | 설명 |
| :--- | :--- | :--- |
| **Frontend** | React (Next.js / Vite), TypeScript | 모던 웹 UI 개발 및 타입 안정성 확보 |
| **Styling** | Tailwind CSS, shadcn/ui, Lucide Icons | 빠르고 완성도 높은 대시보드 디자인 구성 |
| **State / Data** | TanStack Query, Zustand | 상태 관리 및 서버 데이터 캐싱 |
| **Visualization** | Recharts, Tremor | 직관적인 데이터 시각화 및 차트 라이브러리 |
| **Backend / DB** | Next.js API Routes / Node.js, PostgreSQL / Supabase | RESTful API 및 데이터 영속화 |

---

## 📂 프로젝트 구조 (예시)

```text
dashboard/
├── public/                 # 정적 리소스 (아이콘, 이미지 등)
├── src/
│   ├── components/         # 공통 UI 및 위젯 컴포넌트
│   │   ├── common/         # Button, Modal, Card 등 기본 UI
│   │   ├── dashboard/      # KPI Card, Chart Widget, Activity Feed
│   │   └── kanban/         # Kanban Column, Task Card 등
│   ├── hooks/              # 커스텀 훅 (비즈니스 로직 및 상태)
│   ├── pages / app/        # 라우트 및 페이지 컴포넌트
│   ├── services / api/     # API 통신 로직
│   ├── types/              # TypeScript 타입 정의 (kebab-case)
│   └── utils/              # 유틸리티 함수
└── README.md
```

---

## 📝 향후 진행 단계

1. **상세 요구사항 정의 및 와이어프레임 설계** (화면 레이아웃 & 사용자 시나리오)
2. **데이터 모델링 및 API 명세 정의** (Task, Project, User 엔티티)
3. **핵심 컴포넌트 및 기본 레이아웃 구현**
4. **상태 관리 및 데이터 시각화(차트/칸반) 연동**
