/**
 * Risk: D-01 visual rhythm (fix-home-layout-spacing) — geometry oracle for the
 * home composition contract: navbar clearance, one left edge per column,
 * token-driven section rhythm, no horizontal overflow.
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
import { expectTaskListVisible } from "./helpers/task-list-locator";
import { addTask } from "./helpers/work-cycle";

const SECTION_GAP_PX = 24;
const GAP_TOLERANCE_PX = 2;
const EDGE_TOLERANCE_PX = 1;

test("home keeps navbar clearance, aligned edges, and section rhythm", async ({
	page,
}) => {
	test.setTimeout(60_000);

	const viewport = test.info().project.use.viewport ?? {
		width: 1280,
		height: 720,
	};
	await page.setViewportSize(viewport);

	await page.goto("/");
	await clearOnboardingKeys(page);
	await dismissFirstRunIfVisible(page);
	await expectTaskListVisible(page);

	// A task guarantees day-memory (remaining count) + task-list sections.
	await addTask(page, `Rhythm probe ${Date.now()}`);
	await expect(page.getByTestId("day-memory-line")).toBeVisible();

	// Navbar occupies layout space — it never overlaps page content.
	const navbar = await page.getByTestId("app-navbar").boundingBox();
	const main = await page.locator("#home-shell-main").boundingBox();
	expect(navbar).not.toBeNull();
	expect(main).not.toBeNull();
	if (navbar == null || main == null) {
		return;
	}
	expect(navbar.y + navbar.height).toBeLessThanOrEqual(main.y + 0.5);

	// One left edge per column: sections across regions share their x origin.
	const dayMemory = await page.getByTestId("day-memory-line").boundingBox();
	const taskList = await page.getByTestId("task-list").boundingBox();
	expect(dayMemory).not.toBeNull();
	expect(taskList).not.toBeNull();
	if (dayMemory == null || taskList == null) {
		return;
	}
	expect(Math.abs(dayMemory.x - taskList.x)).toBeLessThanOrEqual(
		EDGE_TOLERANCE_PX,
	);

	// Section rhythm: adjacent regions sit one section-gap token apart.
	const primary = await page.getByTestId("home-primary-region").boundingBox();
	const secondary = await page
		.getByTestId("home-secondary-region")
		.boundingBox();
	expect(primary).not.toBeNull();
	expect(secondary).not.toBeNull();
	if (primary == null || secondary == null) {
		return;
	}
	const regionGap = secondary.y - (primary.y + primary.height);
	expect(Math.abs(regionGap - SECTION_GAP_PX)).toBeLessThanOrEqual(
		GAP_TOLERANCE_PX,
	);

	// No horizontal overflow at any supported width.
	const overflow = await page.evaluate(() => ({
		scrollWidth: document.documentElement.scrollWidth,
		innerWidth: window.innerWidth,
	}));
	expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.innerWidth);
});
