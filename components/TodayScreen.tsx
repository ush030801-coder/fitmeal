"use client";

// Design Ref: §5.3 화면 목록 — 오늘(/): 운동·음식 입력, 오늘 결과
// 오늘 기록(DayRecord)을 이 화면이 들고 있고, 입력 영역들이 바꿀 때마다 저장한다.
// (오늘 결과는 작업 11번에서 이어서 붙인다)
import Link from "next/link";
import { useState } from "react";
import ExerciseSection from "@/components/ExerciseSection";
import FoodSection from "@/components/FoodSection";
import { useIsClient } from "@/components/useIsClient";
import { getDateKey } from "@/lib/storage/dateKey";
import { loadProfile } from "@/lib/storage/profile";
import { buildDayRecord, emptyDay, getDay, saveDay } from "@/lib/storage/records";
import type { DayRecord, ExerciseEntry, FoodEntry, Profile } from "@/types";

export default function TodayScreen() {
  const isClient = useIsClient();
  if (!isClient) return <p className="text-zinc-500">불러오는 중…</p>;

  const profile = loadProfile();
  if (!profile) {
    return (
      <div className="space-y-3 rounded-lg border border-zinc-300 p-4 dark:border-zinc-700">
        <p>운동 소모 칼로리를 계산하려면 먼저 내 정보(몸무게 등)를 입력해 주세요.</p>
        <Link href="/profile" className="font-medium text-emerald-700 underline dark:text-emerald-400">
          내 정보 입력하러 가기
        </Link>
      </div>
    );
  }
  return <TodayBody profile={profile} />;
}

function TodayBody({ profile }: { profile: Profile }) {
  const [today] = useState(() => getDateKey(new Date()));
  const [day, setDay] = useState<DayRecord>(() => getDay(today) ?? emptyDay(today));

  // 운동 목록을 바꾸고 저장한다. 저장에 성공했으면 true.
  function changeExercises(exercises: ExerciseEntry[]): boolean {
    const next = buildDayRecord(today, exercises, day.foods);
    setDay(next);
    return saveDay(next, { today }).ok;
  }

  // 음식 목록을 바꾸고 저장한다. 저장에 성공했으면 true.
  function changeFoods(foods: FoodEntry[]): boolean {
    const next = buildDayRecord(today, day.exercises, foods);
    setDay(next);
    return saveDay(next, { today }).ok;
  }

  return (
    <div className="space-y-6">
      <ExerciseSection
        exercises={day.exercises}
        weightKg={profile.weightKg}
        onChange={changeExercises}
      />
      <FoodSection foods={day.foods} onChange={changeFoods} />
    </div>
  );
}
