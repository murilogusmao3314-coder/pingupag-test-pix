import content from "./content.json";

export const QUIZ_SESSION_KEY = "monster-quiz-session-v1";
export type QuizScreen = "welcome" | "quiz" | "checking" | "result";
export interface QuizSession {
  screen: QuizScreen;
  index: number;
  answers: Record<number, number>;
  deadline: number | null;
}

/** Restore only quiz preferences; never store checkout/customer information. */
export function restoreQuizSession(raw: string | null, now = Date.now()): QuizSession | null {
  if (!raw) return null;
  try {
    const saved: unknown = JSON.parse(raw);
    if (!saved || typeof saved !== "object") return null;
    const value = saved as Record<string, unknown>;
    if (
      value["version"] !== 1 ||
      !["welcome", "quiz", "checking", "result"].includes(String(value["screen"]))
    )
      return null;
    const index = value["index"];
    if (
      typeof index !== "number" ||
      !Number.isInteger(index) ||
      index < 0 ||
      index >= content.quiz_questions.length
    )
      return null;
    const answers = value["answers"];
    if (!answers || typeof answers !== "object" || Array.isArray(answers)) return null;
    const valid: Record<number, number> = {};
    for (const [key, answer] of Object.entries(answers)) {
      const question = Number(key);
      if (
        String(question) !== key ||
        !Number.isInteger(question) ||
        typeof answer !== "number" ||
        !Number.isInteger(answer) ||
        !content.quiz_questions[question]?.options[answer]
      )
        return null;
      valid[question] = answer;
    }
    const screen = value["screen"] === "checking" ? "result" : (value["screen"] as QuizScreen);
    if (screen === "result" && Object.keys(valid).length !== content.quiz_questions.length)
      return null;
    const deadline =
      typeof value["deadline"] === "number" &&
      Number.isFinite(value["deadline"]) &&
      value["deadline"] > 0
        ? value["deadline"]
        : null;
    return {
      screen,
      index,
      answers: valid,
      deadline: screen === "result" ? (deadline ?? now + 600000) : deadline,
    };
  } catch {
    return null;
  }
}

export function serializeQuizSession(session: QuizSession): string {
  return JSON.stringify({
    version: 1,
    screen: session.screen,
    index: session.index,
    answers: session.answers,
    deadline: session.deadline,
  });
}

export function quizPreferences(answers: Record<number, number>): string {
  const place = content.quiz_questions[1]?.options[answers[1] ?? -1]?.text;
  const flavor = content.quiz_questions[3]?.options[answers[3] ?? -1]?.text;
  return [place, flavor ? `Monster ${flavor}` : null].filter(Boolean).join(" · ");
}
