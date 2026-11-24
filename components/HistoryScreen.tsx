"use client";

// Design Ref: §5.3 화면 목록 — 과거 기록(/history): 날짜별 기록 열람·수정
// Plan SC: PRD Nice 2 — 최근 7일 기록을 다시 보고, 고치면 칼로리를 다시 계산해 저장한다
import Link from "next/link";
import { useState } from "react";
import ExerciseSection from "@/components/ExerciseSection";
import FoodSection from "@/components/FoodSection";
import { useIsClient } from "@/components/useIsClient";
import { calcDailyTargets } from "@/lib/calc/targets";
import { addDays, formatDateLabel, getDateKey } from "@/lib/storage/dateKey";
import { loadProfile } from "@/lib/storage/profile";
import { buildDayRecord, DEFAULT_RETENTION_DAYS, emptyDay, getDay, saveDay } from "@/lib/storage/records";
import type { DayRecord, ExerciseEntry, FoodEntry, Profile } from "@/types";

const kcal = (value: number) => `${value.toLocaleString("ko-KR")}kcal`;

export default function HistoryScreen() {
  const isClient = useIsClient();
  if (!isClient) return <p className="text-zinc-500">불러오는 중…</p>;

  const profile = loadProfile();
  if (!profile) {
    return (
      <div className="space-y-3 rounded-lg border border-zinc-300 p-4 dark:border-zinc-700">
        <p>기록을 보려면 먼저 내 정보(몸무게 등)를 입력해 주세요.</p>
        <Link href="/profile" className="font-medium text-emerald-700 underline dark:text-emerald-400">
          내 정보 입력하러 가기
        </Link>
      </div>
    );
  }
  return <HistoryBody profile={profile} />;
}

function HistoryBody({ profile }: { profile: Profile }) {
  const [today] = useState(() => getDateKey(new Date()));
  // 오래된 날 → 오늘 순서의 7일
  const dates = Array.from({ length: DEFAULT_RETENTION_DAYS }, (_, i) =>
    addDays(today, -(DEFAULT_RETENTION_DAYS - 1 - i)),
  );
  const [selected, setSelected] = useState(today);

  return (
    <div className="space-y-6">
      <nav aria-label="날짜 선택">
        <ul className="flex flex-wrap gap-2">
          {dates.map((date) => (
            <li key={date}>
              <button
                type="button"
                onClick={() => setSelected(date)}
                aria-pressed={date === selected}
                className={`rounded-lg border px-3 py-1.5 text-sm ${
                  date === selected
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : "border-zinc-300 dark:border-zinc-700"
                }`}
              >
                {formatDateLabel(date)}
                {date === today && " 오늘"}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      {/* key로 날짜가 바뀔 때마다 그날 기록을 새로 읽는다 */}
      <DayEditor key={selected} date={selected} today={today} profile={profile} />
    </div>
  );
}

function DayEditor({ date, today, profile }: { date: string; today: string; profile: Profile }) {
  const [day, setDay] = useState<DayRecord>(() => getDay(date) ?? emptyDay(date));
  const targets = calcDailyTargets(profile);
  const isEmpty = day.exercises.length === 0 && day.foods.length === 0;

  // 바꾸면 합계를 다시 계산해 저장한다. 저장에 성공했으면 true.
  function changeExercises(exercises: ExerciseEntry[]): boolean {
    const next = buildDayRecord(date, exercises, day.foods);
    setDay(next);
    return saveDay(next, { today }).ok;
  }
  function changeFoods(foods: FoodEntry[]): boolean {
    const next = buildDayRecord(date, day.exercises, foods);
    setDay(next);
    return saveDay(next, { today }).ok;
  }

  return (
    <div className="space-y-6">
      <section aria-label="그날 합계" className="space-y-1 rounded-lg border border-zinc-300 p-4 dark:border-zinc-700">
        <h2 className="text-lg font-semibold">{formatDateLabel(date)} 합계</h2>
        {isEmpty ? (
          <p className="text-zinc-600 dark:text-zinc-400">이 날 입력한 기록이 없습니다. 아래에서 추가할 수 있습니다.</p>
        ) : (
          <p>
            운동 소모 {kcal(day.burnedKcal)} · 섭취 {kcal(day.intakeKcal)} · 단백질 {day.proteinG}g (하루 권장 {targets.proteinG}g)
          </p>
        )}
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          고치면 칼로리가 바로 다시 계산됩니다. 새로 넣는 운동은 지금 내 정보의 몸무게({profile.weightKg}kg)로 계산합니다.
        </p>
      </section>
      <ExerciseSection exercises={day.exercises} weightKg={profile.weightKg} dayLabel={formatDateLabel(date)} onChange={changeExercises} />
      <FoodSection foods={day.foods} dayLabel={formatDateLabel(date)} onChange={changeFoods} />
    </div>
  );
}
