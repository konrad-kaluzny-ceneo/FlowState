import "~/styles/globals.css";

import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";

import { auth } from "~/lib/auth/server";
import { DataModeProvider } from "~/lib/data-mode/data-mode-context";
import type { OnboardingScope } from "~/lib/onboarding/types";
import { TRPCReactProvider } from "~/trpc/react";
import { AppShell } from "./_components/app-shell";
import { AppUserProvider } from "./_components/app-user-context";
import { OAuthSessionVerifier } from "./_components/oauth-session-verifier";
import { PomodoroCycleProvider } from "./_components/pomodoro-cycle-provider";
import { ThemeProvider } from "./_components/theme-provider";
import { ThemeScript } from "./_components/theme-script";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("App");

	return {
		title: t("title"),
		description: t("description"),
		icons: [{ rel: "icon", url: "/favicon.ico" }],
	};
}

const geist = Geist({
	subsets: ["latin"],
	variable: "--font-geist-sans",
});

export default async function RootLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	const locale = await getLocale();
	const messages = await getMessages();
	let userName: string | null = null;
	let userId: string | null = null;

	try {
		const result = await auth.getSession();
		const user = result.data?.user;
		if (user?.id && user.email) {
			userId = user.id;
		}
		if (user?.name) {
			userName = user.name;
		} else if (user?.email) {
			userName = user.email.split("@")[0] ?? null;
		}
	} catch {
		userName = null;
		userId = null;
	}

	const scope: OnboardingScope = userId
		? { mode: "authenticated", userId }
		: { mode: "guest" };

	return (
		<html
			className={`${geist.variable}`}
			data-theme="light"
			lang={locale}
			suppressHydrationWarning
		>
			<head>
				<ThemeScript />
			</head>
			<body className="flex min-h-screen flex-col">
				<NextIntlClientProvider locale={locale} messages={messages}>
					<TRPCReactProvider>
						<ThemeProvider>
							<OAuthSessionVerifier />
							<DataModeProvider mode={scope.mode}>
								<AppUserProvider scope={scope} userName={userName}>
									<PomodoroCycleProvider scope={scope}>
										<AppShell scope={scope} userName={userName}>
											{children}
										</AppShell>
									</PomodoroCycleProvider>
								</AppUserProvider>
							</DataModeProvider>
						</ThemeProvider>
					</TRPCReactProvider>
				</NextIntlClientProvider>
			</body>
		</html>
	);
}
