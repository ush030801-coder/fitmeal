// Design Ref: PRD 5번 Must 1 — 하루는 사용자 기기 시간 기준 00:00~24:00로 계산한다
// 날짜는 "YYYY-MM-DD" 문자열(기기 시간대 기준)로 다루고, 문자열 비교만으로 앞뒤를 가릴 수 있다.

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

// 기기 시간 기준의 날짜 키. 자정(00:00)이 지나면 다음 날 키가 된다.
export function getDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// "YYYY-MM-DD" 모양이고 실제로 있는 날짜인지 확인한다 (예: 2026-02-30은 거짓)
export function isDateKey(value: string): boolean {
  if (!DATE_KEY_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return getDateKey(date) === value;
}

// 날짜 키에서 며칠을 더하거나 뺀다 (달·연도·윤년 경계도 알아서 처리)
export function addDays(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return getDateKey(new Date(year, month - 1, day + days));
}

// "2026-03-03" → "3/3(화)" (날짜 키 자체로 요일을 구한다)
export function formatDateLabel(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const weekday = ["일", "월", "화", "수", "목", "금", "토"][new Date(year, month - 1, day).getDay()];
  return `${month}/${day}(${weekday})`;
}
