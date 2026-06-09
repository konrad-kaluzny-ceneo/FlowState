"use server";

import { auth } from "~/lib/auth/server";
import {
	guestSnapshotV1Schema,
	normalizeGuestSnapshot,
} from "~/lib/guest/schema";
import { importGuestSnapshot } from "~/server/api/lib/import-guest-snapshot";
import { db } from "~/server/db/index";

export type ImportGuestSnapshotResult =
	| {
			ok: true;
			importedTasks: number;
			importedCycles: number;
	  }
	| {
			ok: false;
			error: "UNAUTHORIZED" | "INVALID_SNAPSHOT" | "IMPORT_FAILED";
	  };

export async function importGuestSnapshotAction(
	input: unknown,
): Promise<ImportGuestSnapshotResult> {
	const { data: sessionData } = await auth.getSession();
	const user = sessionData?.user;

	if (!user?.id || !user.email) {
		return { ok: false, error: "UNAUTHORIZED" };
	}

	const parsed = guestSnapshotV1Schema.safeParse(input);
	if (!parsed.success) {
		return { ok: false, error: "INVALID_SNAPSHOT" };
	}

	try {
		const result = await importGuestSnapshot(
			db,
			user.id,
			normalizeGuestSnapshot(parsed.data),
		);
		return {
			ok: true,
			importedTasks: result.importedTasks,
			importedCycles: result.importedCycles,
		};
	} catch {
		return { ok: false, error: "IMPORT_FAILED" };
	}
}
