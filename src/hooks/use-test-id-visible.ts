"use client";

import { useEffect, useState } from "react";

function isTestIdVisible(testId: string): boolean {
	if (typeof document === "undefined") {
		return false;
	}

	const element = document.querySelector(`[data-testid="${testId}"]`);
	if (element == null) {
		return false;
	}

	const style = window.getComputedStyle(element);
	if (
		style.display === "none" ||
		style.visibility === "hidden" ||
		Number.parseFloat(style.opacity) === 0
	) {
		return false;
	}

	const rect = element.getBoundingClientRect();
	return rect.width > 0 || rect.height > 0;
}

export function useTestIdVisible(testId: string): boolean {
	const [visible, setVisible] = useState(false);

	useEffect(() => {
		const check = () => {
			setVisible(isTestIdVisible(testId));
		};

		check();

		const observer = new MutationObserver(check);
		observer.observe(document.body, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ["style", "class", "hidden", "data-testid"],
		});

		return () => {
			observer.disconnect();
		};
	}, [testId]);

	return visible;
}
