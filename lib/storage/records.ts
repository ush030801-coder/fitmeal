// Design Ref: §3.2 브라우저 저장 위치(`fitmeal:days`) / §2.2 ② — 일별 운동·식사 기록 보관
// Plan SC: FR-07 — 최근 7일치 기록을 브라우저에 보관한다 (사용자 요청으로 기본 2일 → 7일로 변경)
import { z } from "zod";
import { sumBurnedKcal } from "@/lib/calc/burned";
import {
  FOOD_UNITS,
  type DayRecord,
  type ExerciseEntry,
  type FoodEntry,
} from "@/types";
import { DIRECT_FOOD_NAME_MAX_LENGTH, EXERCISE_MINUTES, FOOD_GRAMS } from "@/lib/validation/limits";
import { addDays, getDateKey, isDateKey } from "./dateKey";
import { getBrowserStore, type KeyValueStore } from "./store";

export const DAYS_STORAGE_KEY = "fitmeal:days";
export const DEFAULT_RETENTION_DAYS = 7; // 오늘 포함 최근 7일치 보관
const STORAGE_VERSION = 1;

// ── 저장된 값이 약속한 모양인지 확인하는 검사표 ──────────────────

// 저장된 값의 상한 (입력 폼의 범위를 기준으로 넉넉하게: 사람이 손으로 고친 값이 화면을 깨지 못하게 한다)
const MAX_ENTRY_KCAL = 100_000; // 항목 1건
const MAX_ENTRY_GRAMS = 10_000; // 탄·단·지 1건
const MAX_ENTRIES_PER_DAY = 200; // 하루 운동·음식 항목 수

const exerciseEntrySchema = z.object({
  exerciseId: z.string().min(1),
  minutes: z.number().int().min(EXERCISE_MINUTES.min).max(EXERCISE_MINUTES.max),
  kcal: z.number().int().min(0).max(MAX_ENTRY_KCAL),
});

const foodEntrySchema = z.object({
  foodId: z.string().min(1).nullable(),
  name: z.string().min(1).max(DIRECT_FOOD_NAME_MAX_LENGTH),
  unit: z.enum(FOOD_UNITS),
  amount: z.number().positive().max(FOOD_GRAMS.max), // 인분(최대 10)·g(최대 2,000) 중 큰 쪽
  kcal: z.number().int().min(0).max(MAX_ENTRY_KCAL),
  carbs: z.number().min(0).max(MAX_ENTRY_GRAMS),
  protein: z.number().min(0).max(MAX_ENTRY_GRAMS),
  fat: z.number().min(0).max(MAX_ENTRY_GRAMS),
  estimated: z.boolean(),
});

// 합계(burnedKcal 등)는 저장된 값을 믿지 않고 항목에서 다시 계산하므로 검사하지 않는다
const dayEntriesSchema = z.object({
  date: z.string().refine(isDateKey),
  exercises: z.array(exerciseEntrySchema).max(MAX_ENTRIES_PER_DAY),
  foods: z.array(foodEntrySchema).max(MAX_ENTRIES_PER_DAY),
});

const storedFileSchema = z.object({
  version: z.literal(STORAGE_VERSION),
  days: z.record(z.string(), z.unknown()),
});

// ── 하루 기록 만들기 ──────────────────────────────────────

// 운동·음식 항목으로 하루 기록을 만든다. 합계는 항상 항목에서 다시 계산한다.
// (칼로리는 항목마다 이미 정수라서 합계도 정수의 합이다)
export function buildDayRecord(
  date: string,
  exercises: readonly ExerciseEntry[],
  foods: readonly FoodEntry[],
): DayRecord {
  const proteinSum = foods.reduce((sum, food) => sum + food.protein, 0);
  return {
    date,
    exercises: [...exercises],
    foods: [...foods],
    burnedKcal: sumBurnedKcal(exercises),
    intakeKcal: foods.reduce((sum, food) => sum + food.kcal, 0),
    proteinG: Math.round(proteinSum * 10) / 10, // 소수 계산 오차를 첫째 자리에서 정리
  };
}

