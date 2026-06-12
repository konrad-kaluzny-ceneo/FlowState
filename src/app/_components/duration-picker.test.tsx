import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
	getMaxBreakDurationSec,
	getMaxWorkDurationSec,
	getMinBreakDurationSec,
	getMinWorkDurationSec,
	getShortBreakPresets,
	getWorkDurationPresets,
} from "~/lib/duration-bounds";

import { DurationPicker } from "./duration-picker";

describe("DurationPicker", () => {
	it("calls onChangeSec when preset is clicked", () => {
		const onChangeSec = vi.fn();
		render(
			<DurationPicker
				boundsLabel="1 s – 90 min"
				maxSec={getMaxWorkDurationSec()}
				minSec={getMinWorkDurationSec()}
				onChangeSec={onChangeSec}
				presets={getWorkDurationPresets()}
				testIdPrefix="work-duration"
				valueSec={25 * 60}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: "15 min" }));

		expect(onChangeSec).toHaveBeenCalledWith(15 * 60);
	});

	it("highlights active preset when valueSec matches", () => {
		render(
			<DurationPicker
				boundsLabel="1 s – 90 min"
				maxSec={getMaxWorkDurationSec()}
				minSec={getMinWorkDurationSec()}
				onChangeSec={vi.fn()}
				presets={getWorkDurationPresets()}
				testIdPrefix="work-duration"
				valueSec={25 * 60}
			/>,
		);

		const activeButton = screen.getByRole("button", { name: "25 min" });
		expect(
			(activeButton as HTMLButtonElement).getAttribute("aria-pressed"),
		).toBe("true");
	});

	it("syncs custom fields from valueSec on init", () => {
		render(
			<DurationPicker
				boundsLabel="1 s – 90 min"
				maxSec={getMaxWorkDurationSec()}
				minSec={getMinWorkDurationSec()}
				onChangeSec={vi.fn()}
				presets={getWorkDurationPresets()}
				testIdPrefix="work-duration"
				valueSec={25 * 60}
			/>,
		);

		expect(
			(screen.getByTestId("work-duration-min") as HTMLInputElement).value,
		).toBe("25");
		expect(
			(screen.getByTestId("work-duration-sec") as HTMLInputElement).value,
		).toBe("0");
	});

	it("calls onChangeSec for sub-minute custom input", () => {
		const onChangeSec = vi.fn();
		render(
			<DurationPicker
				boundsLabel="1 s – 90 min"
				maxSec={getMaxWorkDurationSec()}
				minSec={getMinWorkDurationSec()}
				onChangeSec={onChangeSec}
				presets={getWorkDurationPresets()}
				testIdPrefix="work-duration"
				valueSec={25 * 60}
			/>,
		);

		fireEvent.change(screen.getByTestId("work-duration-min"), {
			target: { value: "0" },
		});
		fireEvent.change(screen.getByTestId("work-duration-sec"), {
			target: { value: "45" },
		});

		expect(onChangeSec).toHaveBeenCalledWith(45);
	});

	it("shows validation error for out-of-range custom input", () => {
		render(
			<DurationPicker
				boundsLabel="1 s – 90 min"
				maxSec={getMaxWorkDurationSec()}
				minSec={getMinWorkDurationSec()}
				onChangeSec={vi.fn()}
				presets={getWorkDurationPresets()}
				testIdPrefix="work-duration"
				valueSec={25 * 60}
			/>,
		);

		fireEvent.change(screen.getByTestId("work-duration-min"), {
			target: { value: "91" },
		});
		fireEvent.change(screen.getByTestId("work-duration-sec"), {
			target: { value: "0" },
		});

		expect(screen.getByText(/Must be within 1 s – 90 min/)).toBeTruthy();
	});

	it("supports break prefix and max boundary", () => {
		const onChangeSec = vi.fn();
		render(
			<DurationPicker
				boundsLabel="1 s – 30 min"
				maxSec={getMaxBreakDurationSec()}
				minSec={getMinBreakDurationSec()}
				onChangeSec={onChangeSec}
				presets={getShortBreakPresets()}
				testIdPrefix="short-break-duration"
				valueSec={5 * 60}
			/>,
		);

		fireEvent.change(screen.getByTestId("short-break-duration-min"), {
			target: { value: "30" },
		});
		fireEvent.change(screen.getByTestId("short-break-duration-sec"), {
			target: { value: "0" },
		});

		expect(onChangeSec).toHaveBeenCalledWith(30 * 60);
	});
});
