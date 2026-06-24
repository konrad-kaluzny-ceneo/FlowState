import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { HOME_SHELL_MAIN_ID } from "~/lib/design/break-atmosphere";

import { useSyncBreakAtmosphere } from "./use-sync-break-atmosphere";

describe("useSyncBreakAtmosphere", () => {
	afterEach(() => {
		document.body.innerHTML = "";
	});

	it("toggles data-break-atmosphere on home shell main", () => {
		const main = document.createElement("main");
		main.id = HOME_SHELL_MAIN_ID;
		document.body.appendChild(main);

		const { rerender } = renderHook(
			({ active }: { active: boolean }) => useSyncBreakAtmosphere(active),
			{ initialProps: { active: true } },
		);

		expect(main.getAttribute("data-break-atmosphere")).toBe("true");

		rerender({ active: false });
		expect(main.hasAttribute("data-break-atmosphere")).toBe(false);
	});
});
