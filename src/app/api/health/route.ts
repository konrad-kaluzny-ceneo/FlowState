import { NextResponse } from "next/server";
import { db } from "~/server/db";

export const dynamic = "force-dynamic";

type CheckStatus = "ok" | "fail";

interface HealthResponse {
	status: "ok" | "degraded";
	checks: {
		database: CheckStatus;
		auth: CheckStatus;
	};
}

const TIMEOUT_MS = 5_000;

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	const timeout = new Promise<never>((_, reject) => {
		timer = setTimeout(() => reject(new Error("Timeout")), ms);
	});
	try {
		return await Promise.race([promise, timeout]);
	} finally {
		clearTimeout(timer);
	}
}

async function checkDatabase(): Promise<CheckStatus> {
	try {
		await withTimeout(db.$queryRaw`SELECT 1`, TIMEOUT_MS);
		return "ok";
	} catch {
		return "fail";
	}
}

async function checkAuth(): Promise<CheckStatus> {
	try {
		// Read via process.env, not the validated `~/env` accessor, for parity with
		// `src/lib/auth/server.ts` — the auth client resolves the same variable the
		// same way, so the probe checks exactly what auth will use. (It also lets
		// route tests stub the value at runtime.)
		const baseUrl = process.env.NEON_AUTH_BASE_URL;
		if (!baseUrl) return "fail";

		const res = await fetch(`${baseUrl}/.well-known/jwks.json`, {
			method: "GET",
			signal: AbortSignal.timeout(TIMEOUT_MS),
		});
		if (!res.ok) throw new Error(`Auth config returned ${res.status}`);
		return "ok";
	} catch {
		return "fail";
	}
}

export async function GET(): Promise<NextResponse<HealthResponse>> {
	const [database, auth] = await Promise.all([checkDatabase(), checkAuth()]);

	const status = database === "ok" && auth === "ok" ? "ok" : "degraded";
	const statusCode = status === "ok" ? 200 : 503;

	return NextResponse.json(
		{ status, checks: { database, auth } },
		{ status: statusCode },
	);
}
