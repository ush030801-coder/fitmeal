// Plan SC: FR-01 / PLAN 작업 8번 — 내 정보 저장·읽기 확인
import { describe, expect, it } from "vitest";
import { loadProfile, PROFILE_STORAGE_KEY, saveProfile } from "@/lib/storage/profile";
import type { KeyValueStore } from "@/lib/storage/store";
import type { Profile } from "@/types";

function memoryStore(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  const store: KeyValueStore = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
  return store;
}

const profile: Profile = {
  sex: "female", age: 30, heightCm: 165, weightKg: 58.5,
  activity: 1.375, goal: "lose", allergies: ["egg", "peanut"],
};

describe("내 정보 저장", () => {
  it("저장한 정보를 그대로 읽는다", () => {
    const store = memoryStore();
    expect(saveProfile(profile, store)).toEqual({ ok: true });
    expect(loadProfile(store)).toEqual(profile);
  });

  it("저장하기 전에는 null", () => {
    expect(loadProfile(memoryStore())).toBeNull();
  });

  it("범위를 벗어난 정보는 저장하지 않는다 (만 17세)", () => {
    const store = memoryStore();
    expect(saveProfile({ ...profile, age: 17 }, store)).toEqual({
      ok: false,
      reason: "invalid_profile",
    });
    expect(loadProfile(store)).toBeNull();
  });

  it("저장된 값이 깨졌거나 범위를 벗어나면 null", () => {
    const bad = [
      "{깨짐",
      JSON.stringify({ version: 9, profile }),
      JSON.stringify({ version: 1, profile: { ...profile, weightKg: 5 } }),
      JSON.stringify({ version: 1 }),
    ];
    for (const text of bad) {
      expect(loadProfile(memoryStore({ [PROFILE_STORAGE_KEY]: text }))).toBeNull();
    }
  });

  it("저장소가 없거나 읽기·쓰기에 실패해도 오류 없이 처리", () => {
    expect(loadProfile(null)).toBeNull();
    expect(saveProfile(profile, null)).toEqual({ ok: false, reason: "unavailable" });
    const broken: KeyValueStore = {
      getItem: () => { throw new Error("SecurityError"); },
      setItem: () => { throw new Error("QuotaExceededError"); },
      removeItem: () => {},
    };
    expect(loadProfile(broken)).toBeNull();
    expect(saveProfile(profile, broken)).toEqual({ ok: false, reason: "write_failed" });
  });
});
