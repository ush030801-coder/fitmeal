"use client";

// Design Ref: §5.4 내일 식단 화면 — 3끼 카드, 하루 합계·단백질, 반영 안내, 로딩·실패 안내
// Plan SC: PLAN 작업 15번 / FR-05·FR-06 — 오늘 기록으로 내일 목표를 계산해 /api/menu에 보내고 결과를 보여준다
// 서버로 보내는 값은 성별·몸무게·목표·알레르기·내일 목표 칼로리·초과/부족 반영 내용뿐이다 (이름·나이·키는 보내지 않는다)
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useIsClient } from "@/components/useIsClient";
import type { MenuRequest } from "@/lib/ai/request";
import { calcTodayResult } from "@/lib/calc/today";
import { calcTomorrowTarget } from "@/lib/calc/tomorrow";
import { getDateKey } from "@/lib/storage/dateKey";
import { loadProfile } from "@/lib/storage/profile";
import { emptyDay, getDay } from "@/lib/storage/records";
import type { Profile } from "@/types";

type MenuItem = { foodId: string; name: string; amountText: string; kcal: number; carbs: number; protein: number; fat: number; estimated: boolean };
type Meal = { type: "breakfast" | "lunch" | "dinner"; items: MenuItem[] };
type Totals = { kcal: number; carbs: number; protein: number; fat: number };
type MenuData = { meals: Meal[]; totals: Totals; notes: string[] };

type State =
  | { status: "loading" }
  | { status: "done"; data: MenuData }
  | { status: "error"; message: string };

const MEAL_LABEL: Record<Meal["type"], string> = { breakfast: "아침", lunch: "점심", dinner: "저녁" };
const kcal = (value: number) => `${value.toLocaleString("ko-KR")}kcal`;
const FAIL_MESSAGE = "지금은 식단을 만들 수 없습니다. 잠시 뒤에 다시 시도해 주세요.";
// 서버는 AI를 최대 2번(1번에 20초까지) 부르므로 화면은 그보다 조금 더 기다린다
const CLIENT_TIMEOUT_MS = 50_000;

export default function MenuScreen() {
  const isClient = useIsClient();
  if (!isClient) return <p className="text-zinc-500">불러오는 중…</p>;

  const profile = loadProfile();
  if (!profile) {
    return (
      <div className="space-y-3 rounded-lg border border-zinc-300 p-4 dark:border-zinc-700">
        <p>식단을 추천하려면 먼저 내 정보를 입력해 주세요.</p>
        <Link href="/profile" className="font-medium text-emerald-700 underline dark:text-emerald-400">
          내 정보 입력하러 가기
        </Link>
      </div>
    );
  }
  return <MenuBody profile={profile} />;
}

// 오늘 기록 → 내일 목표 칼로리 → 서버 요청 값과, 화면에만 쓰는 오늘 단백질 부족량
function buildRequest(profile: Profile): { request: MenuRequest; proteinShortG: number } {
  const day = getDay(getDateKey(new Date())) ?? emptyDay(getDateKey(new Date()));
  const today = calcTodayResult(profile, day);
  const tomorrow = calcTomorrowTarget(today);
  const proteinShortG = today.hasRecord ? Math.max(0, Math.round((today.proteinTargetG - today.proteinG) * 10) / 10) : 0;
  return {
    request: {
      sex: profile.sex,
      weightKg: profile.weightKg,
      goal: profile.goal,
      targetKcal: tomorrow.targetKcal,
      allergies: profile.allergies,
      adjustment: tomorrow.adjustment,
    },
    proteinShortG,
  };
}

