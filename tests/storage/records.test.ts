// Plan SC: FR-07 / PLAN 작업 6번 — 최근 2일치 기록 보관·읽기 확인
import { describe, expect, it } from "vitest";
import { addDays, getDateKey, isDateKey } from "@/lib/storage/dateKey";
import {
  buildDayRecord,
  DAYS_STORAGE_KEY,
  emptyDay,
  getDay,
  loadDays,
  saveDay,
} from "@/lib/storage/records";
import type { KeyValueStore } from "@/lib/storage/store";
import type { ExerciseEntry, FoodEntry } from "@/types";

// 테스트용 가짜 저장소 (브라우저 없이 저장·읽기를 흉내 낸다)
function memoryStore(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  const store: KeyValueStore = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
  return { store, data };
}

const walk: ExerciseEntry = { exerciseId: "e002", minutes: 30, kcal: 105 };
const run: ExerciseEntry = { exerciseId: "e004", minutes: 20, kcal: 166 };
const rice: FoodEntry = {
  foodId: "f001", name: "쌀밥", unit: "serving", amount: 1,
  kcal: 313, carbs: 69, protein: 5.7, fat: 0.6, estimated: false,
};
const direct: FoodEntry = {
  foodId: null, name: "엄마표 김치찌개", unit: "serving", amount: 1,
  kcal: 320, carbs: 0, protein: 0, fat: 0, estimated: true,
};

const sampleDay = (date: string) => buildDayRecord(date, [walk], [rice]);

describe("날짜 키 (기기 시간 기준 00:00~24:00)", () => {
  it("자정 직전은 오늘, 자정이 지나면 다음 날", () => {
    expect(getDateKey(new Date(2026, 10, 23, 23, 59, 59))).toBe("2026-11-23");
    expect(getDateKey(new Date(2026, 10, 24, 0, 0, 0))).toBe("2026-11-24");
  });

  it("달·연도·윤년 경계에서 하루 전", () => {
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2024-03-01", -1)).toBe("2024-02-29");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDays("2026-11-23", 7)).toBe("2026-11-30");
  });

  it("실제 있는 날짜 모양만 인정", () => {
    expect(isDateKey("2026-11-23")).toBe(true);
    expect(isDateKey("2026-02-30")).toBe(false);
    expect(isDateKey("2026-2-3")).toBe(false);
    expect(isDateKey("abc")).toBe(false);
  });
});

describe("하루 기록 만들기", () => {
  it("합계는 항목에서 계산한다 (소모 271, 섭취 633, 단백질 5.7)", () => {
    const day = buildDayRecord("2026-11-23", [walk, run], [rice, direct]);
    expect(day).toMatchObject({ burnedKcal: 271, intakeKcal: 633, proteinG: 5.7 });
  });

  it("단백질 합계의 소수 계산 오차를 정리한다 (0.1 + 0.2 = 0.3)", () => {
    const a = { ...rice, protein: 0.1 };
    const b = { ...rice, protein: 0.2 };
    expect(buildDayRecord("2026-11-23", [], [a, b]).proteinG).toBe(0.3);
  });

  it("빈 날은 모두 0", () => {
    expect(emptyDay("2026-11-23")).toEqual({
      date: "2026-11-23", exercises: [], foods: [],
      burnedKcal: 0, intakeKcal: 0, proteinG: 0,
    });
  });
});

describe("저장하고 읽기", () => {
  it("저장한 기록을 그대로 읽는다", () => {
    const { store } = memoryStore();
    const day = sampleDay("2026-11-23");
    expect(saveDay(day, { store, today: "2026-11-23" })).toEqual({ ok: true });
    expect(getDay("2026-11-23", store)).toEqual(day);
    expect(loadDays(store)).toEqual({ "2026-11-23": day });
  });

  it("없는 날짜는 null, 아무것도 저장하지 않았으면 빈 결과", () => {
    const { store } = memoryStore();
    expect(getDay("2026-11-23", store)).toBeNull();
    expect(loadDays(store)).toEqual({});
  });

  it("같은 날짜를 저장하면 덮어쓴다", () => {
    const { store } = memoryStore();
    saveDay(sampleDay("2026-11-23"), { store, today: "2026-11-23" });
    const edited = buildDayRecord("2026-11-23", [walk, run], [rice, direct]);
    saveDay(edited, { store, today: "2026-11-23" });
    expect(Object.keys(loadDays(store))).toHaveLength(1);
    expect(getDay("2026-11-23", store)?.intakeKcal).toBe(633);
  });
});

