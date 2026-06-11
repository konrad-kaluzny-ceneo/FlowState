import type { DragEndEvent } from "@dnd-kit/core";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
const clearError = vi.fn();

vi.mock("~/hooks/use-task-mutations", () => ({
	useTaskMutations: () => ({
		createTask,
		updateTask,
		deleteTask,
		reorderTasks,
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
		...overrides,
	};
}

const defaultProps = {
	tasks: [makeTask()],
	onRefresh: vi.fn().mockResolvedValue(undefined),
	focusedTaskId: null,
	onFocusTask: vi.fn(),
	cycleState: "idle" as const,
};

describe("TaskList", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("inline edit uses textarea and preserves multiline title on save", () => {
		render(<TaskList {...defaultProps} />);

		fireEvent.click(screen.getByRole("button", { name: "Short title" }));

		const row = screen.getByTestId("active-task-row");
		const textarea = row.querySelector("textarea");
		expect(textarea).not.toBeNull();
		expect(textarea?.tagName).toBe("TEXTAREA");

		fireEvent.change(textarea as HTMLTextAreaElement, {
			target: { value: "Line one" },
		});
		fireEvent.keyDown(textarea as HTMLTextAreaElement, {
			key: "Enter",
			shiftKey: true,
		});
		fireEvent.change(textarea as HTMLTextAreaElement, {
			target: { value: "Line one\nLine two" },
		});
		fireEvent.keyDown(textarea as HTMLTextAreaElement, { key: "Enter" });

		expect(updateTask).toHaveBeenCalledWith({
			id: 1,
			title: "Line one\nLine two",
			workType: "OPERATIONAL",
			weight: 2,
		});
	});

	it("read mode shows full long title", () => {
		const longTitle = `${"A".repeat(60)}\n${"B".repeat(60)}`;
		render(
			<TaskList {...defaultProps} tasks={[makeTask({ title: longTitle })]} />,
		);

		const titleButton = screen.getByRole("button", { name: longTitle });
		expect(titleButton.textContent).toBe(longTitle);
		expect(longTitle.length).toBeGreaterThanOrEqual(120);
	});

	it("shows drag handles when reorder is allowed", () => {
		render(
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
		expect(handles[0]?.getAttribute("aria-label")).toBe("Drag to reorder");
		expect(handles[0]).not.toHaveProperty("disabled", true);
	});

	it("calls reorderTasks when drag ends with a new order", () => {
		render(
			<TaskList
				{...defaultProps}
				tasks={[
					makeTask({ id: 1, title: "First", sortOrder: 0 }),
					makeTask({ id: 2, title: "Second", sortOrder: 1 }),
				]}
			/>,
		);

		dndTestState.onDragEndRef?.({
			active: { id: "1" },
			over: { id: "2" },
		} as DragEndEvent);

		expect(reorderTasks).toHaveBeenCalledWith({ orderedIds: [2, 1] });
	});
});