// 아직 아무것도 입력하지 않은 날의 빈 기록
export function emptyDay(date: string): DayRecord {
  return buildDayRecord(date, [], []);
}

// ── 읽기 ────────────────────────────────────────────────

// 저장된 기록을 모두 읽는다 (날짜 키 → 하루 기록).
// 저장소를 쓸 수 없거나, 내용이 깨졌거나, 버전이 다르면 빈 결과를 돌려준다.
// 모양이 틀린 날짜 하나 때문에 다른 날 기록까지 잃지 않도록 날짜별로 걸러 낸다.
export function loadDays(
  store: KeyValueStore | null = getBrowserStore(),
): Record<string, DayRecord> {
  if (!store) return {};

  let text: string | null;
  try {
    text = store.getItem(DAYS_STORAGE_KEY);
  } catch {
    return {};
  }
  if (text === null) return {};

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return {};
  }

  const file = storedFileSchema.safeParse(json);
  if (!file.success) return {};

  const days: Record<string, DayRecord> = {};
  for (const [key, value] of Object.entries(file.data.days)) {
    const parsed = dayEntriesSchema.safeParse(value);
    if (parsed.success && parsed.data.date === key) {
      days[key] = buildDayRecord(key, parsed.data.exercises, parsed.data.foods);
    }
  }
  return days;
}

// 한 날짜의 기록을 읽는다 (없으면 null)
export function getDay(
  date: string,
  store: KeyValueStore | null = getBrowserStore(),
): DayRecord | null {
  return loadDays(store)[date] ?? null;
}

// ── 저장 ────────────────────────────────────────────────

export type SaveOptions = {
  store?: KeyValueStore | null; // 테스트에서 가짜 저장소를 넣을 때 쓴다
  today?: string; // 기준 날짜 키 (기본: 지금 기기 날짜)
  retentionDays?: number; // 보관 일수 (기본 7: 오늘 포함 최근 7일)
};

export type SaveResult =
  | { ok: true }
  | {
      ok: false;
      // unavailable: 브라우저 저장소를 쓸 수 없음 / write_failed: 쓰다가 실패(용량 초과 등)
      // invalid_record: 기록 모양이 틀림 / outside_retention: 보관 기간보다 오래된 날짜
      reason: "unavailable" | "write_failed" | "invalid_record" | "outside_retention";
    };

// 하루 기록을 저장한다. 같은 날짜가 있으면 덮어쓰고, 보관 기간(기본 오늘+어제)보다
// 오래된 기록은 이때 함께 지운다. 저장에 실패해도 오류를 던지지 않고 이유를 알려 준다.
export function saveDay(record: DayRecord, options: SaveOptions = {}): SaveResult {
  const store = options.store === undefined ? getBrowserStore() : options.store;
  if (!store) return { ok: false, reason: "unavailable" };

  const parsed = dayEntriesSchema.safeParse(record);
  if (!parsed.success) return { ok: false, reason: "invalid_record" };

  const today = options.today ?? getDateKey(new Date());
  const retentionDays = Math.max(
    1,
    Math.floor(options.retentionDays ?? DEFAULT_RETENTION_DAYS),
  );
  const cutoff = addDays(today, -(retentionDays - 1)); // 이 날짜부터 오늘까지 보관

  if (parsed.data.date < cutoff) return { ok: false, reason: "outside_retention" };

  const days = loadDays(store);
  days[parsed.data.date] = buildDayRecord(
    parsed.data.date,
    parsed.data.exercises,
    parsed.data.foods,
  );
  for (const key of Object.keys(days)) {
    if (key < cutoff) delete days[key]; // "YYYY-MM-DD"는 문자열 비교로 날짜 순서가 맞다
  }

  try {
    store.setItem(
      DAYS_STORAGE_KEY,
      JSON.stringify({ version: STORAGE_VERSION, days }),
    );
    return { ok: true };
  } catch {
    return { ok: false, reason: "write_failed" };
  }
}