describe("보관 기간: 기본 오늘 포함 최근 7일치", () => {
  it("보관 일수를 2로 주면 오늘과 어제만 남기고 오래된 기록은 저장할 때 지운다", () => {
    const { store } = memoryStore();
    const today = "2026-11-23";
    const opts = (t: string) => ({ store, today: t, retentionDays: 2 });
    saveDay(sampleDay("2026-11-22"), opts("2026-11-22"));
    saveDay(sampleDay("2026-11-21"), opts("2026-11-22")); // 이때는 아직 보관 기간 안
    saveDay(sampleDay(today), opts(today));
    expect(Object.keys(loadDays(store)).sort()).toEqual(["2026-11-22", "2026-11-23"]);
  });

  it("달이 바뀌는 경계에서도 맞다 (2일 보관 시 3월 1일엔 2월 28일까지)", () => {
    const { store } = memoryStore();
    const opts = (t: string) => ({ store, today: t, retentionDays: 2 });
    saveDay(sampleDay("2026-02-27"), opts("2026-02-27"));
    saveDay(sampleDay("2026-02-28"), opts("2026-02-28"));
    saveDay(sampleDay("2026-03-01"), opts("2026-03-01"));
    expect(Object.keys(loadDays(store)).sort()).toEqual(["2026-02-28", "2026-03-01"]);
  });

  it("보관 기간보다 오래된 날짜는 저장하지 않는다 (기본 7일: 8일 전은 거절)", () => {
    const { store } = memoryStore();
    expect(saveDay(sampleDay("2026-11-15"), { store, today: "2026-11-23" })).toEqual({
      ok: false,
      reason: "outside_retention",
    });
    expect(loadDays(store)).toEqual({});
  });

  it("기본값은 7일: 6일 전까지 저장되고 그 이전 기록은 지운다", () => {
    const { store } = memoryStore();
    for (let offset = 8; offset >= 0; offset--) {
      const date = addDays("2026-11-23", -offset);
      saveDay(sampleDay(date), { store, today: date });
    }
    const kept = Object.keys(loadDays(store)).sort();
    expect(kept).toHaveLength(7);
    expect(kept[0]).toBe("2026-11-17");
    expect(kept[6]).toBe("2026-11-23");
  });

  it("보관 일수를 직접 7로 줘도 같다", () => {
    const { store } = memoryStore();
    for (let offset = 8; offset >= 0; offset--) {
      const date = addDays("2026-11-23", -offset);
      saveDay(sampleDay(date), { store, today: date, retentionDays: 7 });
    }
    const kept = Object.keys(loadDays(store)).sort();
    expect(kept).toHaveLength(7);
    expect(kept[0]).toBe("2026-11-17");
    expect(kept[6]).toBe("2026-11-23");
  });
});

