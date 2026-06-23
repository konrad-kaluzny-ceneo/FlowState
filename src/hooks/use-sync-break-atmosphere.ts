"use client";

import { useEffect } from "react";

import { HOME_SHELL_MAIN_ID } from "~/lib/design/break-atmosphere";

export function useSyncBreakAtmosphere(active: boolean) {
	useEffect(() => {
		const main = document.getElementById(HOME_SHELL_MAIN_ID);
		if (main == null) {
			return;
		}
		if (active) {
			main.setAttribute("data-break-atmosphere", "true");
		} else {
			main.removeAttribute("data-break-atmosphere");
		}
		return () => {
			main.removeAttribute("data-break-atmosphere");
		};
	}, [active]);
}