function MenuBody({ profile }: { profile: Profile }) {
  const [{ request, proteinShortG }] = useState(() => buildRequest(profile));
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0); // 다시 시도하면 1씩 늘어 요청을 새로 보낸다

  useEffect(() => {
    const controller = new AbortController();
    let leftScreen = false; // 화면을 떠나며 취소한 경우와 시간 초과를 구분한다
    const timer = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);
    fetch("/api/menu", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("failed");
        const data = (await res.json()) as MenuData;
        setState({ status: "done", data });
      })
      .catch(() => {
        if (leftScreen) return;
        setState({ status: "error", message: FAIL_MESSAGE });
      })
      .finally(() => clearTimeout(timer));
    return () => {
      leftScreen = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [request, attempt]);

  const retry = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((n) => n + 1);
  }, []);

  return (
    <div className="space-y-6">
      <section aria-label="내일 목표" className="space-y-1 rounded-lg border border-zinc-300 p-4 dark:border-zinc-700">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">내일 목표 칼로리</p>
        <p className="text-2xl font-bold">{kcal(request.targetKcal)}</p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          식단 합계 허용 범위는 목표의 ±5%이고, 하루 최소 섭취 기준 아래로는 내려가지 않습니다.
        </p>
      </section>

      {state.status === "loading" && (
        <div role="status" className="space-y-1 rounded-lg border border-zinc-300 p-4 dark:border-zinc-700">
          <p className="font-medium">내일 식단을 만드는 중입니다…</p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">보통 몇 초, 길면 40초 정도 걸릴 수 있습니다.</p>
        </div>
      )}

      {state.status === "error" && (
        <div role="alert" className="space-y-3 rounded-lg border border-red-300 p-4 dark:border-red-800">
          <p className="font-medium text-red-700 dark:text-red-400">{state.message}</p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">오늘의 칼로리 계산 결과는 그대로 확인할 수 있습니다.</p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={retry}
              className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white"
            >
              다시 시도
            </button>
            <Link href="/" className="rounded-lg border border-zinc-300 px-4 py-2 dark:border-zinc-700">
              오늘 화면으로
            </Link>
          </div>
        </div>
      )}

      {state.status === "done" && (
        <MenuResult data={state.data} request={request} proteinShortG={proteinShortG} />
      )}
    </div>
  );
}

function MenuResult({
  data,
  request,
  proteinShortG,
}: {
  data: MenuData;
  request: MenuRequest;
  proteinShortG: number;
}) {
  const proteinTarget = Math.round(request.weightKg * 1.6 * 10) / 10;
  return (
    <div className="space-y-6">
      {data.meals.map((meal) => {
        const mealKcal = meal.items.reduce((s, i) => s + i.kcal, 0);
        return (
          <section
            key={meal.type}
            aria-label={MEAL_LABEL[meal.type]}
            className="space-y-2 rounded-lg border border-zinc-300 p-4 dark:border-zinc-700"
          >
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-semibold">{MEAL_LABEL[meal.type]}</h2>
              <span className="text-sm text-zinc-600 dark:text-zinc-400">{kcal(mealKcal)}</span>
            </div>
            <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {meal.items.map((item) => (
                <li key={item.foodId} className="py-2">
                  <div className="flex justify-between gap-2">
                    <span className="font-medium">
                      {item.name}
                      {item.estimated && (
                        <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-normal text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                          추정치(±20%)
                        </span>
                      )}
                    </span>
                    <span>{kcal(item.kcal)}</span>
                  </div>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {item.amountText} · 탄수화물 {item.carbs}g · 단백질 {item.protein}g · 지방 {item.fat}g
                  </p>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <section aria-label="하루 합계" className="space-y-2 rounded-lg border-2 border-emerald-600 p-4">
        <h2 className="text-lg font-semibold">하루 합계</h2>
        <p className="text-2xl font-bold">{kcal(data.totals.kcal)}</p>
        <p className="text-sm">
          탄수화물 {data.totals.carbs}g · 단백질 {data.totals.protein}g · 지방 {data.totals.fat}g
        </p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          단백질 기준 {proteinTarget}g(체중 1kg당 1.6g) 이상 {data.totals.protein >= proteinTarget ? "충족" : "미달"}
        </p>
      </section>

      {(data.notes.length > 0 || proteinShortG > 0) && (
        <ul aria-label="안내" className="list-disc space-y-1 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
          {data.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
          {proteinShortG > 0 && (
            <li>오늘은 단백질이 {proteinShortG}g 모자랐습니다. 내일 식단은 단백질 기준 이상으로 맞췄습니다. (내일 목표 칼로리는 바뀌지 않습니다.)</li>
          )}
        </ul>
      )}

      <Link href="/" className="inline-block rounded-lg border border-zinc-300 px-4 py-2 dark:border-zinc-700">
        오늘 화면으로 돌아가기
      </Link>
    </div>
  );
}
