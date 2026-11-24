import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// 보안 헤더 (보안 점검 SEC-002): 다른 사이트 안에 끼워 넣기 차단, 스크립트·연결 대상 제한 등
// 스크립트는 Next가 화면에 넣는 인라인 스크립트 때문에 'unsafe-inline'을 허용한다.
// (더 엄격하게 하려면 요청마다 nonce를 만드는 방식이 필요하다. 개발 모드는 핫리로드 때문에 eval·ws도 허용)
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false, // "X-Powered-By: Next.js" 노출 끄기
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
