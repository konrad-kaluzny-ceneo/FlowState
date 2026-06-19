import type { DragEndEvent } from "@dnd-kit/core";
import {
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DomainTask } from "~/lib/data-mode/types";
import { defaultEisenhowerFields } from "~/lib/data-mode/types";
import { PRESET_COACH_LINE } from "~/lib/onboarding/copy";
import {
	applyPersonaPresetToCreateState,
	TASK_PERSONA_PRESETS,
} from "~/lib/task/persona-presets";

import { TaskList } from "./task-list";

const markPresetCoachDismissed = vi.fn();
const presetCoachMock = {
	shouldShowPresetCoach: false,
	markPresetCoachDismissed,
};

vi.mock("~/hooks/use-onboarding-state", () => ({
	usePresetCoachOnboarding: () => presetCoachMock,
}));

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
		personaPresetId,
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

function getCreateForm(): HTMLFormElement {
	const input = screen.getByPlaceholderText("Add a new task...");
	const form = input.closest("form");
	if (form == null) {
		throw new Error("Create form not found");
	}
	return form;
}

function expectPressedInForm(form: HTMLElement, label: string) {
	const button = within(form).getByRole("button", { name: label });
	expect(button.getAttribute("aria-pressed")).toBe("true");
}

function expectAxisSelection(
	form: HTMLElement,
	axisLabel: string,
	valueLabel: string,
) {
	const row = within(form).getByText(axisLabel).parentElement;
	if (row == null) {
		throw new Error(`Axis row not found: ${axisLabel}`);
	}
	const button = within(row).getByRole("button", { name: valueLabel });
	expect(button.getAttribute("aria-pressed")).toBe("true");
}

function axisValueLabel(value: 1 | 2 | 3): string {
	return value === 1 ? "Light" : value === 2 ? "Medium" : "Heavy";
}

function horizonValueLabel(
	horizon: "ASAP" | "THIS_WEEK" | "WHEN_POSSIBLE",
): string {
	return horizon === "ASAP"
		? "ASAP"
		: horizon === "THIS_WEEK"
			? "This week"
			: "When possible";
}

function openCreateCustomPanel() {
	fireEvent.click(screen.getByRole("button", { name: "Custom" }));
}

function selectCreatePreset(presetId: string) {
	fireEvent.click(screen.getByTestId(`persona-preset-${presetId}`));
}

function fillCreateTitle(title: string) {
	fireEvent.change(screen.getByPlaceholderText("Add a new task..."), {
		target: { value: title },
	});
}

function submitCreateForm() {
	fireEvent.click(screen.getByRole("button", { name: "Add" }));
}

