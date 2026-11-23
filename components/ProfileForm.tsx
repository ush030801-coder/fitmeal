"use client";

// Design Ref: §5.4 내 정보 화면 — 입력 → 범위 검사 → 저장 → 권장 칼로리·탄단지 표시
// Plan SC: 성공 기준 4 — 입력 후 권장 칼로리와 탄·단·지를 자동으로 보여 준다
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useIsClient } from "@/components/useIsClient";
import { ALLERGEN_OPTIONS } from "@/data/allergens";
import { calcDailyTargets, type DailyTargets } from "@/lib/calc/targets";
import { loadProfile, saveProfile } from "@/lib/storage/profile";
import { AGE_YEARS, HEIGHT_CM, WEIGHT_KG } from "@/lib/validation/limits";
import { validateProfile } from "@/lib/validation/profile";
import type { Allergen, Goal, Profile, Sex } from "@/types";

const ACTIVITY_OPTIONS = [
  { value: 1.2, label: "거의 앉아서 생활" },
  { value: 1.375, label: "가끔 걷는 가벼운 활동" },
  { value: 1.55, label: "자주 서 있거나 걷는 일" },
  { value: 1.725, label: "하루 대부분 몸을 쓰는 일" },
] as const;

const GOAL_OPTIONS: { value: Goal; label: string }[] = [
  { value: "lose", label: "체중 감량" },
  { value: "gain", label: "근육 증가" },
  { value: "maintain", label: "체중 유지" },
];

// 입력칸 글자를 숫자로 바꾼다. 비어 있으면 undefined, 숫자가 아니면 NaN(검사에서 걸린다)
function toNumber(text: string): number | undefined {
  const trimmed = text.trim();
  return trimmed === "" ? undefined : Number(trimmed);
}

function formatKcal(value: number): string {
  return value.toLocaleString("ko-KR");
}

type FormState = {
  sex: Sex | "";
  age: string;
  heightCm: string;
  weightKg: string;
  activity: number | "";
  goal: Goal | "";
  allergies: Allergen[];
};

function toFormState(profile: Profile | null): FormState {
  if (!profile) {
    return { sex: "", age: "", heightCm: "", weightKg: "", activity: "", goal: "", allergies: [] };
  }
  return {
    sex: profile.sex,
    age: String(profile.age),
    heightCm: String(profile.heightCm),
    weightKg: String(profile.weightKg),
    activity: profile.activity,
    goal: profile.goal,
    allergies: profile.allergies,
  };
}

export default function ProfileForm() {
  const isClient = useIsClient();
  if (!isClient) return <p className="text-zinc-500">불러오는 중…</p>;
  return <ProfileFormBody initial={loadProfile()} />;
}

function FieldMessage({ children }: { children?: string }) {
  if (!children) return null;
  return (
    <p role="alert" className="mt-1 text-sm text-red-600 dark:text-red-400">
      {children}
    </p>
  );
}

const inputClass =
  "w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1 block font-medium">{label}</label>
      {children}
    </div>
  );
}

