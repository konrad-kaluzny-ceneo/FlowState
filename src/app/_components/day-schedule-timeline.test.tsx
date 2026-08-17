import type { DragEndEvent } from "@dnd-kit/core";
import { fireEvent, render, screen } from "@testing-library/react";
import { TRPCClientError } from "@trpc/client";
import type { ComponentProps, ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IntlTestWrapper } from "~/i18n/test-intl";
import type { DomainScheduleBlock } from "~/lib/schedule/types";

import {
	DayScheduleTimeline,
	DEFAULT_BLOCK_DURATION_MINUTES,
	SCHEDULE_HOUR_HEIGHT_PX,
} from "./day-schedule-timeline";

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

function makeBlock(
	overrides: Partial<DomainScheduleBlock> = {},
): DomainScheduleBlock {
	return {
		id: 1,
		userId: "user-1",
		localDateKey: "2026-08-17",
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
		createdAt: new Date("2026-08-17T08:00:00.000Z"),
		updatedAt: new Date("2026-08-17T08:00:00.000Z"),
		...overrides,
	};
}

function conflictError() {
	return new TRPCClientError("overlap", {
		result: {
			error: {
				code: "CONFLICT",
				message: "overlap",
				data: { code: "CONFLICT" },
			},
		},
	});
}

function renderTimeline(
	ui: ReactElement = (
		<DayScheduleTimeline
			blocks={[]}
			createBlock={vi.fn().mockResolvedValue(undefined)}
			localDateKey="2026-08-17"
			updateBlock={vi.fn().mockResolvedValue(undefined)}
		/>
	),
) {
	return render(<IntlTestWrapper>{ui}</IntlTestWrapper>);
}

describe("DayScheduleTimeline", () => {
	beforeEach(() => {
		dndTestState.onDragEndRef = null;
	});

	it("renders timeline and add-block test ids", () => {
		renderTimeline(
			<DayScheduleTimeline
				blocks={[makeBlock()]}
				createBlock={vi.fn().mockResolvedValue(undefined)}
				localDateKey="2026-08-17"
				updateBlock={vi.fn().mockResolvedValue(undefined)}
			/>,
		);

		expect(screen.getByTestId("schedule-timeline")).toBeTruthy();
		expect(screen.getByTestId("schedule-add-block")).toBeTruthy();
		expect(screen.getByTestId("schedule-block-1")).toBeTruthy();
	});

	it("shows a loading skeleton instead of the timeline", () => {
		renderTimeline(
			<DayScheduleTimeline
				blocks={[]}
				createBlock={vi.fn().mockResolvedValue(undefined)}
				isLoading
				localDateKey="2026-08-17"
				updateBlock={vi.fn().mockResolvedValue(undefined)}
			/>,
		);

		expect(screen.getByTestId("schedule-timeline-skeleton")).toBeTruthy();
		expect(screen.queryByTestId("schedule-timeline")).toBeNull();
	});

	it("creates a default 30-minute focus block from the add button", () => {
		const createBlock = vi.fn().mockResolvedValue(undefined);
		renderTimeline(
			<DayScheduleTimeline
				blocks={[]}
				createBlock={createBlock}
				localDateKey="2026-08-17"
				updateBlock={vi.fn().mockResolvedValue(undefined)}
			/>,
		);

		fireEvent.click(screen.getByTestId("schedule-add-block"));

		expect(createBlock).toHaveBeenCalledWith({
			blockType: "FOCUS",
			startMinute: 360,
			durationMinutes: DEFAULT_BLOCK_DURATION_MINUTES,
		});
	});

	it("creates a snapped focus block when an empty slot is clicked", () => {
		const createBlock = vi.fn().mockResolvedValue(undefined);
		renderTimeline(
			<DayScheduleTimeline
				blocks={[]}
				createBlock={createBlock}
				localDateKey="2026-08-17"
				updateBlock={vi.fn().mockResolvedValue(undefined)}
			/>,
		);

		const axis = screen.getByTestId("schedule-timeline-axis");
		vi.spyOn(axis, "getBoundingClientRect").mockReturnValue({
			x: 0,
			y: 0,
			top: 0,
			left: 0,
			bottom: 16 * SCHEDULE_HOUR_HEIGHT_PX,
			right: 200,
			width: 200,
			height: 16 * SCHEDULE_HOUR_HEIGHT_PX,
			toJSON() {
				return {};
			},
		});

		fireEvent.click(axis, { clientY: 3 * SCHEDULE_HOUR_HEIGHT_PX });

		expect(createBlock).toHaveBeenCalledWith({
			blockType: "FOCUS",
			startMinute: 540,
			durationMinutes: DEFAULT_BLOCK_DURATION_MINUTES,
		});
	});

	it("shows an overlap error from the error prop", () => {
		renderTimeline(
			<DayScheduleTimeline
				blocks={[]}
				createBlock={vi.fn().mockResolvedValue(undefined)}
				error="This block overlaps another — pick a different time."
				localDateKey="2026-08-17"
				updateBlock={vi.fn().mockResolvedValue(undefined)}
			/>,
		);

		expect(screen.getByRole("alert").textContent).toContain("overlaps");
	});

	it("surfaces overlap copy when createBlock rejects with CONFLICT", async () => {
		const createBlock = vi.fn().mockRejectedValue(conflictError());
		renderTimeline(
			<DayScheduleTimeline
				blocks={[]}
				createBlock={createBlock}
				localDateKey="2026-08-17"
				updateBlock={vi.fn().mockResolvedValue(undefined)}
			/>,
		);

		fireEvent.click(screen.getByTestId("schedule-add-block"));

		expect(await screen.findByRole("alert")).toBeTruthy();
		expect(screen.getByRole("alert").textContent).toContain("overlaps");
	});

	it("calls updateBlock with snapped minutes after a vertical drag", () => {
		const updateBlock = vi.fn().mockResolvedValue(undefined);
		renderTimeline(
			<DayScheduleTimeline
				blocks={[makeBlock()]}
				createBlock={vi.fn().mockResolvedValue(undefined)}
				localDateKey="2026-08-17"
				updateBlock={updateBlock}
			/>,
		);

		dndTestState.onDragEndRef?.({
			delta: { x: 0, y: SCHEDULE_HOUR_HEIGHT_PX },
			active: {
				id: "1",
				data: {
					current: {
						blockId: 1,
						startMinute: 540,
						durationMinutes: 30,
					},
				},
			},
		} as unknown as DragEndEvent);

		expect(updateBlock).toHaveBeenCalledWith({
			blockId: 1,
			startMinute: 600,
			durationMinutes: 30,
		});
	});
});
