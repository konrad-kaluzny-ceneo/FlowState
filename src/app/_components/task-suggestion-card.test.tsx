import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TaskSuggestionCard } from "~/app/_components/task-suggestion-card";

const baseSuggestion = {
	taskId: 5,
	title: "Deep refactor",
	workType: "DEEP_WORK" as const,
	weight: 3 as const,
	rationale: "Deep work — you're focused with few interruptions",
};

const sampleBreakdown = {
	headline: baseSuggestion.rationale,
	dominant: [
		{
			key: "late_day" as const,
			copy: "Late in the day — lighter work may fit better",
		},
	],
	alsoConsidered: ["Cycles completed", "Energy fit"],
};

describe("TaskSuggestionCard", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("renders loading state", () => {
		render(<TaskSuggestionCard status="loading" />);

		expect(screen.getByTestId("task-suggestion-card")).toBeTruthy();
		expect(screen.getByText("Finding a good match…")).toBeTruthy();
	});

	it("shows skeleton after 300ms while loading", () => {
		render(<TaskSuggestionCard status="loading" />);

		act(() => {
			vi.advanceTimersByTime(300);
		});

		expect(screen.getByTestId("task-suggestion-card")).toBeTruthy();
		expect(screen.queryByText("Finding a good match…")).toBeNull();
	});

	it("shows slow message after 1s while loading", () => {
		render(<TaskSuggestionCard status="loading" />);

		act(() => {
			vi.advanceTimersByTime(1000);
		});

		expect(screen.getByText("Still working on it…")).toBeTruthy();
	});

	it("renders ready state with rationale and accept CTA", () => {
		const onAccept = vi.fn();

		render(
			<TaskSuggestionCard
				onAccept={onAccept}
				status="ready"
				suggestion={{
					taskId: 5,
					title: "Deep refactor",
					workType: "DEEP_WORK",
					weight: 3,
					rationale: "Deep work — you're focused with few interruptions",
				}}
			/>,
		);

		expect(screen.getByText("Deep refactor")).toBeTruthy();
		expect(
			screen.getByText("Deep work — you're focused with few interruptions"),
		).toBeTruthy();
		expect(screen.getByTestId("suggestion-accept-btn")).toBeTruthy();

		fireEvent.click(screen.getByTestId("suggestion-accept-btn"));
		expect(onAccept).toHaveBeenCalled();
	});

	it("renders empty state", () => {
		render(<TaskSuggestionCard status="empty" />);

		expect(
			screen.getByText("No active tasks — add one or end session."),
		).toBeTruthy();
	});

	it("renders error state with retry", () => {
		const onRetry = vi.fn();

		render(<TaskSuggestionCard onRetry={onRetry} status="error" />);

		expect(screen.getByText(/Could not load a suggestion/)).toBeTruthy();

		fireEvent.click(screen.getByRole("button", { name: "Retry" }));
		expect(onRetry).toHaveBeenCalled();
	});

	it("hides Why this? when breakdown is missing", () => {
		render(
			<TaskSuggestionCard
				onAccept={vi.fn()}
				status="ready"
				suggestion={baseSuggestion}
			/>,
		);

		expect(screen.queryByTestId("suggestion-rationale-toggle")).toBeNull();
	});

	it("hides Why this? when breakdown has no dominant or chip content", () => {
		render(
			<TaskSuggestionCard
				onAccept={vi.fn()}
				status="ready"
				suggestion={{
					...baseSuggestion,
					breakdown: {
						headline: baseSuggestion.rationale,
						dominant: [],
						alsoConsidered: [],
					},
				}}
			/>,
		);

		expect(screen.queryByTestId("suggestion-rationale-toggle")).toBeNull();
	});

	it("shows expander synchronously on toggle click without waiting on timers", () => {
		render(
			<TaskSuggestionCard
				onAccept={vi.fn()}
				status="ready"
				suggestion={{
					...baseSuggestion,
					breakdown: sampleBreakdown,
				}}
			/>,
		);

		expect(screen.queryByTestId("suggestion-rationale-expander")).toBeNull();

		fireEvent.click(screen.getByTestId("suggestion-rationale-toggle"));

		expect(screen.getByTestId("suggestion-rationale-expander")).toBeTruthy();
	});

	it("renders dominant copy and chip labels without duplicating the one-liner", () => {
		render(
			<TaskSuggestionCard
				onAccept={vi.fn()}
				status="ready"
				suggestion={{
					...baseSuggestion,
					breakdown: sampleBreakdown,
				}}
			/>,
		);

		fireEvent.click(screen.getByTestId("suggestion-rationale-toggle"));

		expect(
			screen.getByText("Late in the day — lighter work may fit better"),
		).toBeTruthy();
		expect(screen.getByText("Cycles completed")).toBeTruthy();
		expect(screen.getByText("Energy fit")).toBeTruthy();

		const rationaleMatches = screen.getAllByText(baseSuggestion.rationale);
		expect(rationaleMatches).toHaveLength(1);
	});

	it("toggles aria-expanded on the Why this? control", () => {
		render(
			<TaskSuggestionCard
				onAccept={vi.fn()}
				status="ready"
				suggestion={{
					...baseSuggestion,
					breakdown: sampleBreakdown,
				}}
			/>,
		);

		const toggle = screen.getByTestId("suggestion-rationale-toggle");
		expect(toggle.getAttribute("aria-expanded")).toBe("false");

		fireEvent.click(toggle);
		expect(toggle.getAttribute("aria-expanded")).toBe("true");

		fireEvent.click(toggle);
		expect(toggle.getAttribute("aria-expanded")).toBe("false");
	});

	it("shows ASAP badge when commitment horizon is ASAP", () => {
		render(
			<TaskSuggestionCard
				onAccept={vi.fn()}
				status="ready"
				suggestion={{
					...baseSuggestion,
					commitmentHorizon: "ASAP",
				}}
			/>,
		);

		expect(screen.getByTestId("suggestion-asap-badge")).toBeTruthy();
	});

	it("renders coachLine alongside expander without duplicate rationale stacking", () => {
		render(
			<TaskSuggestionCard
				coachLine="Pick a task to start your first focus block."
				onAccept={vi.fn()}
				status="ready"
				suggestion={{
					...baseSuggestion,
					breakdown: sampleBreakdown,
				}}
			/>,
		);

		expect(screen.getByTestId("suggestion-coach-line")).toBeTruthy();
		expect(
			screen.getByText("Pick a task to start your first focus block."),
		).toBeTruthy();
		expect(screen.getByTestId("suggestion-rationale-toggle")).toBeTruthy();
		expect(screen.getAllByText(baseSuggestion.rationale)).toHaveLength(1);
	});

	it("shows resume note below title when present", () => {
		render(
			<TaskSuggestionCard
				onAccept={vi.fn()}
				status="ready"
				suggestion={{
					...baseSuggestion,
					resumeNote: "left off at auth middleware",
				}}
			/>,
		);

		expect(screen.getByTestId("suggestion-resume-note").textContent).toContain(
			"left off at auth middleware",
		);
	});

	it("exposes a labelled suggestion region", () => {
		render(
			<TaskSuggestionCard
				onAccept={vi.fn()}
				status="ready"
				suggestion={baseSuggestion}
			/>,
		);

		expect(
			screen.getByRole("region", { name: "Suggested next task" }),
		).toBeTruthy();
	});

	it("announces status through one polite live region", () => {
		render(
			<TaskSuggestionCard
				onAccept={vi.fn()}
				status="ready"
				suggestion={baseSuggestion}
			/>,
		);

		const liveRegions = screen.getAllByTestId("suggestion-live-status");
		expect(liveRegions).toHaveLength(1);
		expect(liveRegions[0]?.getAttribute("aria-live")).toBe("polite");
		expect(screen.getByText("Suggestion ready: Deep refactor")).toBeTruthy();
	});

	it("updates polite status when loading becomes slow", () => {
		render(<TaskSuggestionCard status="loading" />);

		act(() => {
			vi.advanceTimersByTime(1000);
		});

		expect(screen.getByTestId("suggestion-live-status").textContent).toContain(
			"Still working on it…",
		);
	});

	it("wires aria-controls from Why this? to the rationale panel", () => {
		render(
			<TaskSuggestionCard
				onAccept={vi.fn()}
				status="ready"
				suggestion={{
					...baseSuggestion,
					breakdown: sampleBreakdown,
				}}
			/>,
		);

		const toggle = screen.getByTestId("suggestion-rationale-toggle");
		expect(toggle.getAttribute("aria-controls")).toBe(
			"task-suggestion-rationale-panel",
		);

		fireEvent.click(toggle);

		expect(screen.getByTestId("suggestion-rationale-expander").id).toBe(
			"task-suggestion-rationale-panel",
		);
	});
});
