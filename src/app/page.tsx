import { HomeShell } from "~/app/_components/home-shell";
import { auth } from "~/lib/auth/server";
import { api, HydrateClient } from "~/trpc/server";

export const dynamic = "force-dynamic";

export default async function Home() {
	let isAuthenticated = false;

	try {
		const { data } = await auth.getSession();
		const user = data?.user;
		isAuthenticated = Boolean(user?.id && user.email);
	} catch {
		isAuthenticated = false;
	}

	if (isAuthenticated) {
		await Promise.all([
			api.task.list.prefetch(),
			api.cycle.getActive.prefetch(),
		]);
	}

	return (
		<HydrateClient>
			<HomeShell isAuthenticated={isAuthenticated} />
		</HydrateClient>
	);
}
