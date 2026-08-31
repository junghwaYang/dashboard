import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
} from 'docx';
import type { ReportPayload, TeamReportSection, ReportTaskLine } from '@/types/report';

/**
 * 주간 보고서 Word(.docx) 생성
 *
 * 문서 순서는 규칙 15로 고정돼 있다. 화면(ReportView)과 같은 순서를 쓴다.
 *   이번 주 요약 -> 제출 현황 -> 상태별 요약 -> 이슈 상세
 *   -> 팀원별 건수 -> 프로젝트별 묶음 -> 미분류 항목
 *
 * 두 렌더러가 같은 payload를 읽는다. 집계를 여기서 다시 하지 않는다.
 */

const FONT = '맑은 고딕';

function h(text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel]) {
  return new Paragraph({ text, heading: level, spacing: { before: 240, after: 120 } });
}

function p(text: string, opts: { bold?: boolean; italics?: boolean } = {}) {
  return new Paragraph({
    children: [new TextRun({ text, bold: opts.bold, italics: opts.italics })],
    spacing: { after: 80 },
  });
}

function cell(text: string, opts: { bold?: boolean; width?: number } = {}) {
  return new TableCell({
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: [
      new Paragraph({
        children: [new TextRun({ text: text || '-', bold: opts.bold, size: 18 })],
      }),
    ],
  });
}

function table(headers: string[], rows: string[][], widths?: number[]) {
  const border = { style: BorderStyle.SINGLE, size: 1, color: 'BFBFBF' };
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: border, bottom: border, left: border, right: border,
               insideHorizontal: border, insideVertical: border },
    rows: [
      new TableRow({
        tableHeader: true,
        children: headers.map((x, i) => cell(x, { bold: true, width: widths?.[i] })),
      }),
      ...rows.map((r) => new TableRow({ children: r.map((x, i) => cell(x, { width: widths?.[i] })) })),
    ],
  });
}

/** 이슈 표 (규칙 9). 담당자·막힌 내용을 반드시 함께 낸다. */
function issueRows(issues: ReportTaskLine[], repeated: Set<string>): string[][] {
  return issues.map((i) => [
    repeated.has(i.task_id) ? '반복' : '신규',
    i.assignee,
    i.title,
    i.issue_note ?? '',
    i.project_name ?? '기타',
  ]);
}

function taskLines(lines: ReportTaskLine[]): string[][] {
  return lines.map((t) => [t.assignee, t.title, t.project_name ?? '기타']);
}

