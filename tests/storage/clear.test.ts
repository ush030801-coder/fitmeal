// Plan SC: 보안 점검 SEC-009 — 내 데이터 모두 지우기
import { describe, expect, it } from "vitest";
import { ALL_STORAGE_KEYS, clearAllData } from "@/lib/storage/clear";
import type { KeyValueStore } from "@/lib/storage/store";

function fakeStore(initial: Record<string, string>, failOn?: string): KeyValueStore & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => { data[k] = v; },
    removeItem: (k) => { if (k === failOn) throw new Error("fail"); delete data[k]; },
  };
}

describe("내 데이터 모두 지우기", () => {
  it("동의·내 정보·일별 기록을 모두 지우고 다른 사이트 값은 건드리지 않는다", () => {
    const store = fakeStore({ "fitmeal:consent": "a", "fitmeal:profile": "b", "fitmeal:days": "c", other: "keep" });
    expect(clearAllData(store)).toBe(true);
    expect(store.data).toEqual({ other: "keep" });
    expect(ALL_STORAGE_KEYS).toHaveLength(3);
  });

  it("저장소를 못 쓰면 false", () => {
    expect(clearAllData(null)).toBe(false);
  });

  it("한 항목을 못 지워도 나머지는 지우고 false를 알린다", () => {
    const store = fakeStore({ "fitmeal:consent": "a", "fitmeal:profile": "b", "fitmeal:days": "c" }, "fitmeal:profile");
    expect(clearAllData(store)).toBe(false);
    expect(store.data).toEqual({ "fitmeal:profile": "b" });
  });
});
