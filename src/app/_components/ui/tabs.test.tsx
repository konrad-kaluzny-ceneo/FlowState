import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { TabPanel, Tabs } from "./tabs";

const ITEMS = [
	{ value: "active", label: "Aktywne" },
	{ value: "planned", label: "Planowane" },
	{ value: "completed", label: "Ukończone" },
];

function ControlledTabs() {
	const [value, setValue] = useState("active");
	return (
		<>
			<Tabs
				aria-label="Zadania"
				id="zadania-tabs"
				items={ITEMS}
				onChange={setValue}
				value={value}
			/>
			<TabPanel activeValue={value} tabsId="zadania-tabs" value="active">
				Active panel
			</TabPanel>
			<TabPanel activeValue={value} tabsId="zadania-tabs" value="planned">
				Planned panel
			</TabPanel>
			<TabPanel activeValue={value} tabsId="zadania-tabs" value="completed">
				Completed panel
			</TabPanel>
		</>
	);
}

describe("Tabs", () => {
	it("renders a tablist with the expected roles", () => {
		render(<ControlledTabs />);
		expect(screen.getByRole("tablist", { name: "Zadania" })).toBeTruthy();
		expect(screen.getAllByRole("tab")).toHaveLength(3);
	});

	it("switches the active tab and panel on click", () => {
		render(<ControlledTabs />);
		expect(screen.getByText("Active panel")).toBeTruthy();

		fireEvent.click(screen.getByRole("tab", { name: "Planowane" }));

		expect(screen.queryByText("Active panel")).toBeNull();
		expect(screen.getByText("Planned panel")).toBeTruthy();
		expect(
			screen
				.getByRole("tab", { name: "Planowane" })
				.getAttribute("aria-selected"),
		).toBe("true");
	});

	it("moves selection with ArrowRight and wraps around", () => {
		render(<ControlledTabs />);
		const tablist = screen.getByRole("tablist");

		fireEvent.keyDown(tablist, { key: "ArrowRight" });
		expect(screen.getByText("Planned panel")).toBeTruthy();

		fireEvent.keyDown(tablist, { key: "ArrowRight" });
		expect(screen.getByText("Completed panel")).toBeTruthy();

		fireEvent.keyDown(tablist, { key: "ArrowRight" });
		expect(screen.getByText("Active panel")).toBeTruthy();
	});

	it("only the active tab is in the tab order", () => {
		render(<ControlledTabs />);
		const tabs = screen.getAllByRole("tab");
		const active = tabs.find((tab) => tab.textContent === "Aktywne");
		const inactive = tabs.filter((tab) => tab.textContent !== "Aktywne");

		expect(active?.getAttribute("tabindex")).toBe("0");
		for (const tab of inactive) {
			expect(tab.getAttribute("tabindex")).toBe("-1");
		}
	});
});
