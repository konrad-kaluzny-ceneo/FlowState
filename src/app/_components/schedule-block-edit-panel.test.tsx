import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { IntlTestWrapper } from "~/i18n/test-intl";
import type { DomainTask } from "~/lib/data-mode/types";
import type {
	DomainContextTag,
	DomainScheduleBlock,
} from "~/lib/schedule/types";

import { ScheduleBlockEditPanel } from "./schedule-block-edit-panel";

function makeBlock(
	overrides: Partial<DomainScheduleBlock> = {},
): DomainScheduleBlock {
	return {
		id: 7,
		userId: "user-1",
		localDateKey: "2026-08-18",
		blockType: "FOCUS",
		startMinute: 540,
		durationMinutes: 30,
		metaLabel: null,
		fixedContext: null,
		customContextTagId: null,
		contextLabel: null,
		focusTaskId: null,
		focusTask: null,
		batchTaskIds: [],
		createdAt: new Date("2026-08-18T07:00:00.000Z"),
		updatedAt: new Date("2026-08-18T07:00:00.000Z"),
		...overrides,
	};
}

function makeTask(
	id: number,
	title: string,
	status: DomainTask["status"] = "active",
): DomainTask {
	return {
		id,
		title,
		status,
		userId: "user-1",
		createdAt: new Date(),
		updatedAt: null,
		archivedAt: null,
		workType: "OPERATIONAL",
		weight: 2,
		importance: 2,
		urgency: 2,
		effortMinutes: null,
		commitmentHorizon: "WHEN_POSSIBLE",
		sortOrder: id,
		resumeNote: null,
		project: null,
		personaPresetId: null,
		isDailyStanding: false,
	};
}

function renderPanel(options?: {
	block?: DomainScheduleBlock;
	tasks?: DomainTask[];
	contextTags?: DomainContextTag[];
}) {
	const callbacks = {
		onClose: vi.fn(),
		updateBlock: vi.fn().mockResolvedValue(undefined),
		deleteBlock: vi.fn().mockResolvedValue(undefined),
		createContextTag: vi.fn().mockResolvedValue({
			id: 12,
			label: "Home",
			createdAt: new Date(),
			updatedAt: new Date(),
		}),
	};

	render(
		<IntlTestWrapper>
			<ScheduleBlockEditPanel
				block={options?.block ?? makeBlock()}
				contextTags={options?.contextTags ?? []}
				tasks={options?.tasks ?? []}
				{...callbacks}
			/>
		</IntlTestWrapper>,
	);

	return callbacks;
}

describe("ScheduleBlockEditPanel", () => {
	it("attaches one active or planned task to a focus block", async () => {
		const callbacks = renderPanel({
			tasks: [
				makeTask(1, "Active task"),
				makeTask(2, "Planned task", "planned"),
				makeTask(3, "Completed task", "completed"),
			],
		});

		const picker = screen.getByTestId("schedule-focus-task");
		expect(picker.textContent).not.toContain("Completed task");
		fireEvent.change(picker, { target: { value: "2" } });
		fireEvent.click(screen.getByTestId("schedule-save-block"));

		await waitFor(() => {
			expect(callbacks.updateBlock).toHaveBeenCalledWith({
				blockId: 7,
				blockType: "FOCUS",
				startMinute: 540,
				durationMinutes: 30,
				metaLabel: null,
				fixedContext: null,
				customContextTagId: null,
				focusTaskId: 2,
			});
		});
		expect(callbacks.onClose).toHaveBeenCalled();
	});

	it("saves a batch label and ordered task selection", async () => {
		const callbacks = renderPanel({
			block: makeBlock({ blockType: "BATCH" }),
			tasks: [makeTask(1, "Call one"), makeTask(2, "Call two", "planned")],
		});

		fireEvent.change(screen.getByTestId("schedule-meta-label"), {
			target: { value: "Calls" },
		});
		fireEvent.click(screen.getByTestId("schedule-batch-task-2"));
		fireEvent.click(screen.getByTestId("schedule-batch-task-1"));
		fireEvent.click(screen.getByTestId("schedule-save-block"));

		await waitFor(() => {
			expect(callbacks.updateBlock).toHaveBeenCalledWith(
				expect.objectContaining({
					blockId: 7,
					metaLabel: "Calls",
					batchTaskIds: [2, 1],
				}),
			);
		});
	});

	it("creates and selects a reusable custom context", async () => {
		const callbacks = renderPanel();

		fireEvent.change(screen.getByTestId("schedule-new-context-tag"), {
			target: { value: "Home" },
		});
		fireEvent.click(screen.getByTestId("schedule-create-context-tag"));

		await waitFor(() => {
			expect(callbacks.createContextTag).toHaveBeenCalledWith("Home");
		});
		expect(
			(screen.getByTestId("schedule-context") as HTMLSelectElement).value,
		).toBe("tag:12");
	});
});
