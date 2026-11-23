// 계산·검증 함수를 자동으로 채점하는 vitest 설정 (화면 없이 함수만 확인한다)
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// 코드의 "@/..." 경로가 테스트에서도 프로젝트 맨 위 폴더를 가리키게 한다
const projectRoot = fileURLToPath(new URL("./", import.meta.url)).replace(
  /[\\/]$/,
  "",
);

export default defineConfig({
  resolve: { alias: { "@": projectRoot } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
