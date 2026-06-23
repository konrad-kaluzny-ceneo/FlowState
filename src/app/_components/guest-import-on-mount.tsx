"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { importGuestSnapshotAction } from "~/app/_actions/import-guest-snapshot";
import { useGuestMergeUi } from "~/app/_components/guest-merge-ui-context";
import { resetActiveCycleRecoveryGuard } from "~/hooks/use-pomodoro-cycle";
import { useRepositories } from "~/lib/data-mode/data-mode-context";
import {
	loadGuestSnapshotForImport,
	markGuestImportAttempted,
	markGuestImportDone,
	shouldRunGuestImport,
} from "~/lib/guest/import-guard";
import {
	buildMergeSuccessCopy,
	extractPreviewTaskTitles,
} from "~/lib/guest/merge-copy";
import { clearGuestSnapshot } from "~/lib/guest/store";
import { setImportInFlight } from "~/lib/onboarding/defer";
import { enableAuthenticatedWedgeCoach } from "~/lib/onboarding/storage";
import { api } from "~/trpc/react";

export function GuestImportOnMount({ userId }: { userId: string }) {
	const { mode } = useRepositories();
	const { showMergeSuccess } = useGuestMergeUi();
	const utils = api.useUtils();
	const router = useRouter();
	const startedRef = useRef(false);
	const utilsRef = useRef(utils);
	const routerRef = useRef(router);
	const showMergeSuccessRef = useRef(showMergeSuccess);
	const [importError, setImportError] = useState<string | null>(null);

	showMergeSuccessRef.current = showMergeSuccess;

	utilsRef.current = utils;
	routerRef.current = router;

	useEffect(() => {
		if (
			mode !== "authenticated" ||
			startedRef.current ||
			!shouldRunGuestImport()
		) {
			return;
		}

		startedRef.current = true;
		markGuestImportAttempted();

		void (async () => {
			setImportInFlight(true);

			try {
				const snapshot = loadGuestSnapshotForImport();
				const previewTitles = extractPreviewTaskTitles(snapshot);
				const result = await importGuestSnapshotAction(snapshot);

				if (!result.ok) {
					setImportError(
						result.error === "UNAUTHORIZED"
							? "Could not import your guest tasks because you are not signed in. Try refreshing the page."
							: "Could not import your guest tasks. Your local copy is still saved in this browser.",
					);
					return;
				}

				const { importedTasks, importedCycles } = result;
				const showMergeModal = importedTasks > 0 || importedCycles > 0;

				if (showMergeModal) {
					const copy = buildMergeSuccessCopy({
						importedTasks,
						importedCycles,
						previewTitles,
					});
					showMergeSuccessRef.current(copy);
				}

				markGuestImportDone();
				enableAuthenticatedWedgeCoach({
					mode: "authenticated",
					userId,
				});
				clearGuestSnapshot();
				setImportError(null);
				resetActiveCycleRecoveryGuard();
				await Promise.all([
					utilsRef.current.task.list.invalidate(),
					utilsRef.current.cycle.getActive.invalidate(),
				]);
				// Skip refresh while merge-success is open — refresh remounts provider state
				// and drops the modal before the user dismisses it.
				if (!showMergeModal) {
					routerRef.current.refresh();
				}
			} finally {
				setImportInFlight(false);
			}
		})();
	}, [mode, userId]);

	if (importError == null) {
		return null;
	}

	return (
		<div
			className="fixed top-16 right-4 z-50 max-w-sm rounded-lg border border-amber-400/40 bg-amber-500/20 px-4 py-3 text-amber-50 text-sm shadow-lg"
			data-testid="guest-import-error"
			role="alert"
		>
			{importError}
		</div>
	);
}
