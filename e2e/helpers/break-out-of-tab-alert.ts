import type { Page } from "@playwright/test";

/** Install Notification stub for break-out-of-tab e2e (current page + future navigations). */
export async function installBreakNotificationMock(page: Page) {
	const installer = () => {
		(
			window as unknown as { __breakNotificationShown?: boolean }
		).__breakNotificationShown = false;

		class MockNotification {
			static permission: NotificationPermission = "granted";
			static requestPermission() {
				return Promise.resolve("granted" as NotificationPermission);
			}

			constructor(_title: string, _options?: NotificationOptions) {
				(
					window as unknown as { __breakNotificationShown?: boolean }
				).__breakNotificationShown = true;
			}

			onclick: (() => void) | null = null;

			close() {}
		}

		Object.defineProperty(globalThis, "Notification", {
			configurable: true,
			writable: true,
			value: MockNotification,
		});
	};

	await page.addInitScript(installer);
	await page.evaluate(installer);
}

export async function readBreakNotificationShown(page: Page): Promise<boolean> {
	return page.evaluate(
		() =>
			(window as unknown as { __breakNotificationShown?: boolean })
				.__breakNotificationShown === true,
	);
}
