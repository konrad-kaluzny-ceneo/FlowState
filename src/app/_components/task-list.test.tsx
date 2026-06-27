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
import { getPresetCoachLine } from "~/lib/onboarding/copy";
import {
	applyPersonaPresetToCreateState,
	getPersonaPresetLabel,
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

	it("shows Continue here subtitle without resume note on continue row", () => {
		const continueTask = makeTask({
			id: 2,
			title: "Second task",
			resumeNote: "Left off here",
		});
		const otherTask = makeTask({ id: 1, title: "First task" });

		renderTaskList(
			<TaskList
				{...defaultProps}
				continueTaskId={2}
				focusedTaskId={2}
				tasks={[otherTask, continueTask]}
			/>,
		);

		expect(screen.getByTestId("continue-here-row").textContent).toContain(
			"Continue here",
		);
		expect(screen.queryByTestId("task-resume-note")).toBeNull();
	});

	it("inline edit uses textarea and preserves multiline title on save", () => {
		renderTaskList(<TaskList {...defaultProps} />);

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
		renderTaskList(<TaskList {...defaultProps} />);

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
		renderTaskList(
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
		renderTaskList(
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
		renderTaskList(<TaskList {...defaultProps} />);

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
		renderTaskList(<TaskList {...defaultProps} />);

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
		renderTaskList(
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
		renderTaskList(<TaskList {...defaultProps} />);

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
		TASK_PERSONA_PRESETS.map(
			(preset) => [getPersonaPresetLabel(preset.id), preset.id] as const,
		),
	)("preset %s applies create form attributes visible in Custom panel", (_label, presetId) => {
		renderTaskList(<TaskList {...defaultProps} />);

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
		TASK_PERSONA_PRESETS.map(
			(preset) => [getPersonaPresetLabel(preset.id), preset.id] as const,
		),
	)("Add sends %s preset attributes via createTask", async (_label, presetId) => {
		renderTaskList(<TaskList {...defaultProps} />);

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
		renderTaskList(<TaskList {...defaultProps} />);

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
		renderTaskList(<TaskList {...defaultProps} />);

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
		renderTaskList(<TaskList {...defaultProps} />);

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

		renderTaskList(<TaskList {...defaultProps} />);

		expect(screen.getByTestId("preset-coach")).toBeTruthy();
		expect(screen.getByText(getPresetCoachLine())).toBeTruthy();

		fireEvent.click(screen.getByTestId("preset-coach-dismiss-btn"));

		expect(markPresetCoachDismissed).toHaveBeenCalledTimes(1);
	});

	it("shows ASAP badge on active task when horizon is ASAP", () => {
		renderTaskList(
			<TaskList
				{...defaultProps}
				tasks={[makeTask({ commitmentHorizon: "ASAP" })]}
			/>,
		);

		expect(screen.getByText("ASAP")).toBeTruthy();
	});

	it("shows persona label and effort badge for preset task row", () => {
		renderTaskList(
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
		renderTaskList(
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
		renderTaskList(
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
		renderTaskList(
			<TaskList {...defaultProps} tasks={[makeTask({ title: longTitle })]} />,
		);

		const titleButton = screen.getByRole("button", { name: longTitle });
		expect(titleButton.textContent).toBe(longTitle);
		expect(longTitle.length).toBeGreaterThanOrEqual(120);
	});

	it("shows drag handles when reorder is allowed", () => {
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
		expect(handles[0]?.getAttribute("aria-label")).toBe("Drag to reorder");
		expect(handles[0]).not.toHaveProperty("disabled", true);
	});

	it("calls reorderTasks when drag ends with a new order", () => {
		renderTaskList(
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
		expect(updateTask).toHaveBeenCalledWith({
			id: 1,
			status: "completed",
		});
	});

	it("renders daily standing toggle in create form and badge on standing tasks", () => {
		renderTaskList(
			<TaskList
				{...defaultProps}
				tasks={[
					makeTask({ id: 1, title: "Stand-up", isDailyStanding: true }),
					makeTask({ id: 2, title: "One-off", isDailyStanding: false }),
				]}
			/>,
		);

		const toggle = screen.getByTestId(
			"daily-standing-toggle",
		) as HTMLInputElement;
		expect(toggle.checked).toBe(false);
		expect(screen.getByTestId("daily-standing-badge").textContent).toBe(
			"Daily",
		);
		const standingCompleteButton = screen.getByRole("button", {
			name: "Done for today",
		});
		const regularCompleteButton = screen.getByRole("button", {
			name: "Mark complete",
		});
		expect(standingCompleteButton.className).toContain("border-2");
		expect(standingCompleteButton.className).toContain("h-5");
		expect(standingCompleteButton.className).toContain("w-5");
		expect(regularCompleteButton.className).toContain("border-2");
		expect(regularCompleteButton.className).toContain("h-5");
		expect(regularCompleteButton.className).toContain("w-5");
		expect(standingCompleteButton.getAttribute("data-testid")).toBe(
			"task-complete-button",
		);
		expect(regularCompleteButton.getAttribute("data-testid")).toBe(
			"task-complete-button",
		);
	});

	it("does not use line-through on done-for-today active task titles", () => {
		renderTaskList(
			<TaskList
				{...defaultProps}
				tasks={[
					makeTask({
						id: 1,
						title: "Stand-up",
						isDailyStanding: true,
						doneForToday: true,
					}),
				]}
			/>,
		);

		const titleButton = screen.getByRole("button", { name: "Stand-up" });
		expect(titleButton.className).not.toContain("line-through");
		expect(titleButton.className).toContain("text-text-dimmed");
	});

	it("opens edit panel when clicking a completed task title", () => {
		renderTaskList(
			<TaskList
				{...defaultProps}
				tasks={[
					makeTask({
						id: 1,
						title: "Archived task",
						status: "completed",
					}),
				]}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: "Archived task" }));

		expect(screen.getByTestId("task-fields-panel-edit")).toBeTruthy();
		expect(screen.getByTestId("task-fields-title")).toBeTruthy();
	});

	it("calls markDoneForToday for standing tasks instead of global complete", () => {
		renderTaskList(
			<TaskList
				{...defaultProps}
				tasks={[makeTask({ id: 1, title: "Stand-up", isDailyStanding: true })]}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: "Done for today" }));

		expect(markDoneForToday).toHaveBeenCalledWith({
			id: 1,
			localDateKey: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
		});
		expect(updateTask).not.toHaveBeenCalledWith({
			id: 1,
			status: "completed",
		});
	});

	it("shows footprint on focused row when recap data exists", () => {
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
		expect(footprint.textContent).toContain("30 minutes ago");

		vi.useRealTimers();
	});

	it("hides footprint on unfocused rows", () => {
		renderTaskList(
			<TaskList
				{...defaultProps}
				focusedTaskId={null}
				footprints={{
					"1": {
						lastFocusedAt: new Date("2026-06-20T11:30:00Z"),
						cumulativeMinutes: 25,
					},
				}}
				tasks={[makeTask({ id: 1, title: "Unfocused task" })]}
			/>,
		);

		expect(screen.queryByTestId("task-footprint-1")).toBeNull();
	});
});
