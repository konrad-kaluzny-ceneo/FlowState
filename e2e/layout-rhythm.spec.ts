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
import { dismissKickoffSteeringIfVisible } from "./helpers/kickoff";
import {
	clearOnboardingKeys,
	dismissFirstRunIfVisible,
} from "./helpers/onboarding";
import { resetWorkerSessionViaApi } from "./helpers/seed-scenario";
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

	await resetWorkerSessionViaApi(page);
	await page.goto("/focus");
	await clearOnboardingKeys(page);
	await dismissFirstRunIfVisible(page);
	await expectFocusPageReady(page);
	await dismissKickoffSteeringIfVisible(page);

	// After dismissing steering, wait for workbench grid or timer panel to appear
	await expect(
		page
			.getByTestId("home-workbench-grid")
			.or(page.getByTestId("timer-panel-idle"))
			.first(),
	).toBeVisible({ timeout: 15_000 });

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
	// These regions may not exist depending on the page state (e.g., idle with no focused task).
	const primaryLocator = page.getByTestId("home-primary-region");
	const secondaryLocator = page.getByTestId("home-secondary-region");
	const primaryVisible = await primaryLocator.isVisible().catch(() => false);
	const secondaryVisible = await secondaryLocator
		.isVisible()
		.catch(() => false);
	if (primaryVisible && secondaryVisible) {
		const primary = await primaryLocator.boundingBox();
		const secondary = await secondaryLocator.boundingBox();
		if (primary != null && secondary != null) {
			const regionGap = secondary.y - (primary.y + primary.height);
			expect(Math.abs(regionGap - SECTION_GAP_PX)).toBeLessThanOrEqual(
				GAP_TOLERANCE_PX,
			);
		}
	}

	// No horizontal overflow at any supported width.
	const overflow = await page.evaluate(() => ({
		scrollWidth: document.documentElement.scrollWidth,
		innerWidth: window.innerWidth,
	}));
	expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.innerWidth);
});
