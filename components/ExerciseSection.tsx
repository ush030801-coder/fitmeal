"use client";

// Design Ref: §5.4 오늘 화면 — 운동: 목록에서 선택 + 시간(분) 입력, 항목마다 수정·삭제
// Plan SC: PLAN 작업 9번 / FR-02 — 소모 칼로리 = MET × 체중 × 시간, 하루 합계 8시간 이하
import { useState } from "react";
import { EXERCISES, getExerciseById } from "@/data/exercises";
import { calcExerciseEntry, sumBurnedKcal } from "@/lib/calc/burned";
import {
  validateDailyExerciseTotal,
  validateExerciseMinutes,
} from "@/lib/validation/entries";
import { EXERCISE_MINUTES } from "@/lib/validation/limits";
import type { ExerciseEntry } from "@/types";

type Props = {
  exercises: ExerciseEntry[];
  weightKg: number;
  // 운동 목록을 바꿀 때 부른다. 브라우저에 저장했으면 true.
  onChange: (exercises: ExerciseEntry[]) => boolean;
};

const inputClass =
  "w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700";

export default function ExerciseSection({ exercises, weightKg, onChange }: Props) {
  const [exerciseId, setExerciseId] = useState(EXERCISES[0].id);
  const [minutesText, setMinutesText] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState(false);

  const totalBurned = sumBurnedKcal(exercises);

  function resetForm() {
    setEditingIndex(null);
    setMinutesText("");
    setError(null);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = minutesText.trim();
    const minutes = validateExerciseMinutes(trimmed === "" ? undefined : Number(trimmed));
    if (!minutes.ok) {
      setError(minutes.errors[0].message);
      return;
    }

    // 고친 항목은 합계에서 빼고 다시 더한다
    const others = exercises.filter((_, index) => index !== editingIndex);
    const total = validateDailyExerciseTotal([
      ...others.map((entry) => entry.minutes),
      minutes.value,
    ]);
    if (!total.ok) {
      setError(total.errors[0].message);
      return;
    }

    const exercise = getExerciseById(exerciseId);
    if (!exercise) {
      setError("운동 목록에서 골라 주세요");
      return;
    }

    const entry = calcExerciseEntry(exercise, minutes.value, weightKg);
    const next =
      editingIndex === null
        ? [...exercises, entry]
        : exercises.map((item, index) => (index === editingIndex ? entry : item));
    setSaveError(!onChange(next));
    resetForm();
  }

  function handleEdit(index: number) {
    setEditingIndex(index);
    setExerciseId(exercises[index].exerciseId);
    setMinutesText(String(exercises[index].minutes));
    setError(null);
  }

  function handleDelete(index: number) {
    setSaveError(!onChange(exercises.filter((_, i) => i !== index)));
    if (editingIndex === index) resetForm();
    else if (editingIndex !== null && index < editingIndex) setEditingIndex(editingIndex - 1);
  }

  return (
    <section className="space-y-4 rounded-lg border border-zinc-300 p-4 dark:border-zinc-700">
      <h2 className="text-lg font-semibold">오늘의 운동</h2>

      <form onSubmit={handleSubmit} noValidate className="space-y-3">
        <div>
          <label htmlFor="exercise-select" className="mb-1 block font-medium">
            운동 종류
          </label>
          <select
            id="exercise-select"
            className={inputClass}
            value={exerciseId}
            onChange={(event) => setExerciseId(event.target.value)}
          >
            {EXERCISES.map((exercise) => (
              <option key={exercise.id} value={exercise.id}>
                {exercise.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            목록에 없는 운동은 비슷한 운동을 골라 주세요.
          </p>
        </div>

        <div>
          <label htmlFor="exercise-minutes" className="mb-1 block font-medium">
            운동 시간 ({EXERCISE_MINUTES.min}~{EXERCISE_MINUTES.max}분)
          </label>
          <input
            id="exercise-minutes"
            inputMode="numeric"
            className={inputClass}
            value={minutesText}
            onChange={(event) => setMinutesText(event.target.value)}
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <button
            type="submit"
            className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white"
          >
            {editingIndex === null ? "운동 추가" : "수정 완료"}
          </button>
          {editingIndex !== null && (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg border border-zinc-300 px-4 py-2 dark:border-zinc-700"
            >
              취소
            </button>
          )}
        </div>
      </form>

      {saveError && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          기록을 이 브라우저에 저장하지 못했습니다. 화면에는 보이지만 새로고침하면 사라집니다.
        </p>
      )}

      {exercises.length === 0 ? (
        <p className="text-zinc-600 dark:text-zinc-400">아직 입력한 운동이 없습니다.</p>
      ) : (
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {exercises.map((entry, index) => (
            <li key={index} className="flex items-center justify-between gap-2 py-2">
              <div>
                <div className="font-medium">
                  {getExerciseById(entry.exerciseId)?.name ?? "알 수 없는 운동"}
                </div>
                <div className="text-sm text-zinc-600 dark:text-zinc-400">
                  {entry.minutes}분 · {entry.kcal.toLocaleString("ko-KR")}kcal 소모
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => handleEdit(index)}
                  className="rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700"
                >
                  수정
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(index)}
                  className="rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700"
                >
                  삭제
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="font-semibold">
        오늘 운동 소모 합계: {totalBurned.toLocaleString("ko-KR")}kcal
      </p>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        소모 칼로리는 공식 기준값으로 계산한 추정치라 실제와 약 ±10% 차이가 날 수 있습니다.
      </p>
    </section>
  );
}
