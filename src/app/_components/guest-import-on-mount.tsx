"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { importGuestSnapshotAction } from "~/app/_actions/import-guest-snapshot";
import { resetActiveCycleRecoveryGuard } from "~/hooks/use-pomodoro-cycle";
import { useRepositories } from "~/lib/data-mode/data-mode-context";
import {
	loadGuestSnapshotForImport,
	markGuestImportAttempted,
	markGuestImportDone,
	shouldRunGuestImport,
} from "~/lib/guest/import-guard";
import { clearGuestSnapshot } from "~/lib/guest/store";
import { api } from "~/trpc/react";

export function GuestImportOnMount() {
	const { mode } = useRepositories();
	const utils = api.useUtils();
	const router = useRouter();
	const startedRef = useRef(false);
	const utilsRef = useRef(utils);
	const routerRef = useRef(router);
	const [importError, setImportError] = useState<string | null>(null);

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
			const snapshot = loadGuestSnapshotForImport();
			const result = await importGuestSnapshotAction(snapshot);

			if (!result.ok) {
				setImportError(
					result.error === "UNAUTHORIZED"
						? "Could not import your guest tasks because you are not signed in. Try refreshing the page."
						: "Could not import your guest tasks. Your local copy is still saved in this browser.",
				);
				return;
			}

			markGuestImportDone();
			clearGuestSnapshot();
			setImportError(null);
			resetActiveCycleRecoveryGuard();
			await Promise.all([
				utilsRef.current.task.list.invalidate(),
				utilsRef.current.cycle.getActive.invalidate(),
			]);
			routerRef.current.refresh();
		})();
	}, [mode]);

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
