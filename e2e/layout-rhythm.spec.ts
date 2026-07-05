/**
 * Risk: D-01 visual rhythm (fix-home-layout-spacing) — geometry oracle for the
 * focus page composition contract: sidebar/header clearance, primary/secondary
 * region rhythm, no horizontal overflow.
 * Modeled on: e2e/smoke.spec.ts
 * Spec role: regression belt for the defect class structural tests can't see.
 * Runs in the desktop `chromium` project and the 375×812 `mobile-chromium`
 * project (the auth fixture builds its own context, so the viewport is applied
 * explicitly from project config below).
 */
import { expect, test } from "./fixtures";
import {
	clearOnboardingKeys,
	dismissFirstRunIfVisible,
} from "./helpers/onboarding";
import { expectFocusPageReady } from "./helpers/task-list-locator";

const SECTION_GAP_PX = 24;
const GAP_TOLERANCE_PX = 2;

test("focus page keeps sidebar/header clearance, section rhythm, and no overflow", async ({
	page,
}) => {
	test.setTimeout(60_000);

	const viewport = test.info().project.use.viewport ?? {
		width: 1280,
		height: 720,
	};
	await page.setViewportSize(viewport);

	await page.goto("/focus");
	await clearOnboardingKeys(page);
	await dismissFirstRunIfVisible(page);
	await expectFocusPageReady(page);

	// Sidebar (desktop) or mobile header never overlaps page content.
	const sidebar = await page.getByTestId("app-sidebar").boundingBox();
	const mobileHeader = await page
		.getByTestId("app-mobile-header")
		.boundingBox();
	const main = await page.locator("#home-shell-main").boundingBox();
	expect(main).not.toBeNull();
	if (main == null) {
		return;
	}

	if (sidebar) {
		// Desktop: sidebar is to the left — main starts at or after sidebar right edge.
		expect(sidebar.x + sidebar.width).toBeLessThanOrEqual(main.x + 1);
	} else if (mobileHeader) {
		// Mobile: header is above — main starts at or below header bottom edge.
		expect(mobileHeader.y + mobileHeader.height).toBeLessThanOrEqual(
			main.y + 0.5,
		);
	}

	// Section rhythm: primary and secondary regions sit one section-gap token apart.
	const primary = await page.getByTestId("home-primary-region").boundingBox();
	const secondary = await page
		.getByTestId("home-secondary-region")
		.boundingBox();
	if (primary != null && secondary != null) {
		const regionGap = secondary.y - (primary.y + primary.height);
		expect(Math.abs(regionGap - SECTION_GAP_PX)).toBeLessThanOrEqual(
			GAP_TOLERANCE_PX,
		);
	}

	// No horizontal overflow at any supported width.
	const overflow = await page.evaluate(() => ({
		scrollWidth: document.documentElement.scrollWidth,
		innerWidth: window.innerWidth,
	}));
	expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.innerWidth);
});
