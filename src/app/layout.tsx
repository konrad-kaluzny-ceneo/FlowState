import "~/styles/globals.css";

import type { Metadata } from "next";
import { Geist } from "next/font/google";

import { auth } from "~/lib/auth/server";
import { TRPCReactProvider } from "~/trpc/react";
import { OAuthSessionVerifier } from "./_components/oauth-session-verifier";
import { UserMenu } from "./_components/user-menu";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
	title: "FlowState",
	description: "Mindful Pomodoro with session-aware task suggestions",
	icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const geist = Geist({
	subsets: ["latin"],
	variable: "--font-geist-sans",
});

export default async function RootLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	let userName: string | null = null;

	try {
		const result = await auth.getSession();
		const user = result.data?.user;
		if (user?.name) {
			userName = user.name;
		} else if (user?.email) {
			userName = user.email.split("@")[0] ?? null;
		}
	} catch {
		userName = null;
	}

	return (
		<html className={`${geist.variable}`} lang="en">
			<body>
				<TRPCReactProvider>
					<OAuthSessionVerifier />
					{userName && (
						<header className="fixed top-0 right-0 z-50 p-4">
							<UserMenu userName={userName} />
						</header>
					)}
					{children}
				</TRPCReactProvider>
			</body>
		</html>
	);
}