function buildSection(
  section: TeamReportSection,
  repeated: Set<string>,
  withTeamHeading: boolean
): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];

  if (withTeamHeading) out.push(h(section.team_name, HeadingLevel.HEADING_1));

  // 2. 제출 현황 (규칙 4)
  out.push(h('제출 현황', HeadingLevel.HEADING_2));
  out.push(p(`팀원 ${section.submission.total_members}명.`));
  if (section.submission.total_members === 0) {
    out.push(p('소속 프로필이 없다. 제출 현황을 집계할 수 없다.'));
  } else if (section.submission.no_task_members.length === 0) {
    out.push(p('전원 업무가 있다.'));
  } else {
    out.push(p(`업무 없음: ${section.submission.no_task_members.join(', ')}`));
  }

  // 3. 상태별 요약 (규칙 1, 11)
  out.push(h('상태별 요약', HeadingLevel.HEADING_2));
  out.push(
    table(
      ['완료', '진행중', '이슈', '합계'],
      [[
        String(section.counts.done),
        String(section.counts.in_progress),
        String(section.counts.issue),
        String(section.counts.total),
      ]],
      [25, 25, 25, 25]
    )
  );

  if (section.done.length > 0) {
    out.push(h('완료', HeadingLevel.HEADING_3));
    out.push(table(['담당자', '업무', '프로젝트'], taskLines(section.done), [18, 52, 30]));
  }
  if (section.in_progress.length > 0) {
    out.push(h('진행중', HeadingLevel.HEADING_3));
    out.push(table(['담당자', '업무', '프로젝트'], taskLines(section.in_progress), [18, 52, 30]));
  }

  // 4. 이슈 상세 (규칙 9, 10)
  out.push(h('이슈 상세', HeadingLevel.HEADING_2));
  if (section.issues.length === 0) {
    out.push(p('이슈 없음.'));
  } else {
    out.push(
      table(
        ['구분', '담당자', '업무', '막힌 내용', '프로젝트'],
        issueRows(section.issues, repeated),
        [10, 15, 25, 32, 18]
      )
    );
  }

  // 5. 팀원별 건수 (규칙 11)
  out.push(h('팀원별 건수', HeadingLevel.HEADING_2));
  if (section.by_member.length === 0) {
    out.push(p('소속 팀원이 없다.'));
  } else {
    out.push(
      table(
        ['팀원', '완료', '진행중', '이슈', '합계'],
        section.by_member.map((m) => [
          m.name, String(m.done), String(m.in_progress), String(m.issue), String(m.total),
        ]),
        [32, 17, 17, 17, 17]
      )
    );
  }

  // 6. 프로젝트별 묶음 (규칙 12). 확정 / 기타 2분류다.
  out.push(h('프로젝트별 묶음', HeadingLevel.HEADING_2));
  if (section.by_project.length === 0) {
    out.push(p('집계 대상 업무가 없다.'));
  } else {
    out.push(
      table(
        ['프로젝트', '완료', '진행중', '이슈', '합계'],
        section.by_project.map((g) => [
          g.project_name, String(g.done), String(g.in_progress), String(g.issue), String(g.total),
        ]),
        [32, 17, 17, 17, 17]
      )
    );
  }

  // 7. 미분류 항목 (기획서 4.5). 사유를 함께 표시하고 임의로 보정하지 않는다.
  out.push(h('미분류 항목', HeadingLevel.HEADING_2));
  if (section.unclassified.length === 0) {
    out.push(p('없음.'));
  } else {
    out.push(table(['업무', '사유'], section.unclassified.map((u) => [u.title, u.reason]), [40, 60]));
  }

  return out;
}

export interface DocxInput {
  payload: ReportPayload;
  summaryText: string | null;
  status: 'DRAFT' | 'CONFIRMED';
  /** 반복 이슈로 판정된 task id (규칙 10) */
  repeatedIssueIds: Set<string>;
  title: string;
}

export async function buildReportDocx(input: DocxInput): Promise<Buffer> {
  const { payload, summaryText, status, repeatedIssueIds, title } = input;

  const children: (Paragraph | Table)[] = [
    new Paragraph({
      children: [new TextRun({ text: title, bold: true, size: 36 })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `${payload.cycle_week}    ·    ${status === 'CONFIRMED' ? '확정' : '미확정(초안)'}`,
          size: 20,
          color: '666666',
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 320 },
    }),

    // 1. 이번 주 요약 — 사람이 직접 쓴다 (결정 4). AI 초안 배지를 쓰지 않는다.
    h('이번 주 요약', HeadingLevel.HEADING_2),
  ];

  if (summaryText && summaryText.trim() !== '') {
    for (const line of summaryText.split('\n')) children.push(p(line));
  } else {
    children.push(p('요약 미작성.', { italics: true }));
  }

  // 전체 보고서는 팀 축이 하나 더 붙는다 (기획서 5.2).
  // 팀이 달라도 이름이 같은 프로젝트는 합치지 않는다 (결정 7).
  if (payload.scope === 'ALL') {
    children.push(h('전체 합계', HeadingLevel.HEADING_2));
    children.push(
      table(
        ['완료', '진행중', '이슈', '합계'],
        [[
          String(payload.totals.done),
          String(payload.totals.in_progress),
          String(payload.totals.issue),
          String(payload.totals.total),
        ]],
        [25, 25, 25, 25]
      )
    );
  }

  for (const section of payload.sections) {
    children.push(...buildSection(section, repeatedIssueIds, payload.scope === 'ALL'));
  }

  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: FONT, size: 20 } },
        heading1: { run: { font: FONT, size: 28, bold: true, color: '111111' } },
        heading2: { run: { font: FONT, size: 24, bold: true, color: '111111' } },
        heading3: { run: { font: FONT, size: 22, bold: true, color: '444444' } },
      },
    },
    sections: [{ children }],
  });

  return Packer.toBuffer(doc);
}
