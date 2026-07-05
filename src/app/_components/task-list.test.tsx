import type { DragEndEvent } from "@dnd-kit/core";
import {
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import type { ComponentProps, ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IntlTestWrapper } from "~/i18n/test-intl";
import type { DomainTask } from "~/lib/data-mode/types";
import { defaultEisenhowerFields } from "~/lib/data-mode/types";

import { TaskList } from "./task-list";

const dndTestState = {
	onDragEndRef: null as ((event: DragEndEvent) => void) | null,
};

vi.mock("@dnd-kit/core", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@dnd-kit/core")>();
	const React = await import("react");

	function DndContext(props: ComponentProps<typeof actual.DndContext>) {
		dndTestState.onDragEndRef = props.onDragEnd ?? null;
		return React.createElement(actual.DndContext, props);
	}

	return { ...actual, DndContext };
});

const updateTask = vi.fn().mockResolvedValue(undefined);
const createTask = vi.fn().mockResolvedValue(undefined);
const deleteTask = vi.fn().mockResolvedValue(undefined);
const reorderTasks = vi.fn().mockResolvedValue(undefined);
const markDoneForToday = vi.fn().mockResolvedValue(undefined);
const clearError = vi.fn();
const onFocusTask = vi.fn();

vi.mock("~/hooks/use-task-mutations", () => ({
	useTaskMutations: () => ({
		createTask,
		updateTask,
		deleteTask,
		reorderTasks,
		markDoneForToday,
		isMutating: false,
		isCreating: false,
		error: null,
		clearError,
	}),
}));

vi.mock("~/lib/data-mode/data-mode-context", () => ({
	useDataMode: () => "authenticated",
}));

function makeTask(overrides: Partial<DomainTask> = {}): DomainTask {
	const { resumeNote = null, personaPresetId = null, ...rest } = overrides;
	return {
		id: 1,
		title: "Short title",
		status: "active",
		userId: "user-1",
		createdAt: new Date(),
		updatedAt: new Date(),
		workType: "OPERATIONAL",
		weight: 2,
		...defaultEisenhowerFields(2),
		sortOrder: 0,
		resumeNote,
		project: null,
		personaPresetId,
		archivedAt: null,
		...rest,
	};
}

const defaultProps = {
	tasks: [makeTask()],
	onRefresh: vi.fn().mockResolvedValue(undefined),
	focusedTaskId: null,
	onFocusTask,
	cycleState: "idle" as const,
};

function renderTaskList(ui: ReactElement) {
	return render(<IntlTestWrapper>{ui}</IntlTestWrapper>);
}

