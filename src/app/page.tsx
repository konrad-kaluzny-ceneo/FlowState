import { HomeShell } from "~/app/_components/home-shell";
import { auth } from "~/lib/auth/server";
import { formatLocalDateKey } from "~/lib/time/local-date-key";
import { api, HydrateClient } from "~/trpc/server";

export const dynamic = "force-dynamic";

export default async function Home() {
	let isAuthenticated = false;
	let user: { id: string; email?: string | null } | undefined;

	try {
		const { data } = await auth.getSession();
		user = data?.user;
		isAuthenticated = Boolean(user?.id && user.email);
	} catch {
		isAuthenticated = false;
		user = undefined;
	}

	if (isAuthenticated) {
		const localDateKey = formatLocalDateKey();
		await Promise.all([
			api.task.list.prefetch(),
			api.cycle.getActive.prefetch(),
			api.recap.getDaily.prefetch({ localDateKey }),
		]);
	}

	return (
		<HydrateClient>
			<HomeShell isAuthenticated={isAuthenticated} userId={user?.id ?? null} />
		</HydrateClient>
	);
}
