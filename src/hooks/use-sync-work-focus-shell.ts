"use client";

import { useEffect } from "react";

import { HOME_SHELL_MAIN_ID } from "~/lib/design/break-atmosphere";

export function useSyncWorkFocusShell(active: boolean) {
	useEffect(() => {
		const main = document.getElementById(HOME_SHELL_MAIN_ID);
		if (main == null) {
			return;
		}
		if (active) {
			main.setAttribute("data-work-focus-shell", "true");
		} else {
			main.removeAttribute("data-work-focus-shell");
		}
		return () => {
			main.removeAttribute("data-work-focus-shell");
		};
	}, [active]);
}
