// Design Ref: §5.3 화면 목록 — 주간 요약(/weekly): 최근 7일 소모·섭취 칼로리 합계
// Plan SC: PRD Nice 1 — 주간 합계는 저장된 일별 정수값의 합이고, 일별 기록의 합과 정확히 일치해야 한다
import { addDays } from "@/lib/storage/dateKey";
import { DEFAULT_RETENTION_DAYS } from "@/lib/storage/records";
import type { DayRecord } from "@/types";

export type WeeklyDay = {
  date: string; // "YYYY-MM-DD"
  hasRecord: boolean; // 그날 입력한 운동·음식이 하나라도 있는지
  burnedKcal: number; // 기록이 없으면 0
  intakeKcal: number;
};

export type WeeklySummary = {
  days: WeeklyDay[]; // 오래된 날 → 오늘 순서, 항상 7일
  recordedDays: number; // 기록이 있는 날 수
  totalBurnedKcal: number; // 일별 정수값의 합
  totalIntakeKcal: number;
};

// 오늘을 포함한 최근 7일을 날짜별로 정리하고 합계를 낸다. 기록이 없는 날은 0으로 두되 "기록 없음"으로 구분한다.
export function calcWeeklySummary(
  records: Readonly<Record<string, DayRecord>>,
  today: string,
  windowDays: number = DEFAULT_RETENTION_DAYS,
): WeeklySummary {
  const days: WeeklyDay[] = [];
  for (let back = windowDays - 1; back >= 0; back--) {
    const date = addDays(today, -back);
    const record = records[date];
    const hasRecord = !!record && (record.exercises.length > 0 || record.foods.length > 0);
    days.push({
      date,
      hasRecord,
      burnedKcal: hasRecord ? record.burnedKcal : 0,
      intakeKcal: hasRecord ? record.intakeKcal : 0,
    });
  }
  return {
    days,
    recordedDays: days.filter((d) => d.hasRecord).length,
    totalBurnedKcal: days.reduce((sum, d) => sum + d.burnedKcal, 0),
    totalIntakeKcal: days.reduce((sum, d) => sum + d.intakeKcal, 0),
  };
}
