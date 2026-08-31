'use client';

import React from 'react';
import Link from 'next/link';
import type { ReportPayload, TeamReportSection, ReportTaskLine } from '@/types/report';

/**
 * 주간 보고서 화면 렌더러 (기획서 5.1, 5.3)
 *
 * 문서 순서는 규칙 15로 고정한다. Word 생성(lib/report/docx.ts)과 같은 순서다.
 *   이번 주 요약 -> 제출 현황 -> 상태별 요약 -> 이슈 상세
 *   -> 팀원별 건수 -> 프로젝트별 묶음 -> 미분류 항목
 *
 * 집계를 여기서 하지 않는다. 저장된 payload를 그대로 읽는다.
 * 그래야 지난 주 보고서를 열었을 때 오늘 상태가 아니라 그 주 상태가 나온다.
 */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2.5">
      <h3 className="text-sm font-bold text-foreground border-b border-border/80 pb-1.5">{title}</h3>
      {children}
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-xs text-muted-foreground py-1">{text}</p>;
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`px-3 py-2 text-left font-semibold text-muted-foreground ${className}`}>
      {children}
    </th>
  );
}

function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 align-top text-foreground ${className}`}>{children}</td>;
}

function Table({ children }: { children: React.ReactNode }) {
  // 좁은 화면에서 표만 가로로 스크롤된다. 페이지 자체는 가로 스크롤되지 않는다.
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-xs border-collapse">{children}</table>
    </div>
  );
}

/** 출처 표시 (규칙 7). 수기 절차의 `파일명:줄번호`를 task 상세 링크가 대체한다. */
function TaskTitle({ line, teamId }: { line: ReportTaskLine; teamId: string }) {
  return (
    <Link
      href={`/teams/${teamId}?task=${line.task_id}`}
      className="text-foreground hover:text-primary hover:underline"
      title="업무 상세로 이동"
    >
      {line.title}
    </Link>
  );
}

function CountBadges({ counts }: { counts: { done: number; in_progress: number; issue: number; total: number } }) {
  const items = [
    { label: '완료', value: counts.done, cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    { label: '진행중', value: counts.in_progress, cls: 'bg-blue-50 text-blue-700 border-blue-200' },
    { label: '이슈', value: counts.issue, cls: 'bg-red-50 text-red-700 border-red-200' },
    { label: '합계', value: counts.total, cls: 'bg-secondary text-secondary-foreground border-border' },
  ];
  return (
    <div className="grid grid-cols-4 gap-2">
      {items.map((i) => (
        <div key={i.label} className={`rounded-xl border px-3 py-2.5 ${i.cls}`}>
          <div className="text-[10px] font-semibold opacity-80">{i.label}</div>
          <div className="text-lg font-black leading-tight">{i.value}</div>
        </div>
      ))}
    </div>
  );
}

function TaskTable({ lines, teamId }: { lines: ReportTaskLine[]; teamId: string }) {
  return (
    <Table>
      <thead className="bg-secondary/60">
        <tr>
          <Th className="w-24">담당자</Th>
          <Th>업무</Th>
          <Th className="w-40">프로젝트</Th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {lines.map((l) => (
          <tr key={l.task_id}>
            <Td className="whitespace-nowrap">{l.assignee}</Td>
            <Td><TaskTitle line={l} teamId={teamId} /></Td>
            <Td className="text-muted-foreground">{l.project_name ?? '기타'}</Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

function TeamSection({
  section,
  repeatedIssueIds,
  showTeamHeading,
}: {
  section: TeamReportSection;
  repeatedIssueIds: Set<string>;
  showTeamHeading: boolean;
}) {
  return (
    <div className="space-y-6">
      {showTeamHeading && (
        <h2 className="text-base font-black text-foreground tracking-tight pt-2">
          {section.team_name}
        </h2>
      )}

      {/* 2. 제출 현황 (규칙 4) */}
      <Section title="제출 현황">
        {section.submission.total_members === 0 ? (
          <Empty text="소속 프로필이 없다. 제출 현황을 집계할 수 없다." />
        ) : section.submission.no_task_members.length === 0 ? (
          <p className="text-xs text-foreground">
            팀원 {section.submission.total_members}명. 전원 업무가 있다.
          </p>
        ) : (
          <p className="text-xs text-foreground">
            팀원 {section.submission.total_members}명.{' '}
            <span className="text-amber-700 font-semibold">
              업무 없음: {section.submission.no_task_members.join(', ')}
            </span>
          </p>
        )}
      </Section>

      {/* 3. 상태별 요약 (규칙 1, 11) */}
      <Section title="상태별 요약">
        <CountBadges counts={section.counts} />
        {section.done.length > 0 && (
          <div className="pt-2 space-y-1.5">
            <div className="text-xs font-semibold text-muted-foreground">완료</div>
            <TaskTable lines={section.done} teamId={section.team_id} />
          </div>
        )}
        {section.in_progress.length > 0 && (
          <div className="pt-2 space-y-1.5">
            <div className="text-xs font-semibold text-muted-foreground">진행중</div>
            <TaskTable lines={section.in_progress} teamId={section.team_id} />
          </div>
        )}
        {section.counts.total === 0 && <Empty text="집계 대상 업무가 없다." />}
      </Section>

      {/* 4. 이슈 상세 (규칙 9, 10) */}
      <Section title="이슈 상세">
        {section.issues.length === 0 ? (
          <Empty text="이슈 없음." />
        ) : (
          <Table>
            <thead className="bg-secondary/60">
              <tr>
                <Th className="w-16">구분</Th>
                <Th className="w-24">담당자</Th>
                <Th>업무</Th>
                <Th>막힌 내용</Th>
                <Th className="w-32">프로젝트</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {section.issues.map((i) => {
                const repeated = repeatedIssueIds.has(i.task_id);
                return (
                  <tr key={i.task_id}>
                    <Td>
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          repeated
                            ? 'bg-red-50 text-red-700 border-red-200'
                            : 'bg-secondary text-secondary-foreground border-border'
                        }`}
                      >
                        {repeated ? '반복' : '신규'}
                      </span>
                    </Td>
                    <Td className="whitespace-nowrap">{i.assignee}</Td>
                    <Td><TaskTitle line={i} teamId={section.team_id} /></Td>
                    <Td className="text-muted-foreground">{i.issue_note}</Td>
                    <Td className="text-muted-foreground">{i.project_name ?? '기타'}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Section>

      {/* 5. 팀원별 건수 (규칙 11) */}
      <Section title="팀원별 건수">
        {section.by_member.length === 0 ? (
          <Empty text="소속 팀원이 없다." />
        ) : (
          <Table>
            <thead className="bg-secondary/60">
              <tr>
                <Th>팀원</Th>
                <Th className="w-20">완료</Th>
                <Th className="w-20">진행중</Th>
                <Th className="w-20">이슈</Th>
                <Th className="w-20">합계</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {section.by_member.map((m) => (
                <tr key={m.profile_id}>
                  <Td className="font-medium">{m.name}</Td>
                  <Td>{m.done}</Td>
                  <Td>{m.in_progress}</Td>
                  <Td className={m.issue > 0 ? 'text-red-700 font-semibold' : ''}>{m.issue}</Td>
                  <Td className="font-semibold">{m.total}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Section>

      {/* 6. 프로젝트별 묶음 (규칙 12). 확정 / 기타 2분류다. */}
      <Section title="프로젝트별 묶음">
        {section.by_project.length === 0 ? (
          <Empty text="집계 대상 업무가 없다." />
        ) : (
          <Table>
            <thead className="bg-secondary/60">
              <tr>
                <Th>프로젝트</Th>
                <Th className="w-20">완료</Th>
                <Th className="w-20">진행중</Th>
                <Th className="w-20">이슈</Th>
                <Th className="w-20">합계</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {section.by_project.map((g) => (
                <tr key={g.project_id ?? '__etc__'}>
                  <Td className={g.project_id === null ? 'text-muted-foreground' : 'font-medium'}>
                    {g.project_name}
                  </Td>
                  <Td>{g.done}</Td>
                  <Td>{g.in_progress}</Td>
                  <Td className={g.issue > 0 ? 'text-red-700 font-semibold' : ''}>{g.issue}</Td>
                  <Td className="font-semibold">{g.total}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Section>

      {/* 7. 미분류 항목 (기획서 4.5). 사유를 함께 표시하고 임의로 보정하지 않는다. */}
      <Section title="미분류 항목">
        {section.unclassified.length === 0 ? (
          <Empty text="없음." />
        ) : (
          <Table>
            <thead className="bg-secondary/60">
              <tr>
                <Th className="w-1/3">업무</Th>
                <Th>사유</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {section.unclassified.map((u) => (
                <tr key={u.task_id}>
                  <Td>{u.title}</Td>
                  <Td className="text-amber-700">{u.reason}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Section>
    </div>
  );
}

export function ReportView({
  payload,
  summaryText,
  repeatedIssueIds,
}: {
  payload: ReportPayload;
  summaryText: string | null;
  repeatedIssueIds: Set<string>;
}) {
  return (
    <div className="space-y-8">
      {/* 1. 이번 주 요약 — 사람이 직접 쓴다 (결정 4). AI 초안 배지를 쓰지 않는다. */}
      <Section title="이번 주 요약">
        {summaryText && summaryText.trim() !== '' ? (
          <div className="text-xs text-foreground leading-relaxed whitespace-pre-wrap rounded-xl border border-border bg-secondary/30 p-3.5">
            {summaryText}
          </div>
        ) : (
          <Empty text="요약 미작성." />
        )}
      </Section>

      {/* 전체 보고서는 팀 축이 하나 더 붙는다 (기획서 5.2) */}
      {payload.scope === 'ALL' && (
        <Section title="전체 합계">
          <CountBadges counts={payload.totals} />
          <p className="text-[11px] text-muted-foreground pt-1">
            프로젝트는 팀에 속한다. 팀이 달라도 이름이 같은 프로젝트는 합치지 않는다.
          </p>
        </Section>
      )}

      {payload.sections.map((s) => (
        <TeamSection
          key={s.team_id}
          section={s}
          repeatedIssueIds={repeatedIssueIds}
          showTeamHeading={payload.scope === 'ALL'}
        />
      ))}
    </div>
  );
}
