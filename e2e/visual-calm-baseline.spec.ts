/**
 * Visual calm baseline — screenshot regression for improve-styles slice.
 * Tag: @skip-belt — full catalog / pre-release only.
 */
import { expect, test } from "./fixtures";
import { resetWorkerSessionViaApi } from "./helpers/seed-scenario";
import { expectFocusPageReady } from "./helpers/task-list-locator";

const VIEWPORT = { width: 1280, height: 720 };
const THEME_KEY = "flowstate-theme";

type CalmRoute = {
	path: string;
	name: string;
	waitFor: (page: import("@playwright/test").Page) => Promise<void>;
};

const ROUTES: CalmRoute[] = [
	{
		path: "/focus",
		name: "focus",
		waitFor: expectFocusPageReady,
	},
	{
		path: "/tasks",
		name: "tasks",
		waitFor: async (page) => {
			await expect(page.getByTestId("task-list")).toBeVisible({
				timeout: 15_000,
			});
		},
	},
	{
		path: "/plan",
		name: "plan",
		waitFor: async (page) => {
			await expect(page.getByTestId("plan-dnia-view")).toBeVisible({
				timeout: 15_000,
			});
		},
	},
	{
		path: "/summary",
		name: "summary",
		waitFor: async (page) => {
			await expect(page.getByTestId("podsumowanie-view")).toBeVisible({
				timeout: 15_000,
			});
		},
	},
];

async function setTheme(
	page: import("@playwright/test").Page,
	theme: "light" | "dark",
) {
	await page.addInitScript(
		([key, value]) => {
			localStorage.setItem(key, value);
			document.documentElement.dataset.theme = value;
		},
		[THEME_KEY, theme] as const,
	);
}

test.describe("Visual calm baseline @skip-belt", () => {
	test.use({ viewport: VIEWPORT });

	test.beforeEach(async ({ page }) => {
		await resetWorkerSessionViaApi(page);
	});

	for (const theme of ["light", "dark"] as const) {
		for (const route of ROUTES) {
			test(`${route.name} — ${theme}`, async ({ page }) => {
				await setTheme(page, theme);
				await page.emulateMedia({ reducedMotion: "reduce" });
				await page.goto(route.path);
				await route.waitFor(page);
				await expect(page).toHaveScreenshot(`${route.name}-${theme}.png`, {
					fullPage: false,
					maxDiffPixelRatio: 0.02,
					animations: "disabled",
				});
			});
		}
	}
});