describe("깨진 저장 값과 저장 실패에도 앱이 멈추지 않는다", () => {
  it("JSON이 깨졌거나 버전·모양이 다르면 빈 결과", () => {
    for (const text of ["{깨짐", JSON.stringify({ version: 99, days: {} }), JSON.stringify([1, 2])]) {
      const { store } = memoryStore({ [DAYS_STORAGE_KEY]: text });
      expect(loadDays(store)).toEqual({});
    }
  });

  it("모양이 틀린 날짜만 버리고 나머지 기록은 살린다", () => {
    const good = sampleDay("2026-11-23");
    const text = JSON.stringify({
      version: 1,
      days: {
        "2026-11-23": good,
        "2026-11-22": { ...good, date: "2026-11-22", exercises: [{ exerciseId: "e002", minutes: -5, kcal: 1 }] },
        "2026-11-21": { ...good, date: "2026-11-20" }, // 키와 날짜가 다름
      },
    });
    const { store } = memoryStore({ [DAYS_STORAGE_KEY]: text });
    expect(Object.keys(loadDays(store))).toEqual(["2026-11-23"]);
  });

  it("저장된 합계가 틀려도 항목에서 다시 계산한다", () => {
    const good = sampleDay("2026-11-23");
    const text = JSON.stringify({
      version: 1,
      days: { "2026-11-23": { ...good, burnedKcal: 9999, intakeKcal: 1 } },
    });
    const { store } = memoryStore({ [DAYS_STORAGE_KEY]: text });
    expect(getDay("2026-11-23", store)).toMatchObject({ burnedKcal: 105, intakeKcal: 313 });
  });

  it("쓰기에 실패하면(용량 초과 등) 오류 대신 이유를 돌려준다", () => {
    const store: KeyValueStore = {
      getItem: () => null,
      setItem: () => { throw new Error("QuotaExceededError"); },
      removeItem: () => {},
    };
    expect(saveDay(sampleDay("2026-11-23"), { store, today: "2026-11-23" })).toEqual({
      ok: false,
      reason: "write_failed",
    });
  });

  it("읽기에서 오류가 나도 빈 결과", () => {
    const store: KeyValueStore = {
      getItem: () => { throw new Error("SecurityError"); },
      setItem: () => {},
      removeItem: () => {},
    };
    expect(loadDays(store)).toEqual({});
  });

  it("브라우저 저장소가 없으면(서버 실행·차단) 읽기는 빈 결과, 저장은 unavailable", () => {
    expect(loadDays(null)).toEqual({});
    expect(saveDay(sampleDay("2026-11-23"), { store: null, today: "2026-11-23" })).toEqual({
      ok: false,
      reason: "unavailable",
    });
    // 테스트 환경(node)에는 window가 없으므로 기본 저장소도 없는 것으로 취급된다
    expect(loadDays()).toEqual({});
    expect(saveDay(sampleDay("2026-11-23"), { today: "2026-11-23" })).toEqual({
      ok: false,
      reason: "unavailable",
    });
  });

  it("모양이 틀린 기록은 저장하지 않는다 (운동 시간 음수)", () => {
    const { store } = memoryStore();
    const bad = { ...sampleDay("2026-11-23"), exercises: [{ ...walk, minutes: -1 }] };
    expect(saveDay(bad, { store, today: "2026-11-23" })).toEqual({
      ok: false,
      reason: "invalid_record",
    });
  });
});

describe("저장된 기록의 상한 검사 (보안 점검 SEC-008)", () => {
  const store = () => {
    const data: Record<string, string> = {};
    return { getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => { data[k] = v; }, removeItem: (k: string) => { delete data[k]; }, data };
  };
  const stored = (day: unknown, date = "2026-03-03") => JSON.stringify({ version: 1, days: { [date]: day } });
  const food = { foodId: null, name: "x", unit: "serving", amount: 1, kcal: 100, carbs: 0, protein: 0, fat: 0, estimated: true };

  it("정상 범위 기록은 읽힌다", () => {
    const s = store();
    s.setItem("fitmeal:days", stored({ date: "2026-03-03", exercises: [], foods: [food] }));
    expect(Object.keys(loadDays(s))).toEqual(["2026-03-03"]);
  });

  it.each([
    ["운동 시간이 480분 초과", { exercises: [{ exerciseId: "e001", minutes: 9999, kcal: 10 }], foods: [] }],
    ["항목 칼로리가 비정상적으로 큼", { exercises: [], foods: [{ ...food, kcal: 9_999_999 }] }],
    ["음식 이름이 50자 초과", { exercises: [], foods: [{ ...food, name: "가".repeat(51) }] }],
    ["음식 양이 2,000 초과", { exercises: [], foods: [{ ...food, amount: 5000 }] }],
    ["하루 항목이 200개 초과", { exercises: [], foods: Array(201).fill(food) }],
  ])("%s → 그날 기록은 버린다", (_name, entries) => {
    const s = store();
    s.setItem("fitmeal:days", stored({ date: "2026-03-03", ...entries }));
    expect(loadDays(s)).toEqual({});
  });
});
