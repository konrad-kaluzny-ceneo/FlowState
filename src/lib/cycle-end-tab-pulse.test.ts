import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	isCycleEndTabPulseActive,
	startCycleEndTabPulse,
	stopCycleEndTabPulse,
} from "./cycle-end-tab-pulse";

describe("cycle-end-tab-pulse", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		document.head.innerHTML = "";
		const title = document.createElement("title");
		title.textContent = "FlowState";
		document.head.appendChild(title);
	});

	afterEach(() => {
		stopCycleEndTabPulse();
		vi.useRealTimers();
	});

	it("toggles title prefix on interval and restores on stop", () => {
		startCycleEndTabPulse({ reducedMotion: true });

		expect(document.title).toBe("● FlowState");
		expect(isCycleEndTabPulseActive()).toBe(true);

		vi.advanceTimersByTime(1500);
		expect(document.title).toBe("FlowState");

		vi.advanceTimersByTime(1500);
		expect(document.title).toBe("● FlowState");

		stopCycleEndTabPulse();
		expect(document.title).toBe("FlowState");
		expect(isCycleEndTabPulseActive()).toBe(false);
	});

	it("is idempotent on repeated start", () => {
		startCycleEndTabPulse({ reducedMotion: true });
		startCycleEndTabPulse({ reducedMotion: true });

		expect(document.title).toBe("● FlowState");

		vi.advanceTimersByTime(1500);
		expect(document.title).toBe("FlowState");
	});

	it("swaps favicon href when reduced motion is false", () => {
		const link = document.createElement("link");
		link.rel = "icon";
		link.href = "/favicon.ico";
		document.head.appendChild(link);

		startCycleEndTabPulse({ reducedMotion: false });

		expect(link.href).toContain("pulse=1");

		vi.advanceTimersByTime(1500);
		expect(link.href).not.toContain("pulse=1");

		stopCycleEndTabPulse();
		expect(link.href).not.toContain("pulse=1");
	});

	it("does not mutate favicon when reduced motion is true", () => {
		const link = document.createElement("link");
		link.rel = "icon";
		link.href = "/favicon.ico";
		document.head.appendChild(link);
		const initialHref = link.href;

		startCycleEndTabPulse({ reducedMotion: true });

		vi.advanceTimersByTime(3000);
		expect(link.href).toBe(initialHref);

		stopCycleEndTabPulse();
		expect(link.href).toBe(initialHref);
	});
});
