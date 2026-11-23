// Plan SC: FR-02 / PLAN 작업 7번 — 동의 저장·읽기 확인
import { describe, expect, it } from "vitest";
import { CONSENT_STORAGE_KEY, hasConsent, saveConsent } from "@/lib/storage/consent";
import type { KeyValueStore } from "@/lib/storage/store";

function memoryStore(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  const store: KeyValueStore = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
  return store;
}

describe("AI 전송 동의", () => {
  it("저장하기 전에는 동의하지 않은 것", () => {
    expect(hasConsent(memoryStore())).toBe(false);
  });

  it("저장하면 동의한 것으로 읽힌다", () => {
    const store = memoryStore();
    expect(saveConsent(store)).toEqual({ ok: true });
    expect(hasConsent(store)).toBe(true);
  });

  it("값이 깨졌거나 모양·버전이 다르면 동의 안 함", () => {
    for (const text of ["{깨짐", "null", JSON.stringify({ version: 1, agreed: false }), JSON.stringify({ version: 9, agreed: true })]) {
      expect(hasConsent(memoryStore({ [CONSENT_STORAGE_KEY]: text }))).toBe(false);
    }
  });

  it("저장소가 없거나 읽기·쓰기에 실패해도 오류 없이 처리", () => {
    expect(hasConsent(null)).toBe(false);
    expect(saveConsent(null)).toEqual({ ok: false, reason: "unavailable" });
    const broken: KeyValueStore = {
      getItem: () => { throw new Error("SecurityError"); },
      setItem: () => { throw new Error("QuotaExceededError"); },
      removeItem: () => {},
    };
    expect(hasConsent(broken)).toBe(false);
    expect(saveConsent(broken)).toEqual({ ok: false, reason: "write_failed" });
  });
});
