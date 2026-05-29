"use client";

import { useEffect, useRef } from "react";

import { useRepositories } from "~/lib/data-mode/data-mode-context";
import {
	clearGuestSnapshot,
	hasGuestData,
	loadSnapshot,
} from "~/lib/guest/store";
import { api } from "~/trpc/react";

const IMPORT_DONE_KEY = "flowstate:guest-import-done";

export function GuestImportOnMount() {
	const { mode } = useRepositories();
	const importMutation = api.guest.import.useMutation();
	const utils = api.useUtils();
	const startedRef = useRef(false);

	useEffect(() => {
		if (mode !== "authenticated" || startedRef.current || !hasGuestData()) {
			return;
		}

		const snapshot = loadSnapshot();
		const snapshotKey = JSON.stringify(snapshot);
		if (sessionStorage.getItem(IMPORT_DONE_KEY) === snapshotKey) {
			return;
		}

		startedRef.current = true;

		void (async () => {
			try {
				await importMutation.mutateAsync(snapshot);
				sessionStorage.setItem(IMPORT_DONE_KEY, snapshotKey);
				clearGuestSnapshot();
				await Promise.all([
					utils.task.list.invalidate(),
					utils.cycle.getActive.invalidate(),
				]);
			} catch {
				startedRef.current = false;
			}
		})();
	}, [importMutation, mode, utils.cycle.getActive, utils.task.list]);

	return null;
}
