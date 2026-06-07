import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TaskSuggestionCard } from "~/app/_components/task-suggestion-card";

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
});
