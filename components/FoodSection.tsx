"use client";

// Design Ref: §5.4 오늘 화면 — 음식: 이름 검색 → 선택 → 양 입력(인분/g), 목록에 없으면 직접 입력
// Plan SC: PLAN 작업 10번 / FR-03 — 직접 입력 음식은 "추정치(±20%)" 표시, 탄·단·지는 0으로 계산
import { useState } from "react";
import { FOODS, getFoodById, type Food } from "@/data/foods";
import { calcDirectFoodEntry, calcFoodEntry } from "@/lib/calc/food";
import {
  validateDirectFood,
  validateFoodAmount,
} from "@/lib/validation/entries";
import {
  DIRECT_FOOD_KCAL,
  FOOD_GRAMS,
  FOOD_SERVINGS,
} from "@/lib/validation/limits";
import type { FoodEntry, FoodUnit } from "@/types";

type Props = {
  foods: FoodEntry[];
  // 음식 목록을 바꿀 때 부른다. 브라우저에 저장했으면 true.
  onChange: (foods: FoodEntry[]) => boolean;
};

const inputClass =
  "w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700";
const smallButton =
  "rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700";

function toNumber(text: string): number | undefined {
  const trimmed = text.trim();
  return trimmed === "" ? undefined : Number(trimmed);
}