describe("TaskList", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		presetCoachMock.shouldShowPresetCoach = false;
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
			urgency: 2,
			weight: 2,
			importance: 2,
			effortMinutes: null,
			commitmentHorizon: "WHEN_POSSIBLE",
			resumeNote: null,
			isDailyStanding: false,
		});
	});

	it("saves resumeNote when clicking outside the edit panel", async () => {
		render(<TaskList {...defaultProps} />);

		fireEvent.click(screen.getByRole("button", { name: "Short title" }));

		const resumeNote = screen.getByLabelText("Where you left off (optional)");
		fireEvent.change(resumeNote, {
			target: { value: "Picked up mid refactor" },
		});
		fireEvent.pointerDown(document.body);

		await waitFor(() => {
			expect(updateTask).toHaveBeenCalledWith(
				expect.objectContaining({
					id: 1,
					resumeNote: "Picked up mid refactor",
				}),
			);
		});
	});

	it("saves before focusing another task while editing", async () => {
		render(
			<TaskList
				{...defaultProps}
				tasks={[
					makeTask({ id: 1, title: "First" }),
					makeTask({ id: 2, title: "Second", sortOrder: 1 }),
				]}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: "First" }));
		const resumeNote = screen.getByLabelText("Where you left off (optional)");
		fireEvent.change(resumeNote, {
			target: { value: "Context for first" },
		});

		const rows = screen.getAllByTestId("active-task-row");
		fireEvent.click(
			within(rows[1] as HTMLElement).getByRole("button", { name: "Focus" }),
		);

		await waitFor(() => {
			expect(updateTask).toHaveBeenCalledWith(
				expect.objectContaining({
					id: 1,
					resumeNote: "Context for first",
				}),
			);
		});
		expect(onFocusTask).toHaveBeenCalledWith(
			2,
			expect.objectContaining({ id: 2 }),
		);
	});

	it("saves the prior task before opening edit on another task", async () => {
		render(
			<TaskList
				{...defaultProps}
				tasks={[
					makeTask({ id: 1, title: "First" }),
					makeTask({ id: 2, title: "Second", sortOrder: 1 }),
				]}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: "First" }));
		const resumeNote = screen.getByLabelText("Where you left off (optional)");
		fireEvent.change(resumeNote, {
			target: { value: "Draft note" },
		});

		fireEvent.click(screen.getByRole("button", { name: "Second" }));

		await waitFor(() => {
			expect(updateTask).toHaveBeenCalledWith(
				expect.objectContaining({
					id: 1,
					resumeNote: "Draft note",
				}),
			);
		});
	});

	it("discards edits on Escape without calling updateTask", () => {
		render(<TaskList {...defaultProps} />);

		fireEvent.click(screen.getByRole("button", { name: "Short title" }));
		const textarea = screen
			.getByTestId("active-task-row")
			.querySelector("textarea");
		fireEvent.change(textarea as HTMLTextAreaElement, {
			target: { value: "Changed title" },
		});
		fireEvent.keyDown(textarea as HTMLTextAreaElement, { key: "Escape" });

		expect(updateTask).not.toHaveBeenCalled();
		expect(screen.getByRole("button", { name: "Short title" })).toBeTruthy();
	});

	it("persists attribute changes when committing after SegmentedControl edit", async () => {
		render(<TaskList {...defaultProps} />);

		fireEvent.click(screen.getByRole("button", { name: "Short title" }));
		fireEvent.click(screen.getByRole("button", { name: "Deep" }));
		fireEvent.pointerDown(document.body);

		await waitFor(() => {
			expect(updateTask).toHaveBeenCalledWith(
				expect.objectContaining({
					id: 1,
					workType: "DEEP_WORK",
				}),
			);
		});
		expect(updateTask).toHaveBeenCalledTimes(1);
	});

	it("allows focusing and saving effort when inline editing an existing task", async () => {
		render(
			<TaskList {...defaultProps} tasks={[makeTask({ effortMinutes: 30 })]} />,
		);

		fireEvent.click(screen.getByRole("button", { name: "Short title" }));

		const row = screen.getByTestId("active-task-row");
		const effortInput = within(row).getByPlaceholderText("min");

		const mouseDown = new MouseEvent("mousedown", {
			bubbles: true,
			cancelable: true,
		});
		effortInput.dispatchEvent(mouseDown);
		expect(mouseDown.defaultPrevented).toBe(false);

		fireEvent.change(effortInput, { target: { value: "45" } });
		fireEvent.pointerDown(document.body);

		await waitFor(() => {
			expect(updateTask).toHaveBeenCalledWith(
				expect.objectContaining({
					id: 1,
					effortMinutes: 45,
				}),
			);
		});
	});

	it("shows Eisenhower attribute pickers in create Custom panel", () => {
		render(<TaskList {...defaultProps} />);

		openCreateCustomPanel();

		expect(screen.getByText("Urgency")).toBeTruthy();
		expect(screen.getByText("Importance")).toBeTruthy();
		expect(screen.getByText("Effort")).toBeTruthy();
		expect(screen.getByText("Horizon")).toBeTruthy();
		expect(screen.getByRole("button", { name: "Deep" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "Ops" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "Reactive" })).toBeTruthy();
	});

	it.each(
		TASK_PERSONA_PRESETS.map((preset) => [preset.label, preset.id] as const),
	)("preset %s applies create form attributes visible in Custom panel", (_label, presetId) => {
		render(<TaskList {...defaultProps} />);

		selectCreatePreset(presetId);
		expect(
			screen
				.getByTestId(`persona-preset-${presetId}`)
				.getAttribute("aria-pressed"),
		).toBe("true");

		const applied = applyPersonaPresetToCreateState(presetId);
		const presetEffortInput = screen.getByTestId("create-preset-effort");
		expect((presetEffortInput as HTMLInputElement).value).toBe(
			applied.effortMinutes,
		);

		openCreateCustomPanel();
		const form = getCreateForm();

		const workTypeLabel =
			applied.workType === "DEEP_WORK"
				? "Deep"
				: applied.workType === "OPERATIONAL"
					? "Ops"
					: "Reactive";
		expectPressedInForm(form, workTypeLabel);
		expectAxisSelection(form, "Urgency", axisValueLabel(applied.urgency));
		expectAxisSelection(form, "Importance", axisValueLabel(applied.importance));

		expectAxisSelection(
			form,
			"Horizon",
			horizonValueLabel(applied.commitmentHorizon),
		);
	});

	it.each(
		TASK_PERSONA_PRESETS.map((preset) => [preset.label, preset.id] as const),
	)("Add sends %s preset attributes via createTask", async (_label, presetId) => {
		render(<TaskList {...defaultProps} />);

		selectCreatePreset(presetId);
		fillCreateTitle("Preset task");
		submitCreateForm();

		const applied = applyPersonaPresetToCreateState(presetId);

		await waitFor(() => {
			expect(createTask).toHaveBeenCalledWith({
				title: "Preset task",
				workType: applied.workType,
				urgency: applied.urgency,
				weight: applied.urgency,
				importance: applied.importance,
				effortMinutes: Number.parseInt(applied.effortMinutes, 10),
				commitmentHorizon: applied.commitmentHorizon,
				personaPresetId: presetId,
				isDailyStanding: false,
			});
		});
	});

	it("preset effort is visible without Custom panel and effort-only edits keep preset selected", () => {
		render(<TaskList {...defaultProps} />);

		selectCreatePreset("synchro");
		expect(screen.getByTestId("create-preset-effort")).toBeTruthy();
		expect(screen.queryByText("Urgency")).toBeNull();

		fireEvent.change(screen.getByTestId("create-preset-effort"), {
			target: { value: "20" },
		});

		expect(
			screen.getByTestId("persona-preset-synchro").getAttribute("aria-pressed"),
		).toBe("true");
		expect(
			(screen.getByTestId("create-preset-effort") as HTMLInputElement).value,
		).toBe("20");
	});

	it("post-create reset clears preset selection and Custom panel", async () => {
		render(<TaskList {...defaultProps} />);

		selectCreatePreset("focus");
		openCreateCustomPanel();
		fillCreateTitle("Reset me");
		submitCreateForm();

		await waitFor(() => {
			expect(createTask).toHaveBeenCalled();
		});

		expect(
			(screen.getByPlaceholderText("Add a new task...") as HTMLInputElement)
				.value,
		).toBe("");
		expect(
			screen.getByTestId("persona-preset-focus").getAttribute("aria-pressed"),
		).toBe("false");
		expect(screen.queryByText("Urgency")).toBeNull();
	});

	it("selecting a preset collapses Custom panel", () => {
		render(<TaskList {...defaultProps} />);

		openCreateCustomPanel();
		expect(screen.getByText("Urgency")).toBeTruthy();

		selectCreatePreset("synchro");
		expect(screen.queryByText("Urgency")).toBeNull();
		expect(
			screen.getByTestId("persona-preset-synchro").getAttribute("aria-pressed"),
		).toBe("true");
	});

	it("preset coach dismiss calls markPresetCoachDismissed", () => {
		presetCoachMock.shouldShowPresetCoach = true;

		render(<TaskList {...defaultProps} />);

		expect(screen.getByTestId("preset-coach")).toBeTruthy();
		expect(screen.getByText(PRESET_COACH_LINE)).toBeTruthy();

		fireEvent.click(screen.getByTestId("preset-coach-dismiss-btn"));

		expect(markPresetCoachDismissed).toHaveBeenCalledTimes(1);
	});

	it("shows ASAP badge on active task when horizon is ASAP", () => {
		render(
			<TaskList
				{...defaultProps}
				tasks={[makeTask({ commitmentHorizon: "ASAP" })]}
			/>,
		);

		expect(screen.getByText("ASAP")).toBeTruthy();
	});

	it("shows persona label and effort badge for preset task row", () => {
		render(
			<TaskList
				{...defaultProps}
				tasks={[
					makeTask({
						personaPresetId: "synchro",
						workType: "OPERATIONAL",
						urgency: 2,
						importance: 2,
						effortMinutes: 20,
						commitmentHorizon: "WHEN_POSSIBLE",
					}),
				]}
			/>,
		);

		expect(screen.getByTestId("task-persona-badge").textContent).toBe(
			"Synchro",
		);
		expect(screen.getByTestId("task-effort-badge").textContent).toBe("20m");
		expect(screen.queryByTestId("task-custom-badge")).toBeNull();
	});

	it("shows Custom badge with Eisenhower detail for custom persona tasks", () => {
		render(
			<TaskList
				{...defaultProps}
				tasks={[
					makeTask({
						personaPresetId: "custom",
						workType: "DEEP_WORK",
						urgency: 2,
						importance: 3,
						effortMinutes: 45,
						commitmentHorizon: "THIS_WEEK",
					}),
				]}
			/>,
		);

		expect(screen.getByTestId("task-custom-badge").textContent).toBe("Custom");
		expect(screen.getByText("Deep")).toBeTruthy();
		expect(screen.getByText("U: Medium")).toBeTruthy();
		expect(screen.queryByTestId("task-persona-badge")).toBeNull();
	});

	it("legacy tasks without personaPresetId keep Eisenhower badges", () => {
		render(
			<TaskList
				{...defaultProps}
				tasks={[
					makeTask({
						personaPresetId: null,
						workType: "OPERATIONAL",
						urgency: 2,
						importance: 2,
					}),
				]}
			/>,
		);

		expect(screen.getByText("Ops")).toBeTruthy();
		expect(screen.getByText("U: Medium")).toBeTruthy();
		expect(screen.queryByTestId("task-persona-badge")).toBeNull();
		expect(screen.queryByTestId("task-custom-badge")).toBeNull();
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

	it("applies completion delight animation when marking a task done", () => {
		render(
			<TaskList
				{...defaultProps}
				tasks={[makeTask({ id: 1, title: "Finish me" })]}
			/>,
		);

		const row = screen.getByTestId("active-task-row");
		expect(row.className).not.toContain("animate-task-complete");

		fireEvent.click(screen.getByRole("button", { name: "Mark complete" }));

		expect(row.className).toContain("animate-task-complete");
		expect(updateTask).toHaveBeenCalledWith({
			id: 1,
			status: "completed",
		});
	});

	it("renders daily standing toggle in create form and badge on standing tasks", () => {
		render(
			<TaskList
				{...defaultProps}
				tasks={[makeTask({ id: 1, title: "Stand-up", isDailyStanding: true })]}
			/>,
		);

		expect(screen.getByTestId("daily-standing-toggle")).toBeTruthy();
		expect(screen.getByTestId("daily-standing-badge").textContent).toBe(
			"Daily",
		);
		expect(screen.getByTestId("done-for-today-button")).toBeTruthy();
	});

	it("calls markDoneForToday for standing tasks instead of global complete", () => {
		render(
			<TaskList
				{...defaultProps}
				tasks={[makeTask({ id: 1, title: "Stand-up", isDailyStanding: true })]}
			/>,
		);

		fireEvent.click(screen.getByTestId("done-for-today-button"));

		expect(markDoneForToday).toHaveBeenCalledWith({
			id: 1,
			localDateKey: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
		});
		expect(updateTask).not.toHaveBeenCalledWith({
			id: 1,
			status: "completed",
		});
	});
});
