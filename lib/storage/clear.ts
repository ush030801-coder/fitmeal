// Design Ref: §3.2 브라우저 저장 위치 — 내 데이터 모두 지우기 (동의 철회와 공용 PC 대비)
// Plan SC: 보안 점검 SEC-009 — 저장한 정보(동의·내 정보·일별 기록)를 사용자가 직접 지울 수 있어야 한다
import { CONSENT_STORAGE_KEY } from "./consent";
import { PROFILE_STORAGE_KEY } from "./profile";
import { DAYS_STORAGE_KEY } from "./records";
import { getBrowserStore, type KeyValueStore } from "./store";

export const ALL_STORAGE_KEYS = [CONSENT_STORAGE_KEY, PROFILE_STORAGE_KEY, DAYS_STORAGE_KEY] as const;

// 이 앱이 브라우저에 저장한 값을 모두 지운다. 하나라도 못 지우면 false.
export function clearAllData(store: KeyValueStore | null = getBrowserStore()): boolean {
  if (!store) return false;
  let ok = true;
  for (const key of ALL_STORAGE_KEYS) {
    try {
      store.removeItem(key);
    } catch {
      ok = false; // 한 항목이 실패해도 나머지는 계속 지운다
    }
  }
  return ok;
}
