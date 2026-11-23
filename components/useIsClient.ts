"use client";

// 브라우저에서 화면이 붙은 뒤인지 알려 준다.
// 저장된 정보(내 정보·기록)는 브라우저에만 있어서, 이 값이 true가 된 뒤에 읽어야 서버 화면과 어긋나지 않는다.
import { useSyncExternalStore } from "react";

const subscribeNothing = () => () => {};

export function useIsClient(): boolean {
  return useSyncExternalStore(subscribeNothing, () => true, () => false);
}
