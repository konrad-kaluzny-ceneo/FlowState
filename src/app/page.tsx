import { redirect } from "next/navigation";

export default async function Home({
	searchParams,
}: {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	const params = await searchParams;
	const verifier = params.neon_auth_session_verifier;

	if (verifier) {
		// Preserve the OAuth verifier param so OAuthSessionVerifier can exchange it
		redirect(
			`/focus?neon_auth_session_verifier=${encodeURIComponent(String(verifier))}`,
		);
	}

	redirect("/focus");
}
