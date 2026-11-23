"use client";

// Design Ref: §5.2 화면 흐름 — 동의가 없으면 동의 화면으로 자동 이동한다
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { hasConsent } from "@/lib/storage/consent";

export default function ConsentGuard() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (pathname !== "/consent" && !hasConsent()) {
      router.replace("/consent");
    }
  }, [pathname, router]);

  return null;
}
