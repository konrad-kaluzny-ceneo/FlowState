import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createGuestRepositories } from "~/lib/repositories/guest-repositories";

import { GuestImportOnMount } from "./guest-import-on-mount";

const showMergeSuccess = vi.fn();
const importGuestSnapshotAction = vi.fn();
const refresh = vi.fn();
const invalidateTaskList = vi.fn();
const invalidateActiveCycle = vi.fn();

vi.mock("~/lib/data-mode/data-mode-context", () => ({
	useRepositories: () => ({ mode: "authenticated" }),
}));

vi.mock("~/app/_components/guest-merge-ui-context", () => ({
	useGuestMergeUi: () => ({ showMergeSuccess }),
}));

vi.mock("~/app/_actions/import-guest-snapshot", () => ({
	importGuestSnapshotAction: (...args: unknown[]) =>
		importGuestSnapshotAction(...args),
}));

vi.mock("next/navigation", () => ({
	useRouter: () => ({ refresh }),
}));

vi.mock("~/trpc/react", () => ({
	api: {
		useUtils: () => ({
			task: { list: { invalidate: invalidateTaskList } },
			cycle: { getActive: { invalidate: invalidateActiveCycle } },
		}),
	},
}));

describe("GuestImportOnMount", () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		localStorage.clear();
		sessionStorage.clear();

		const { tasks } = createGuestRepositories();
		await tasks.create({ title: "Guest import task" });

		importGuestSnapshotAction.mockResolvedValue({
			ok: true,
			importedTasks: 1,
			importedCycles: 0,
		});
	});

	it("imports guest snapshot once when authenticated with local guest data", async () => {
		const { rerender } = render(<GuestImportOnMount />);

		await waitFor(() => {
			expect(importGuestSnapshotAction).toHaveBeenCalledTimes(1);
		});
		expect(showMergeSuccess).toHaveBeenCalledTimes(1);

		rerender(<GuestImportOnMount />);
		expect(importGuestSnapshotAction).toHaveBeenCalledTimes(1);
	});
});
