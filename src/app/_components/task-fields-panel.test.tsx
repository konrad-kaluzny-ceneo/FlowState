import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TaskFieldsPanel } from "./task-fields-panel";

const defaultProps = {
	title: "Task title",
	onTitleChange: vi.fn(),
	workType: "DEEP_WORK" as const,
	onWorkTypeChange: vi.fn(),
	urgency: 2 as const,
	importance: 2 as const,
	effortMinutes: "30",
	commitmentHorizon: "THIS_WEEK" as const,
	onUrgencyChange: vi.fn(),
	onImportanceChange: vi.fn(),
	onEffortMinutesChange: vi.fn(),
	onCommitmentHorizonChange: vi.fn(),
	isDailyStanding: true,
	onIsDailyStandingChange: vi.fn(),
};

describe("TaskFieldsPanel", () => {
	it("renders bordered title field in edit mode", () => {
		render(<TaskFieldsPanel mode="edit" {...defaultProps} />);

		const title = screen.getByTestId("task-fields-title");
		expect(title.className).toContain("border-border-subtle");
		expect(title.className).toContain("bg-surface-card");
		expect(title.tagName).toBe("TEXTAREA");
	});

	it("renders bordered title field in create mode when includeTitle is set", () => {
		render(
			<TaskFieldsPanel
				includeTitle
				mode="create"
				{...defaultProps}
				showAttributeFields={false}
			/>,
		);

		const title = screen.getByTestId("task-fields-title");
		expect(title.className).toContain("border-border-subtle");
		expect(title.className).toContain("bg-surface-card");
	});

	it("shows daily standing toggle in both modes", () => {
		const { rerender } = render(
			<TaskFieldsPanel mode="edit" {...defaultProps} />,
		);
		expect(screen.getByTestId("daily-standing-toggle")).toBeTruthy();

		rerender(
			<TaskFieldsPanel
				includeTitle={false}
				mode="create"
				{...defaultProps}
				showAttributeFields={false}
			/>,
		);
		expect(screen.getByTestId("daily-standing-toggle")).toBeTruthy();
	});

	it("renders persona preset picker only in create mode", () => {
		render(
			<TaskFieldsPanel
				includeTitle={false}
				mode="create"
				personaPresetPicker={
					<div data-testid="persona-preset-picker">Presets</div>
				}
				showAttributeFields={false}
				{...defaultProps}
			/>,
		);

		expect(screen.getByTestId("persona-preset-picker")).toBeTruthy();
	});

	it("forwards title keydown in edit mode", () => {
		const onTitleKeyDown = vi.fn();
		render(
			<TaskFieldsPanel
				mode="edit"
				onTitleKeyDown={onTitleKeyDown}
				{...defaultProps}
			/>,
		);

		fireEvent.keyDown(screen.getByTestId("task-fields-title"), {
			key: "Enter",
		});
		expect(onTitleKeyDown).toHaveBeenCalled();
	});
});
