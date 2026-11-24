// Design Ref: §4.2 AI 호출 규칙 — 호출 실패와 검증 실패를 합쳐 한 번의 추천 요청에서 AI 호출은 최대 2회
// 흐름: AI 답변 → 모양 검사 → 서버 계산 → 규칙 검증 → (범위·단백질만 어긋나면) 서버가 인분 수 조정 → 다시 검증
// Plan SC: FR-06 / PRD 예외 처리 5 — 규칙에 어긋난 식단은 보여주지 않고, 그래도 안 되면 안내만 한다
import { FOODS } from "@/data/foods";
import { adjustServings } from "./adjust";
import { AiMisconfiguredError, AiUnavailableError, requestMenuText } from "./client";
import { buildMenu, parseAiMenu, type Meal, type Totals } from "./menu";
import { buildCandidates, buildMessages, type ChatMessage } from "./prompt";
import type { MenuRequest } from "./request";
import { validateMenu } from "./validate";

export const MAX_AI_CALLS = 2; // 첫 호출 + 다시 호출 1회

export type RecommendResult =
  // adjusted: 서버가 인분 수를 조금 조정해 규칙에 맞췄는지 (안내 문구에 쓴다)
  | { ok: true; meals: Meal[]; totals: Totals; adjusted: boolean; aiCalls: number }
  // rule_violation: 다시 요청해도 규칙 위반 / unavailable: AI 호출 실패 / misconfigured: 서버 설정 문제
  | { ok: false; reason: "rule_violation" | "unavailable" | "misconfigured"; aiCalls: number };

type Ask = (messages: ChatMessage[]) => Promise<string>;

// 규칙에 어긋난 지난 답변을 이유와 함께 알려 주며 다시 요청하는 메시지
function retryMessages(
  base: ChatMessage[],
  previousAnswer: string,
  problems: string[],
): ChatMessage[] {
  return [
    ...base,
    { role: "assistant", content: previousAnswer },
    {
      role: "user",
      content: [
        "방금 답변은 아래 규칙을 어겼다. 같은 규칙을 모두 지켜서 식단 전체를 다시 만들어라.",
        ...problems.map((p) => `- ${p}`),
        "고칠 때는 한 번에 너무 많이 바꾸지 말고, 음식 몇 개의 인분 수만 조절해서 허용 범위의 가운데에 맞춘다. 답하기 전에 합계를 직접 다시 계산한다.",
      ].join("\n"),
    },
  ];
}

// 식단을 추천한다. ask는 AI를 한 번 부르는 함수이고, 테스트에서는 가짜로 바꿔 끼운다.
export async function recommendMenu(
  request: MenuRequest,
  ask: Ask = requestMenuText,
): Promise<RecommendResult> {
  const candidates = buildCandidates(request.allergies);
  const candidateIds = new Set(candidates.map((food) => food.id));
  const foodsById = new Map(FOODS.map((food) => [food.id, food]));
  const baseMessages = buildMessages(request, candidates);

  let messages = baseMessages;
  let lastFailure: "rule_violation" | "unavailable" = "unavailable";
  let calls = 0;

  while (calls < MAX_AI_CALLS) {
    calls += 1;

    let text: string;
    try {
      text = await ask(messages);
    } catch (error) {
      // 서버 설정 문제(키 없음)는 다시 불러도 소용없으므로 바로 끝낸다
      if (error instanceof AiMisconfiguredError) return { ok: false, reason: "misconfigured", aiCalls: calls };
      if (!(error instanceof AiUnavailableError)) throw error;
      lastFailure = "unavailable";
      continue; // 호출 실패: 같은 요청으로 한 번 더
    }

    const parsed = parseAiMenu(text, candidateIds);
    let problems: string[];
    if (!parsed.ok) {
      problems = [parsed.reason];
    } else {
      const built = buildMenu(parsed.menu, foodsById);
      const violations = validateMenu(built, request, foodsById);
      if (violations.length === 0) return { ok: true, ...built, adjusted: false, aiCalls: calls };
      problems = violations.map((v) => v.message);

      // 알레르기 음식은 양을 바꿔도 해결되지 않으므로 조정하지 않고 AI에게 다시 요청한다.
      // 그 밖의 위반(허용 범위·하한·단백질)은 서버가 인분 수만 조금 조정해 맞춰 본다.
      if (violations.every((v) => v.rule !== "allergen")) {
        const fixed = adjustServings(parsed.menu, request, foodsById);
        if (fixed.ok) {
          const rebuilt = buildMenu(fixed.menu, foodsById);
          // 조정한 식단도 같은 검증을 다시 통과해야 보여준다
          if (validateMenu(rebuilt, request, foodsById).length === 0) {
            return { ok: true, ...rebuilt, adjusted: true, aiCalls: calls };
          }
        }
      }
    }

    lastFailure = "rule_violation";
    messages = retryMessages(baseMessages, text, problems);
  }

  return { ok: false, reason: lastFailure, aiCalls: calls };
}
