import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useOnlineStatus } from "./use-online-status";

function setNavigatorOnline(online: boolean) {
	Object.defineProperty(window.navigator, "onLine", {
		configurable: true,
		value: online,
	});
}

describe("useOnlineStatus", () => {
	beforeEach(() => {
		setNavigatorOnline(true);
	});

	afterEach(() => {
		setNavigatorOnline(true);
	});

	it("returns true when navigator is online", () => {
		const { result } = renderHook(() => useOnlineStatus());
		expect(result.current).toBe(true);
	});

	it("returns false after offline event", () => {
		const { result } = renderHook(() => useOnlineStatus());

		act(() => {
			setNavigatorOnline(false);
			window.dispatchEvent(new Event("offline"));
		});

		expect(result.current).toBe(false);
	});

	it("returns true after offline then online event", () => {
		const { result } = renderHook(() => useOnlineStatus());

		act(() => {
			setNavigatorOnline(false);
			window.dispatchEvent(new Event("offline"));
		});
		expect(result.current).toBe(false);

		act(() => {
			setNavigatorOnline(true);
			window.dispatchEvent(new Event("online"));
		});
		expect(result.current).toBe(true);
	});
});
