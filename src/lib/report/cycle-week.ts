/**
 * 주차 키 계산 (기획서 4.1, 4.2)
 *
 * DB의 TO_CHAR(TIMEZONE('utc', NOW()) - INTERVAL '1 day', 'IYYY-"W"IW')와
 * 같은 결과를 내야 한다. 두 구현이 어긋나면 보고서가 엉뚱한 주차로 저장된다.
 * build-report.test.ts가 DB에서 뽑은 실측값으로 이 함수를 검증한다.
 *
 * 의존성이 없는 순수 함수로 따로 둔 이유가 그 검증이다. 별도 실행기 없이 돌려야 한다.
 */

/**
 * 주차 키 형식 검증. 형식만 맞고 값이 틀린 것(W00, W99)을 걸러낸다.
 * ISO 8601 주차는 1~53이다. 53주가 없는 해에 W53을 넣는 것까지는 막지 않는다 —
 * 그 경우 조회 결과가 비는 것으로 드러난다.
 */
export function isValidCycleWeek(value: string | null | undefined): value is string {
  if (!value) return false;
  const m = value.match(/^\d{4}-W(\d{2})$/);
  if (!m) return false;
  const week = Number(m[1]);
  return week >= 1 && week <= 53;
}

/** ISO 8601 주차 키. 예: '2026-W35' */
export function isoWeekKey(date: Date): string {
  // ISO 8601: 목요일이 속한 해가 그 주의 해다
  const target = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
  const dayNum = (target.getUTCDay() + 6) % 7; // 월=0 .. 일=6
  target.setUTCDate(target.getUTCDate() - dayNum + 3); // 그 주의 목요일

  const isoYear = target.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);

  const week =
    1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000));
  return `${isoYear}-W${String(week).padStart(2, '0')}`;
}

/**
 * 마감 대상 주차. UTC 기준 전날로 계산한다.
 * 월요일 00:00 UTC에 cron이 돌아도 지난 주로 잡힌다 (4.2 A안).
 */
export function currentCycleWeek(now: Date = new Date()): string {
  return isoWeekKey(new Date(now.getTime() - 24 * 60 * 60 * 1000));
}

/** 직전 주차. 반복 이슈 판정(규칙 10)에 쓴다. */
export function previousCycleWeek(cycleWeek: string): string {
  const m = cycleWeek.match(/^(\d{4})-W(\d{2})$/);
  if (!m) return cycleWeek;
  const year = Number(m[1]);
  const week = Number(m[2]);
  if (week > 1) return `${year}-W${String(week - 1).padStart(2, '0')}`;
  // 1주차의 이전 주는 작년 마지막 주다. 52인지 53인지 단정할 수 없으므로
  // 12월 28일이 속한 주를 쓴다. ISO 8601상 12월 28일은 반드시 그 해 마지막 주에 있다.
  return isoWeekKey(new Date(Date.UTC(year - 1, 11, 28)));
}

/**
 * 다음 주차. 그 주의 목요일에 7일을 더해 다시 주차를 구한다.
 * 52주인지 53주인지 직접 판단하지 않기 위해서다.
 */
export function nextCycleWeek(cycleWeek: string): string {
  const m = cycleWeek.match(/^(\d{4})-W(\d{2})$/);
  if (!m) return cycleWeek;
  const jan4 = new Date(Date.UTC(Number(m[1]), 0, 4));
  const dayNum = (jan4.getUTCDay() + 6) % 7;
  const week1Thursday = new Date(jan4.getTime() + (3 - dayNum) * 86400000);
  const thisThursday = new Date(week1Thursday.getTime() + (Number(m[2]) - 1) * 7 * 86400000);
  return isoWeekKey(new Date(thisThursday.getTime() + 7 * 86400000));
}
