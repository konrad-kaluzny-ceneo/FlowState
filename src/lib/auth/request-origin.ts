import { headers } from "next/headers";

export async function getRequestOrigin(): Promise<string> {
	const h = await headers();
	const proto = h.get("x-forwarded-proto") ?? "http";
	const host = h.get("x-forwarded-host") ?? h.get("host");
	if (!host) {
		throw new Error("Missing host header for redirectTo");
	}
	return `${proto}://${host}`;
}
