import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HOME_SHELL_MAIN_ID } from "~/lib/design/break-atmosphere";

import { useSyncWorkFocusShell } from "./use-sync-work-focus-shell";

describe("useSyncWorkFocusShell", () => {
	it("toggles data-work-focus-shell on home shell main", () => {
		const main = document.createElement("main");
		main.id = HOME_SHELL_MAIN_ID;
		document.body.appendChild(main);

		const { rerender, unmount } = renderHook(
			({ active }) => useSyncWorkFocusShell(active),
			{ initialProps: { active: false } },
		);

		expect(main.hasAttribute("data-work-focus-shell")).toBe(false);

		rerender({ active: true });
		expect(main.getAttribute("data-work-focus-shell")).toBe("true");

		rerender({ active: false });
		expect(main.hasAttribute("data-work-focus-shell")).toBe(false);

		unmount();
		expect(main.hasAttribute("data-work-focus-shell")).toBe(false);
		document.body.removeChild(main);
	});
});
