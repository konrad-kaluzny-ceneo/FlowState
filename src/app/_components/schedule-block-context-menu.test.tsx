import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IntlTestWrapper } from "~/i18n/test-intl";
import type { DomainScheduleBlock } from "~/lib/schedule/types";

import { ScheduleBlockContextMenu } from "./schedule-block-context-menu";

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

function renderMenu(
	overrides: Partial<ComponentProps<typeof ScheduleBlockContextMenu>> = {},
) {
	const onClose = vi.fn();
	const onEdit = vi.fn();
	const onDelete = vi.fn().mockResolvedValue(undefined);
	const onChangeType = vi.fn().mockResolvedValue(undefined);

	render(
		<IntlTestWrapper>
			<ScheduleBlockContextMenu
				block={makeBlock()}
				onChangeType={onChangeType}
				onClose={onClose}
				onDelete={onDelete}
				onEdit={onEdit}
				position={{ x: 120, y: 240 }}
				{...overrides}
			/>
		</IntlTestWrapper>,
	);

	return { onClose, onEdit, onDelete, onChangeType };
}

describe("ScheduleBlockContextMenu", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("calls onEdit and closes when edit is chosen", () => {
		const { onEdit, onClose } = renderMenu();

		fireEvent.click(screen.getByTestId("schedule-context-edit"));

		expect(onEdit).toHaveBeenCalledTimes(1);
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("changes block type and closes", async () => {
		const { onChangeType, onClose } = renderMenu();

		fireEvent.click(screen.getByTestId("schedule-context-type-meeting"));

		await vi.waitFor(() => {
			expect(onChangeType).toHaveBeenCalledWith("MEETING");
		});
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("requires confirmation before delete", async () => {
		const { onDelete } = renderMenu();

		fireEvent.click(screen.getByTestId("schedule-context-delete"));
		expect(onDelete).not.toHaveBeenCalled();

		fireEvent.click(screen.getByTestId("schedule-context-delete"));
		await vi.waitFor(() => {
			expect(onDelete).toHaveBeenCalledTimes(1);
		});
	});
});
