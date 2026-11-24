"use client";

// Design Ref: §5.3 화면 목록 — 주간 요약(/weekly): 최근 7일 소모·섭취 칼로리 합계
// Plan SC: PRD Nice 1 — 합계는 저장된 일별 정수값의 합이다
import Link from "next/link";
import { useIsClient } from "@/components/useIsClient";
import { calcWeeklySummary } from "@/lib/calc/weekly";
import { formatDateLabel, getDateKey } from "@/lib/storage/dateKey";
import { loadDays } from "@/lib/storage/records";

const kcal = (value: number) => `${value.toLocaleString("ko-KR")}kcal`;
export default function WeeklyScreen() {
  const isClient = useIsClient();
  if (!isClient) return <p className="text-zinc-500">불러오는 중…</p>;

  const summary = calcWeeklySummary(loadDays(), getDateKey(new Date()));

  return (
    <div className="space-y-6">
      <section aria-label="주간 합계" className="space-y-2 rounded-lg border-2 border-emerald-600 p-4">
        <h2 className="text-lg font-semibold">최근 7일 합계</h2>
        <dl className="divide-y divide-zinc-200 dark:divide-zinc-800">
          <div className="flex justify-between py-1">
            <dt>운동 소모</dt>
            <dd className="font-semibold">{kcal(summary.totalBurnedKcal)}</dd>
          </div>
          <div className="flex justify-between py-1">
            <dt>섭취</dt>
            <dd className="font-semibold">{kcal(summary.totalIntakeKcal)}</dd>
          </div>
        </dl>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          기록이 있는 날 {summary.recordedDays}일 / 7일. 기록하지 않은 날은 0kcal로 더했습니다.
        </p>
      </section>

      <section aria-label="날짜별" className="rounded-lg border border-zinc-300 p-4 dark:border-zinc-700">
        <h2 className="mb-2 text-lg font-semibold">날짜별</h2>
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {summary.days.map((d) => (
            <li key={d.date} className="flex justify-between gap-2 py-2">
              <span>{formatDateLabel(d.date)}</span>
              {d.hasRecord ? (
                <span className="text-sm">
                  소모 {kcal(d.burnedKcal)} · 섭취 {kcal(d.intakeKcal)}
                </span>
              ) : (
                <span className="text-sm text-zinc-500">기록 없음</span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        기록은 이 브라우저에만 저장되며 최근 7일치만 보관합니다. 브라우저 데이터를 지우면 사라집니다.
      </p>
      <Link href="/" className="inline-block rounded-lg border border-zinc-300 px-4 py-2 dark:border-zinc-700">
        오늘 화면으로
      </Link>
    </div>
  );
}
