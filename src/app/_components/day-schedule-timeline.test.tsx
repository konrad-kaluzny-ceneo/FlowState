import type {
	DragEndEvent,
	DragMoveEvent,
	DragStartEvent,
} from "@dnd-kit/core";
import { act, fireEvent, render, screen } from "@testing-library/react";
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
	onDragMoveRef: null as ((event: DragMoveEvent) => void) | null,
	onDragStartRef: null as ((event: DragStartEvent) => void) | null,
};

vi.mock("@dnd-kit/core", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@dnd-kit/core")>();
	const React = await import("react");

	function DndContext(props: ComponentProps<typeof actual.DndContext>) {
		dndTestState.onDragEndRef = props.onDragEnd ?? null;
		dndTestState.onDragMoveRef = props.onDragMove ?? null;
		dndTestState.onDragStartRef = props.onDragStart ?? null;
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

function dragPayload(overrides?: {
	blockId?: number;
	startMinute?: number;
	durationMinutes?: number;
	deltaY?: number;
}) {
	return {
		delta: { x: 0, y: overrides?.deltaY ?? SCHEDULE_HOUR_HEIGHT_PX },
		active: {
			id: String(overrides?.blockId ?? 1),
			data: {
				current: {
					blockId: overrides?.blockId ?? 1,
					startMinute: overrides?.startMinute ?? 540,
					durationMinutes: overrides?.durationMinutes ?? 30,
				},
			},
		},
	};
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
		dndTestState.onDragMoveRef = null;
		dndTestState.onDragStartRef = null;
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

	it("shows empty-state copy when there are no blocks", () => {
		renderTimeline();
		expect(screen.getByTestId("schedule-timeline-empty")).toBeTruthy();
		expect(screen.getByTestId("schedule-timeline-empty").textContent).toMatch(
			/empty/i,
		);
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

	it("creates a snapped focus block when an empty slot is double-clicked", () => {
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
		expect(createBlock).not.toHaveBeenCalled();

		fireEvent.doubleClick(axis, { clientY: 3 * SCHEDULE_HOUR_HEIGHT_PX });

		expect(createBlock).toHaveBeenCalledWith({
			blockType: "FOCUS",
			startMinute: 540,
			durationMinutes: DEFAULT_BLOCK_DURATION_MINUTES,
		});
	});

	it("does not call createBlock when a double-click would overlap", async () => {
		const createBlock = vi.fn().mockResolvedValue(undefined);
		renderTimeline(
			<DayScheduleTimeline
				blocks={[makeBlock({ startMinute: 540, durationMinutes: 30 })]}
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

		fireEvent.doubleClick(axis, { clientY: 3 * SCHEDULE_HOUR_HEIGHT_PX });

		expect(createBlock).not.toHaveBeenCalled();
		expect(await screen.findByRole("alert")).toBeTruthy();
		expect(screen.getByRole("alert").textContent).toContain("overlaps");
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

	it("updates the live time label during drag move", () => {
		renderTimeline(
			<DayScheduleTimeline
				blocks={[makeBlock()]}
				createBlock={vi.fn().mockResolvedValue(undefined)}
				localDateKey="2026-08-17"
				updateBlock={vi.fn().mockResolvedValue(undefined)}
			/>,
		);

		act(() => {
			dndTestState.onDragStartRef?.(dragPayload() as unknown as DragStartEvent);
			dndTestState.onDragMoveRef?.(dragPayload() as unknown as DragMoveEvent);
		});

		expect(screen.getByTestId("schedule-block-1").textContent).toContain(
			"10:00–10:30",
		);
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

		dndTestState.onDragEndRef?.(dragPayload() as unknown as DragEndEvent);

		expect(updateBlock).toHaveBeenCalledWith({
			blockId: 1,
			startMinute: 600,
			durationMinutes: 30,
		});
	});

	it("snaps to the nearest free slot when a drop would overlap", () => {
		const updateBlock = vi.fn().mockResolvedValue(undefined);
		renderTimeline(
			<DayScheduleTimeline
				blocks={[
					makeBlock(),
					makeBlock({ id: 2, startMinute: 600, durationMinutes: 30 }),
				]}
				createBlock={vi.fn().mockResolvedValue(undefined)}
				localDateKey="2026-08-17"
				updateBlock={updateBlock}
			/>,
		);

		dndTestState.onDragEndRef?.(dragPayload() as unknown as DragEndEvent);

		expect(updateBlock).toHaveBeenCalledWith({
			blockId: 1,
			startMinute: 570,
			durationMinutes: 30,
		});
	});

	it("shows compact label for short blocks", () => {
		renderTimeline(
			<DayScheduleTimeline
				blocks={[makeBlock({ durationMinutes: 15 })]}
				createBlock={vi.fn().mockResolvedValue(undefined)}
				localDateKey="2026-08-17"
				updateBlock={vi.fn().mockResolvedValue(undefined)}
			/>,
		);

		expect(screen.getByTestId("schedule-block-1").textContent).toMatch(/09:00/);
	});
});
