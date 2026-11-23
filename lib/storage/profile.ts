// Design Ref: §3.2 브라우저 저장 위치(`fitmeal:profile`) — 사용자 정보는 브라우저에만 둔다 (이름·연락처 없음)
// Plan SC: FR-01 — 한 번 입력한 정보는 다시 열어도 남아 있다
import { validateProfile } from "@/lib/validation/profile";
import type { Profile } from "@/types";
import { getBrowserStore, type KeyValueStore } from "./store";

export const PROFILE_STORAGE_KEY = "fitmeal:profile";
const PROFILE_VERSION = 1;

// 저장된 사용자 정보를 읽는다. 없거나, 깨졌거나, 입력 범위 검사를 통과하지 못하면 null.
export function loadProfile(
  store: KeyValueStore | null = getBrowserStore(),
): Profile | null {
  if (!store) return null;
  try {
    const text = store.getItem(PROFILE_STORAGE_KEY);
    if (text === null) return null;
    const json: unknown = JSON.parse(text);
    if (json === null || typeof json !== "object") return null;
    const file = json as Record<string, unknown>;
    if (file.version !== PROFILE_VERSION) return null;
    const result = validateProfile(file.profile);
    return result.ok ? result.value : null;
  } catch {
    return null;
  }
}

export type SaveProfileResult =
  | { ok: true }
  | { ok: false; reason: "unavailable" | "write_failed" | "invalid_profile" };

// 사용자 정보를 저장한다. 범위 검사를 통과한 값만 저장하고, 실패해도 오류를 던지지 않는다.
export function saveProfile(
  profile: Profile,
  store: KeyValueStore | null = getBrowserStore(),
): SaveProfileResult {
  if (!store) return { ok: false, reason: "unavailable" };
  const checked = validateProfile(profile);
  if (!checked.ok) return { ok: false, reason: "invalid_profile" };
  try {
    store.setItem(
      PROFILE_STORAGE_KEY,
      JSON.stringify({ version: PROFILE_VERSION, profile: checked.value }),
    );
    return { ok: true };
  } catch {
    return { ok: false, reason: "write_failed" };
  }
}
