import { redirect } from "next/navigation";

import { PomodoroDashboard } from "~/app/_components/pomodoro-dashboard";
import { auth } from "~/lib/auth/server";
import { api, HydrateClient } from "~/trpc/server";

export const dynamic = "force-dynamic";

export default async function Home() {
	const { data } = await auth.getSession();
	const user = data?.user;

	if (!user?.id || !user.email) {
		redirect("/auth/sign-in");
	}

	await Promise.all([api.task.list.prefetch(), api.cycle.getActive.prefetch()]);

	return (
		<HydrateClient>
			<main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#1a1a2e] to-[#16213e] text-white">
				<div className="container flex flex-col items-center justify-center gap-8 px-4 py-16">
					<h1 className="font-bold text-4xl tracking-tight">FlowState</h1>
					<p className="text-white/60">Manage your tasks. Stay in flow.</p>
					<PomodoroDashboard />
				</div>
			</main>
		</HydrateClient>
	);
}
