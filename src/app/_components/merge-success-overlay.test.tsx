import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { buildMergeSuccessCopy } from "~/lib/guest/merge-copy";

import { MergeSuccessOverlay } from "./merge-success-overlay";

describe("MergeSuccessOverlay", () => {
	const copy = buildMergeSuccessCopy({
		importedTasks: 2,
		importedCycles: 0,
		previewTitles: ["Merge Order A", "Merge Order B"],
	});

	it("renders overlay with merge copy and dismiss CTA", () => {
		render(<MergeSuccessOverlay copy={copy} onDismiss={vi.fn()} visible />);

		expect(screen.getByTestId("merge-success-overlay")).toBeTruthy();
		expect(
			screen.getByRole("heading", { name: "Your trial work is saved" }),
		).toBeTruthy();
		expect(screen.getByText("Imported 2 tasks.")).toBeTruthy();
		expect(screen.getByText("Merge Order A")).toBeTruthy();
		expect(screen.getByText("Merge Order B")).toBeTruthy();
		expect(screen.getByTestId("merge-success-dismiss-btn")).toBeTruthy();
		expect(screen.getByRole("button", { name: "Continue" })).toBeTruthy();
	});

	it("returns null when not visible", () => {
		render(
			<MergeSuccessOverlay copy={copy} onDismiss={vi.fn()} visible={false} />,
		);

		expect(screen.queryByTestId("merge-success-overlay")).toBeNull();
	});

	it("calls onDismiss when Continue is clicked", () => {
		const onDismiss = vi.fn();
		render(<MergeSuccessOverlay copy={copy} onDismiss={onDismiss} visible />);

		fireEvent.click(screen.getByTestId("merge-success-dismiss-btn"));

		expect(onDismiss).toHaveBeenCalledTimes(1);
	});
});
