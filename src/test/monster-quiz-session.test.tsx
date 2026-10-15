import type { ComponentType } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Route } from "../routes/index";
import {
  QUIZ_SESSION_KEY,
  quizPreferences,
  restoreQuizSession,
  serializeQuizSession,
} from "../components/monster/quiz-session";
import content from "../components/monster/content.json";

const Experience = Route.options.component as ComponentType;

beforeEach(() => {
  sessionStorage.clear();
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  sessionStorage.clear();
});

describe("Quiz continuity", () => {
  it("shows every original question and option, locks transitions and restores the result", () => {
    const view = render(<Experience />);
    fireEvent.click(screen.getByRole("button", { name: "Começar o desafio" }));
    for (const [index, question] of content.quiz_questions.entries()) {
      expect(screen.getByRole("heading", { name: question.question })).toHaveFocus();
      const buttons = screen.getByRole("group").querySelectorAll("button");
      expect(buttons).toHaveLength(question.options.length);
      question.options.forEach((option, optionIndex) =>
        expect(buttons[optionIndex]).toHaveTextContent(option.text),
      );
      fireEvent.click(buttons[0]!);
      expect(buttons[0]).toBeDisabled();
      expect(screen.getByText(`Pergunta`, { exact: false })).toHaveTextContent(
        `Pergunta ${index + 1} de 9`,
      );
      act(() => {
        vi.advanceTimersByTime(330);
      });
    }
    expect(screen.getByRole("status")).toHaveTextContent("Validando");
    act(() => {
      vi.advanceTimersByTime(2800);
    });
    expect(screen.getByRole("heading", { name: /Você ganhou/ })).toBeInTheDocument();
    expect(screen.getByText("Na academia · Monster Original")).toBeInTheDocument();
    const firstDeadline = JSON.parse(sessionStorage.getItem(QUIZ_SESSION_KEY)!).deadline;
    view.unmount();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    render(<Experience />);
    expect(screen.getByRole("heading", { name: /Você ganhou/ })).toBeInTheDocument();
    expect(JSON.parse(sessionStorage.getItem(QUIZ_SESSION_KEY)!).deadline).toBe(firstDeadline);
  });

  it("resumes the current question and retains previous choices when going back", () => {
    sessionStorage.setItem(
      QUIZ_SESSION_KEY,
      serializeQuizSession({ screen: "quiz", index: 2, answers: { 0: 0, 1: 2 }, deadline: null }),
    );
    render(<Experience />);
    expect(
      screen.getByRole("heading", { name: "Quantas latas você toma por semana?" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "← Voltar" }));
    expect(screen.getByRole("button", { name: "No carro" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("rejects corrupt or out-of-range sessions and serializes no checkout data", () => {
    expect(restoreQuizSession("broken")).toBeNull();
    expect(
      restoreQuizSession(
        JSON.stringify({ version: 1, screen: "result", index: 0, answers: {}, deadline: null }),
      ),
    ).toBeNull();
    expect(
      restoreQuizSession(
        JSON.stringify({ version: 1, screen: "quiz", index: 0, answers: { 0: 3 }, deadline: null }),
      ),
    ).toBeNull();
    const serialized = serializeQuizSession({
      screen: "quiz",
      index: 0,
      answers: {},
      deadline: null,
      ...{ email: "private@example.invalid" },
    });
    expect(serialized).not.toContain("private");
    expect(quizPreferences({ 1: 2, 3: 1 })).toBe("No carro · Monster Mango Loco");
  });
});
