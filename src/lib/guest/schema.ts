import { z } from "zod";

export const GUEST_STORAGE_KEY = "flowstate:guest-v1";

export const guestTaskSchema = z.object({
	id: z.string().uuid(),
	title: z.string().min(1).max(256),
	status: z.enum(["active", "completed"]),
	workType: z
		.enum(["DEEP_WORK", "OPERATIONAL", "REACTIVE"])
		.default("OPERATIONAL"),
	weight: z.number().int().min(1).max(3).default(2),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date().nullable(),
});

export const guestSessionSchema = z.object({
	id: z.string().uuid(),
	state: z
		.enum(["ACTIVE", "ENDED_BY_USER", "ENDED_BY_TIMEOUT"])
		.default("ACTIVE"),
	startedAt: z.coerce.date(),
	endedAt: z.coerce.date().nullable(),
	lastActivityAt: z.coerce.date(),
	interruptionCount: z.number().int().default(0),
});

export const guestCycleSchema = z.object({
	id: z.string().uuid(),
	sessionId: z.string().uuid(),
	taskId: z.string().uuid().nullable(),
	kind: z.enum(["WORK", "SHORT_BREAK", "LONG_BREAK"]),
	state: z.enum(["RUNNING", "COMPLETED", "INTERRUPTED"]),
	configuredDurationSec: z
		.number()
		.int()
		.min(60)
		.max(90 * 60),
	startedAt: z.coerce.date(),
	endedAt: z.coerce.date().nullable(),
});

export const guestSnapshotV1Schema = z.object({
	version: z.literal(1),
	tasks: z.array(guestTaskSchema),
	sessions: z.array(guestSessionSchema),
	cycles: z.array(guestCycleSchema),
});

export type GuestTask = z.infer<typeof guestTaskSchema>;
export type GuestSession = z.infer<typeof guestSessionSchema>;
export type GuestCycle = z.infer<typeof guestCycleSchema>;
export type GuestSnapshotV1 = z.infer<typeof guestSnapshotV1Schema>;

export function createEmptyGuestSnapshot(): GuestSnapshotV1 {
	return {
		version: 1,
		tasks: [],
		sessions: [],
		cycles: [],
	};
}

export function parseGuestSnapshot(raw: string | null): GuestSnapshotV1 {
	if (raw == null) {
		return createEmptyGuestSnapshot();
	}

	try {
		const json: unknown = JSON.parse(raw);
		if (
			typeof json === "object" &&
			json != null &&
			"version" in json &&
			json.version !== 1
		) {
			if (process.env.NODE_ENV === "development") {
				console.warn(
					"[guest] unsupported snapshot version:",
					(json as { version: unknown }).version,
				);
			}
			return createEmptyGuestSnapshot();
		}

		const result = guestSnapshotV1Schema.safeParse(json);
		if (!result.success) {
			if (process.env.NODE_ENV === "development") {
				console.warn("[guest] invalid snapshot:", result.error.message);
			}
			return createEmptyGuestSnapshot();
		}

		return result.data;
	} catch {
		if (process.env.NODE_ENV === "development") {
			console.warn("[guest] corrupt snapshot JSON");
		}
		return createEmptyGuestSnapshot();
	}
}

export function serializeGuestSnapshot(snapshot: GuestSnapshotV1): string {
	return JSON.stringify(snapshot);
}