export default function FoodSection({ foods, onChange }: Props) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Food | null>(null);
  const [unit, setUnit] = useState<FoodUnit>("serving");
  const [amountText, setAmountText] = useState("1");
  const [directMode, setDirectMode] = useState(false);
  const [directName, setDirectName] = useState("");
  const [directKcalText, setDirectKcalText] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState(false);

  const trimmedQuery = query.trim();
  const matches = trimmedQuery
    ? FOODS.filter((food) => food.name.includes(trimmedQuery))
    : [];
  const noResult = trimmedQuery !== "" && matches.length === 0;

  const totalKcal = foods.reduce((sum, food) => sum + food.kcal, 0);

  function resetForm() {
    setQuery("");
    setSelected(null);
    setUnit("serving");
    setAmountText("1");
    setDirectMode(false);
    setDirectName("");
    setDirectKcalText("");
    setEditingIndex(null);
    setError(null);
  }

  function commit(next: FoodEntry[]) {
    setSaveError(!onChange(next));
    resetForm();
  }

  function put(entry: FoodEntry) {
    commit(
      editingIndex === null
        ? [...foods, entry]
        : foods.map((item, index) => (index === editingIndex ? entry : item)),
    );
  }

  function handleAddListed(event: React.FormEvent) {
    event.preventDefault();
    if (!selected) {
      setError("먼저 목록에서 음식을 골라 주세요");
      return;
    }
    const amount = validateFoodAmount({ unit, amount: toNumber(amountText) });
    if (!amount.ok) {
      setError(amount.errors[0].message);
      return;
    }
    put(calcFoodEntry(selected, amount.value.unit, amount.value.amount));
  }

  function handleAddDirect(event: React.FormEvent) {
    event.preventDefault();
    const direct = validateDirectFood({
      name: directName,
      kcal: toNumber(directKcalText),
    });
    if (!direct.ok) {
      setError(direct.errors[0].message);
      return;
    }
    put(calcDirectFoodEntry(direct.value.name, direct.value.kcal));
  }

  function handleEdit(index: number) {
    const entry = foods[index];
    resetForm();
    setEditingIndex(index);
    if (entry.foodId === null) {
      setDirectMode(true);
      setDirectName(entry.name);
      setDirectKcalText(String(entry.kcal));
      return;
    }
    const food = getFoodById(entry.foodId);
    if (!food) {
      setError("이 음식은 목록에서 찾을 수 없어 수정할 수 없습니다. 삭제 후 다시 입력해 주세요.");
      setEditingIndex(null);
      return;
    }
    setSelected(food);
    setUnit(entry.unit);
    setAmountText(String(entry.amount));
  }

  function handleDelete(index: number) {
    setSaveError(!onChange(foods.filter((_, i) => i !== index)));
    if (editingIndex === index) resetForm();
    else if (editingIndex !== null && index < editingIndex) setEditingIndex(editingIndex - 1);
  }

  const range = unit === "serving" ? FOOD_SERVINGS : FOOD_GRAMS;
  const rangeText =
    unit === "serving" ? `${range.min}~${range.max}인분` : `${range.min}~${range.max.toLocaleString("ko-KR")}g`;

  return (
    <section className="space-y-4 rounded-lg border border-zinc-300 p-4 dark:border-zinc-700">
      <h2 className="text-lg font-semibold">오늘 먹은 음식</h2>

      {directMode ? (
        <form onSubmit={handleAddDirect} noValidate className="space-y-3">
          <p className="font-medium">목록에 없는 음식 직접 입력</p>
          <div>
            <label htmlFor="direct-name" className="mb-1 block">음식 이름</label>
            <input
              id="direct-name"
              className={inputClass}
              value={directName}
              onChange={(event) => setDirectName(event.target.value)}
            />
          </div>
          <div>
            <label htmlFor="direct-kcal" className="mb-1 block">
              먹은 양 전체의 칼로리 ({DIRECT_FOOD_KCAL.min}~{DIRECT_FOOD_KCAL.max.toLocaleString("ko-KR")}kcal)
            </label>
            <input
              id="direct-kcal"
              inputMode="numeric"
              className={inputClass}
              value={directKcalText}
              onChange={(event) => setDirectKcalText(event.target.value)}
            />
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            직접 입력한 음식은 <strong>추정치(±20%)</strong>로 표시되고, 탄수화물·단백질·지방은 0으로 계산됩니다.
          </p>
          <div className="flex gap-2">
            <button type="submit" className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white">
              {editingIndex === null ? "음식 추가" : "수정 완료"}
            </button>
            <button type="button" onClick={resetForm} className="rounded-lg border border-zinc-300 px-4 py-2 dark:border-zinc-700">
              취소
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleAddListed} noValidate className="space-y-3">
          {selected === null ? (
            <div>
              <label htmlFor="food-search" className="mb-1 block font-medium">음식 이름 검색</label>
              <input
                id="food-search"
                className={inputClass}
                placeholder="예: 김밥, 계란"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setError(null);
                }}
              />
              {matches.length > 0 && (
                <ul className="mt-2 max-h-56 divide-y divide-zinc-200 overflow-y-auto rounded-lg border border-zinc-300 dark:divide-zinc-800 dark:border-zinc-700">
                  {matches.map((food) => (
                    <li key={food.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelected(food);
                          setError(null);
                        }}
                        className="flex w-full justify-between gap-2 px-3 py-2 text-left"
                      >
                        <span>{food.name} <span className="text-sm text-zinc-500">({food.serving})</span></span>
                        <span className="shrink-0 text-sm text-zinc-500">{food.kcal}kcal</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {noResult && (
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                  검색 결과가 없습니다. 비슷한 음식 이름으로 다시 검색하거나, 아래 버튼으로 직접 입력해 주세요.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 rounded-lg bg-zinc-100 px-3 py-2 dark:bg-zinc-800">
                <span>
                  <strong>{selected.name}</strong>{" "}
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">
                    1인분 = {selected.serving} ({selected.grams}g) · {selected.kcal}kcal
                  </span>
                </span>
                {editingIndex === null && (
                  <button type="button" onClick={() => setSelected(null)} className={smallButton}>
                    다시 고르기
                  </button>
                )}
              </div>

              <fieldset>
                <legend className="mb-1 font-medium">양의 단위</legend>
                <div className="flex gap-6">
                  {(
                    [
                      ["serving", "인분"],
                      ["g", "g"],
                    ] as const
                  ).map(([value, label]) => (
                    <label key={value} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="food-unit"
                        checked={unit === value}
                        onChange={() => {
                          setUnit(value);
                          setAmountText(value === "serving" ? "1" : String(selected.grams));
                        }}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>

              <div>
                <label htmlFor="food-amount" className="mb-1 block font-medium">먹은 양 ({rangeText})</label>
                <input
                  id="food-amount"
                  inputMode="decimal"
                  className={inputClass}
                  value={amountText}
                  onChange={(event) => setAmountText(event.target.value)}
                />
              </div>

              <div className="flex gap-2">
                <button type="submit" className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white">
                  {editingIndex === null ? "음식 추가" : "수정 완료"}
                </button>
                {editingIndex !== null && (
                  <button type="button" onClick={resetForm} className="rounded-lg border border-zinc-300 px-4 py-2 dark:border-zinc-700">
                    취소
                  </button>
                )}
              </div>
            </div>
          )}

          {selected === null && (
            <button
              type="button"
              onClick={() => {
                setDirectMode(true);
                setError(null);
              }}
              className={`${smallButton} w-full py-2 text-base`}
            >
              목록에 없는 음식 직접 입력
            </button>
          )}
        </form>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      {saveError && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          기록을 이 브라우저에 저장하지 못했습니다. 화면에는 보이지만 새로고침하면 사라집니다.
        </p>
      )}

      {foods.length === 0 ? (
        <p className="text-zinc-600 dark:text-zinc-400">아직 입력한 음식이 없습니다.</p>
      ) : (
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {foods.map((entry, index) => (
            <li key={index} className="flex items-center justify-between gap-2 py-2">
              <div>
                <div className="font-medium">
                  {entry.name}
                  {entry.estimated && (
                    <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                      추정치(±20%)
                    </span>
                  )}
                </div>
                <div className="text-sm text-zinc-600 dark:text-zinc-400">
                  {entry.foodId === null
                    ? "직접 입력"
                    : `${entry.amount}${entry.unit === "serving" ? "인분" : "g"}`}{" "}
                  · {entry.kcal.toLocaleString("ko-KR")}kcal
                  {entry.foodId !== null &&
                    ` · 탄 ${entry.carbs}g 단 ${entry.protein}g 지 ${entry.fat}g`}
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <button type="button" onClick={() => handleEdit(index)} className={smallButton}>
                  수정
                </button>
                <button type="button" onClick={() => handleDelete(index)} className={smallButton}>
                  삭제
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="font-semibold">오늘 섭취 합계: {totalKcal.toLocaleString("ko-KR")}kcal</p>
    </section>
  );
}