describe("TaskList", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("shows tri-tab sections with counts", () => {
		renderTaskList(
			<TaskList
				{...defaultProps}
				tasks={[
					makeTask({ id: 1, title: "Active one", status: "active" }),
					makeTask({ id: 2, title: "Planned one", status: "planned" }),
					makeTask({ id: 3, title: "Done one", status: "completed" }),
					makeTask({
						id: 4,
						title: "Archived one",
						status: "archived",
						archivedAt: new Date("2026-06-20"),
					}),
				]}
			/>,
		);

		expect(screen.getByText("Active (1)")).toBeTruthy();
		expect(screen.getByText("Planned (1)")).toBeTruthy();
		expect(screen.getByText("Completed (1)")).toBeTruthy();
		expect(screen.getByRole("button", { name: "Active one" })).toBeTruthy();
		expect(screen.queryByRole("button", { name: "Archived one" })).toBeNull();
	});

	it("shows only the type chip and effort badge on the card", () => {
		renderTaskList(
			<TaskList
				{...defaultProps}
				tasks={[makeTask({ workType: "DEEP_WORK", effortMinutes: 25 })]}
			/>,
		);

		expect(screen.getByTestId("task-type-badge").textContent).toBe("Deep");
		expect(screen.getByTestId("task-effort-badge").textContent).toBe("25m");
		expect(screen.queryByTestId("task-persona-badge")).toBeNull();
		expect(screen.queryByTestId("task-custom-badge")).toBeNull();
	});

	it("switches to the Planned tab and shows planned tasks", () => {
		renderTaskList(
			<TaskList
				{...defaultProps}
				tasks={[
					makeTask({ id: 1, title: "Active one", status: "active" }),
					makeTask({ id: 2, title: "Planned one", status: "planned" }),
				]}
			/>,
		);

		fireEvent.click(screen.getByRole("tab", { name: "Planned (1)" }));

		expect(screen.getByRole("button", { name: "Planned one" })).toBeTruthy();
		expect(screen.queryByRole("button", { name: "Active one" })).toBeNull();
	});

	it("shows planned empty state", () => {
		renderTaskList(<TaskList {...defaultProps} />);

		fireEvent.click(screen.getByRole("tab", { name: "Planned (0)" }));

		expect(screen.getByText("No planned tasks yet")).toBeTruthy();
	});

	it("opens the detail panel when clicking a task title", () => {
		renderTaskList(<TaskList {...defaultProps} />);

		fireEvent.click(screen.getByRole("button", { name: "Short title" }));

		expect(screen.getByTestId("task-detail-panel")).toBeTruthy();
		expect(screen.getByTestId("task-fields-panel-edit")).toBeTruthy();
	});

	it("shows the status pill in the detail panel", () => {
		renderTaskList(
			<TaskList {...defaultProps} tasks={[makeTask({ status: "planned" })]} />,
		);

		fireEvent.click(screen.getByRole("tab", { name: "Planned (1)" }));
		fireEvent.click(screen.getByRole("button", { name: "Short title" }));

		expect(screen.getByTestId("task-detail-status-pill").textContent).toBe(
			"Planned",
		);
	});

	it("commits detail panel edits (including project) on close", async () => {
		renderTaskList(<TaskList {...defaultProps} />);

		fireEvent.click(screen.getByRole("button", { name: "Short title" }));
		fireEvent.change(screen.getByTestId("task-fields-title"), {
			target: { value: "Updated title" },
		});
		fireEvent.change(screen.getByTestId("task-project-input"), {
			target: { value: "Rocket" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Close" }));

		await waitFor(() => {
			expect(updateTask).toHaveBeenCalledWith(
				expect.objectContaining({
					id: 1,
					title: "Updated title",
					project: "Rocket",
				}),
			);
		});
	});

	it("starts focus from the detail panel and promotes/focuses the task", () => {
		renderTaskList(
			<TaskList {...defaultProps} tasks={[makeTask({ status: "planned" })]} />,
		);

		fireEvent.click(screen.getByRole("tab", { name: "Planned (1)" }));
		fireEvent.click(screen.getByRole("button", { name: "Short title" }));
		fireEvent.click(
			screen.getByRole("button", { name: "Start working on this task" }),
		);

		expect(onFocusTask).toHaveBeenCalledWith(
			1,
			expect.objectContaining({ id: 1 }),
		);
		expect(screen.queryByTestId("task-detail-panel")).toBeNull();
	});

	it("opens the add-task modal and creates a task with project", async () => {
		renderTaskList(<TaskList {...defaultProps} />);

		fireEvent.click(screen.getByTestId("open-add-task-modal"));
		expect(screen.getByTestId("add-task-modal")).toBeTruthy();

		fireEvent.change(screen.getByTestId("task-fields-title"), {
			target: { value: "New task" },
		});
		fireEvent.change(screen.getByTestId("task-project-input"), {
			target: { value: "Launch" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Add task" }));

		await waitFor(() => {
			expect(createTask).toHaveBeenCalledWith(
				expect.objectContaining({ title: "New task", project: "Launch" }),
			);
		});
		expect(screen.queryByTestId("add-task-modal")).toBeNull();
	});

	it("carries the quick-add input text into the add-task modal title", () => {
		renderTaskList(<TaskList {...defaultProps} />);

		fireEvent.change(screen.getByPlaceholderText("Add a new task..."), {
			target: { value: "Drafted title" },
		});
		fireEvent.click(screen.getByTestId("open-add-task-modal"));

		expect(
			(screen.getByTestId("task-fields-title") as HTMLTextAreaElement).value,
		).toBe("Drafted title");
		expect(
			(screen.getByPlaceholderText("Add a new task...") as HTMLInputElement)
				.value,
		).toBe("");
	});

	it("creates a planned task via the quick-add input", async () => {
		renderTaskList(<TaskList {...defaultProps} />);

		fireEvent.change(screen.getByPlaceholderText("Add a new task..."), {
			target: { value: "Quick task" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Add" }));

		await waitFor(() => {
			expect(createTask).toHaveBeenCalledWith({
				title: "Quick task",
				isDailyStanding: false,
			});
		});
	});

	it("shows drag handles and reorders active tasks", () => {
		renderTaskList(
			<TaskList
				{...defaultProps}
				tasks={[
					makeTask({ id: 1, title: "First", sortOrder: 0 }),
					makeTask({ id: 2, title: "Second", sortOrder: 1 }),
				]}
			/>,
		);

		const handles = screen.getAllByTestId("task-drag-handle");
		expect(handles).toHaveLength(2);

		dndTestState.onDragEndRef?.({
			active: { id: "1" },
			over: { id: "2" },
		} as DragEndEvent);

		expect(reorderTasks).toHaveBeenCalledWith({ orderedIds: [2, 1] });
	});

	it("marks a task complete with the completion animation", () => {
		renderTaskList(
			<TaskList
				{...defaultProps}
				tasks={[makeTask({ id: 1, title: "Finish me" })]}
			/>,
		);

		const row = screen.getByTestId("active-task-row");
		expect(row.className).not.toContain("animate-task-complete");

		fireEvent.click(screen.getByRole("button", { name: "Mark complete" }));

		expect(row.className).toContain("animate-task-complete");
		expect(updateTask).toHaveBeenCalledWith({ id: 1, status: "completed" });
	});

	it("reverts a completed task back to active", () => {
		renderTaskList(
			<TaskList
				{...defaultProps}
				tasks={[makeTask({ id: 1, title: "Done", status: "completed" })]}
			/>,
		);

		fireEvent.click(screen.getByRole("tab", { name: "Completed (1)" }));
		fireEvent.click(screen.getByRole("button", { name: "Revert to active" }));

		expect(updateTask).toHaveBeenCalledWith({ id: 1, status: "active" });
	});

	it("shows the Continue here row and suggested-task-row highlight", () => {
		renderTaskList(
			<TaskList
				{...defaultProps}
				continueTaskId={1}
				highlightedTaskId={1}
				tasks={[makeTask({ id: 1, title: "Continue task" })]}
			/>,
		);

		expect(screen.getByTestId("continue-here-row")).toBeTruthy();
		expect(screen.getByTestId("suggested-task-row")).toBeTruthy();
	});

	it("shows footprint only on the focused row", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-06-20T12:00:00Z"));

		renderTaskList(
			<TaskList
				{...defaultProps}
				focusedTaskId={1}
				footprints={{
					"1": {
						lastFocusedAt: new Date("2026-06-20T11:30:00Z"),
						cumulativeMinutes: 25,
					},
				}}
				tasks={[makeTask({ id: 1, title: "Focused task" })]}
			/>,
		);

		const footprint = screen.getByTestId("task-footprint-1");
		expect(footprint.textContent).toContain("25m total");

		vi.useRealTimers();
	});

	it("shows archive entry and calls onOpenArchive when clicked", () => {
		const onOpenArchive = vi.fn();
		renderTaskList(
			<TaskList {...defaultProps} onOpenArchive={onOpenArchive} />,
		);

		const entry = screen.getByTestId("task-archive-entry");
		expect(entry.textContent).toBe("Archived tasks");
		fireEvent.click(entry);
		expect(onOpenArchive).toHaveBeenCalledTimes(1);
	});

	it("filters the visible tab by work type", () => {
		renderTaskList(
			<TaskList
				{...defaultProps}
				tasks={[
					makeTask({ id: 1, title: "Deep task", workType: "DEEP_WORK" }),
					makeTask({ id: 2, title: "Ops task", workType: "OPERATIONAL" }),
				]}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: "Filter by type" }));
		fireEvent.click(
			within(screen.getByRole("listbox", { name: "Filter by type" })).getByText(
				"Deep",
			),
		);

		expect(screen.getByRole("button", { name: "Deep task" })).toBeTruthy();
		expect(screen.queryByRole("button", { name: "Ops task" })).toBeNull();
	});
});
