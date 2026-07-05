import {
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IntlTestWrapper } from "~/i18n/test-intl";
import type { DomainTask } from "~/lib/data-mode/types";
import { defaultEisenhowerFields } from "~/lib/data-mode/types";

import { TaskArchiveView } from "./task-archive-view";

const refreshArchive = vi.fn().mockResolvedValue(undefined);
const onBack = vi.fn();
const onTasksChanged = vi.fn().mockResolvedValue(undefined);
const restoreTask = vi.fn().mockResolvedValue(undefined);
const deleteArchivedTasks = vi.fn().mockResolvedValue(undefined);
const clearError = vi.fn();

let archiveTasks: DomainTask[] = [];
let archiveLoading = false;

vi.mock("~/hooks/use-archive-tasks", () => ({
	useArchiveTasks: () => ({
		tasks: archiveTasks,
		isLoading: archiveLoading,
		refresh: refreshArchive,
	}),
}));

vi.mock("~/hooks/use-task-mutations", () => ({
	useTaskMutations: () => ({
		restoreTask,
		deleteArchivedTasks,
		isMutating: false,
		error: null,
		clearError,
	}),
}));

function makeArchivedTask(overrides: Partial<DomainTask> = {}): DomainTask {
	return {
		id: 1,
		title: "Stale task",
		status: "archived",
		userId: "user-1",
		createdAt: new Date("2026-06-01"),
		updatedAt: new Date("2026-06-10"),
		archivedAt: new Date("2026-06-20"),
		workType: "OPERATIONAL",
		weight: 2,
		...defaultEisenhowerFields(2),
		sortOrder: 0,
		resumeNote: null,
		project: null,
		personaPresetId: null,
		isDailyStanding: false,
		...overrides,
	};
}

function renderArchiveView(ui: ReactElement) {
	return render(<IntlTestWrapper>{ui}</IntlTestWrapper>);
}

describe("TaskArchiveView", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		archiveTasks = [];
		archiveLoading = false;
	});

	it("shows empty state when there are no archived tasks", () => {
		renderArchiveView(
			<TaskArchiveView onBack={onBack} onTasksChanged={onTasksChanged} />,
		);

		expect(screen.getByTestId("task-archive-empty")).toBeTruthy();
		expect(screen.getByText("No archived tasks")).toBeTruthy();
	});

	it("renders archived tasks without cycle controls", () => {
		archiveTasks = [
			makeArchivedTask({ id: 1, title: "Old report" }),
			makeArchivedTask({ id: 2, title: "Forgotten chore" }),
		];

		renderArchiveView(
			<TaskArchiveView onBack={onBack} onTasksChanged={onTasksChanged} />,
		);

		const rows = screen.getAllByTestId("archived-task-row");
		expect(rows).toHaveLength(2);
		expect(screen.getByText("Old report")).toBeTruthy();
		expect(screen.queryByRole("button", { name: "Focus" })).toBeNull();
		expect(screen.queryByTestId("task-drag-handle")).toBeNull();
		expect(screen.queryByRole("button", { name: "Mark complete" })).toBeNull();
	});

	it("supports multi-select, select-all, and selected count", () => {
		archiveTasks = [
			makeArchivedTask({ id: 1, title: "First" }),
			makeArchivedTask({ id: 2, title: "Second" }),
		];

		renderArchiveView(
			<TaskArchiveView onBack={onBack} onTasksChanged={onTasksChanged} />,
		);

		const rows = screen.getAllByTestId("archived-task-row");
		fireEvent.click(
			within(rows[0] as HTMLElement).getByTestId("archived-task-checkbox"),
		);
		expect(screen.getByTestId("task-archive-selected-count").textContent).toBe(
			"1 selected",
		);

		fireEvent.click(screen.getByTestId("task-archive-select-all"));
		expect(screen.getByTestId("task-archive-selected-count").textContent).toBe(
			"2 selected",
		);

		fireEvent.click(screen.getByTestId("task-archive-select-all"));
		expect(screen.queryByTestId("task-archive-selected-count")).toBeNull();
	});

	it("restores a single archived task", async () => {
		archiveTasks = [makeArchivedTask({ id: 7, title: "Bring back" })];

		renderArchiveView(
			<TaskArchiveView onBack={onBack} onTasksChanged={onTasksChanged} />,
		);

		fireEvent.click(screen.getByTestId("archived-task-restore"));

		await waitFor(() => {
			expect(restoreTask).toHaveBeenCalledWith({ id: 7 });
		});
		expect(refreshArchive).toHaveBeenCalled();
		expect(onTasksChanged).toHaveBeenCalled();
	});

	it("requires confirmation before deleting selected tasks", async () => {
		archiveTasks = [
			makeArchivedTask({ id: 1, title: "Delete me" }),
			makeArchivedTask({ id: 2, title: "Keep for now" }),
		];

		renderArchiveView(
			<TaskArchiveView onBack={onBack} onTasksChanged={onTasksChanged} />,
		);

		fireEvent.click(
			within(
				screen.getAllByTestId("archived-task-row")[0] as HTMLElement,
			).getByTestId("archived-task-checkbox"),
		);
		fireEvent.click(screen.getByTestId("task-archive-delete-selected"));
		expect(screen.getByTestId("task-archive-delete-confirm")).toBeTruthy();

		fireEvent.click(screen.getByTestId("task-archive-delete-cancel-btn"));
		expect(screen.queryByTestId("task-archive-delete-confirm")).toBeNull();
		expect(deleteArchivedTasks).not.toHaveBeenCalled();
	});

	it("deletes selected archived tasks after confirmation", async () => {
		archiveTasks = [
			makeArchivedTask({ id: 1, title: "Delete me" }),
			makeArchivedTask({ id: 2, title: "Delete me too" }),
		];

		renderArchiveView(
			<TaskArchiveView onBack={onBack} onTasksChanged={onTasksChanged} />,
		);

		fireEvent.click(screen.getByTestId("task-archive-select-all"));
		fireEvent.click(screen.getByTestId("task-archive-delete-selected"));
		fireEvent.click(screen.getByTestId("task-archive-delete-confirm-btn"));

		await waitFor(() => {
			expect(deleteArchivedTasks).toHaveBeenCalledWith({ ids: [1, 2] });
		});
		expect(screen.queryByTestId("task-archive-selected-count")).toBeNull();
		expect(refreshArchive).toHaveBeenCalled();
		expect(onTasksChanged).toHaveBeenCalled();
	});

	it("navigates back to inventory", () => {
		renderArchiveView(
			<TaskArchiveView onBack={onBack} onTasksChanged={onTasksChanged} />,
		);

		fireEvent.click(screen.getByTestId("task-archive-back"));
		expect(onBack).toHaveBeenCalledTimes(1);
	});
});