function ProfileFormBody({ initial }: { initial: Profile | null }) {
  const [form, setForm] = useState<FormState>(() => toFormState(initial));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Profile | null>(initial);
  const [saveError, setSaveError] = useState<string | null>(null);

  const targets: DailyTargets | null = saved ? calcDailyTargets(saved) : null;

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleAllergy(id: Allergen) {
    setForm((prev) => ({
      ...prev,
      allergies: prev.allergies.includes(id)
        ? prev.allergies.filter((item) => item !== id)
        : [...prev.allergies, id],
    }));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaveError(null);
    const result = validateProfile({
      sex: form.sex === "" ? undefined : form.sex,
      age: toNumber(form.age),
      heightCm: toNumber(form.heightCm),
      weightKg: toNumber(form.weightKg),
      activity: form.activity === "" ? undefined : form.activity,
      goal: form.goal === "" ? undefined : form.goal,
      allergies: form.allergies,
    });

    if (!result.ok) {
      const next: Record<string, string> = {};
      for (const error of result.errors) {
        const field = error.field.split(".")[0];
        if (!next[field]) next[field] = error.message;
      }
      setErrors(next);
      setSaved(null); // 틀린 입력으로는 계산하지 않는다
      return;
    }

    setErrors({});
    const stored = saveProfile(result.value);
    if (!stored.ok) {
      setSaveError(
        "정보를 이 브라우저에 저장하지 못했습니다. 계산 결과는 아래에 보이지만 다시 열면 사라집니다.",
      );
    }
    setSaved(result.value);
  }

  return (
    <div className="space-y-8">
      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        <fieldset>
          <legend className="mb-1 font-medium">성별</legend>
          <div className="flex gap-6">
            {(
              [
                ["male", "남성"],
                ["female", "여성"],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="sex"
                  checked={form.sex === value}
                  onChange={() => update("sex", value)}
                />
                {label}
              </label>
            ))}
          </div>
          <FieldMessage>{errors.sex}</FieldMessage>
        </fieldset>

        <Field label={`나이 (만 ${AGE_YEARS.min}~${AGE_YEARS.max}세)`}>
          <input
            inputMode="numeric"
            className={inputClass}
            value={form.age}
            onChange={(event) => update("age", event.target.value)}
            aria-label="나이"
          />
          <FieldMessage>{errors.age}</FieldMessage>
        </Field>

        <Field label={`키 (${HEIGHT_CM.min}~${HEIGHT_CM.max}cm)`}>
          <input
            inputMode="decimal"
            className={inputClass}
            value={form.heightCm}
            onChange={(event) => update("heightCm", event.target.value)}
            aria-label="키"
          />
          <FieldMessage>{errors.heightCm}</FieldMessage>
        </Field>

        <Field label={`몸무게 (${WEIGHT_KG.min}~${WEIGHT_KG.max}kg)`}>
          <input
            inputMode="decimal"
            className={inputClass}
            value={form.weightKg}
            onChange={(event) => update("weightKg", event.target.value)}
            aria-label="몸무게"
          />
          <FieldMessage>{errors.weightKg}</FieldMessage>
        </Field>

        <fieldset>
          <legend className="mb-1 font-medium">평소 활동량 (운동은 빼고, 일상 활동 기준)</legend>
          <div className="space-y-2">
            {ACTIVITY_OPTIONS.map((option) => (
              <label key={option.value} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="activity"
                  checked={form.activity === option.value}
                  onChange={() => update("activity", option.value)}
                />
                {option.label}
              </label>
            ))}
          </div>
          <FieldMessage>{errors.activity}</FieldMessage>
        </fieldset>

        <fieldset>
          <legend className="mb-1 font-medium">운동 목표</legend>
          <div className="flex flex-wrap gap-6">
            {GOAL_OPTIONS.map((option) => (
              <label key={option.value} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="goal"
                  checked={form.goal === option.value}
                  onChange={() => update("goal", option.value)}
                />
                {option.label}
              </label>
            ))}
          </div>
          <FieldMessage>{errors.goal}</FieldMessage>
        </fieldset>

        <fieldset>
          <legend className="mb-1 font-medium">알레르기 (해당하는 것을 모두 선택, 없으면 비워 두세요)</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {ALLERGEN_OPTIONS.map((option) => (
              <label key={option.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.allergies.includes(option.id)}
                  onChange={() => toggleAllergy(option.id)}
                />
                {option.label}
              </label>
            ))}
          </div>
          <FieldMessage>{errors.allergies}</FieldMessage>
        </fieldset>

        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          임산부·수유부는 이 앱의 대상이 아닙니다.
        </p>

        <button
          type="submit"
          className="w-full rounded-lg bg-emerald-600 px-4 py-3 font-semibold text-white"
        >
          저장하고 권장량 보기
        </button>
      </form>

      {saveError && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {saveError}
        </p>
      )}

      {saved && targets && (
        <section
          aria-label="권장량 결과"
          className="space-y-3 rounded-lg border border-zinc-300 p-4 dark:border-zinc-700"
        >
          <h2 className="text-lg font-semibold">하루 기본 권장량</h2>
          <p className="text-3xl font-bold">{formatKcal(targets.kcal)} kcal</p>
          <ul className="grid grid-cols-3 gap-2 text-center">
            <li className="rounded-lg bg-zinc-100 p-2 dark:bg-zinc-800">
              <div className="text-sm">탄수화물</div>
              <div className="font-semibold">{targets.carbsG}g</div>
            </li>
            <li className="rounded-lg bg-zinc-100 p-2 dark:bg-zinc-800">
              <div className="text-sm">단백질</div>
              <div className="font-semibold">{targets.proteinG}g</div>
            </li>
            <li className="rounded-lg bg-zinc-100 p-2 dark:bg-zinc-800">
              <div className="text-sm">지방</div>
              <div className="font-semibold">{targets.fatG}g</div>
            </li>
          </ul>
          {targets.floorRaised && (
            <p className="text-sm text-amber-700 dark:text-amber-400">
              계산값이 {formatKcal(targets.floorKcal)}kcal(하루 최소 섭취 기준)보다 낮아서
              {" "}{formatKcal(targets.floorKcal)}kcal로 올렸습니다.
            </p>
          )}
          <Link href="/" className="inline-block font-medium text-emerald-700 underline dark:text-emerald-400">
            오늘 화면으로 이동
          </Link>
        </section>
      )}
    </div>
  );
}
