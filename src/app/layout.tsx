import "~/styles/globals.css";

import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";

import { auth } from "~/lib/auth/server";
import { TRPCReactProvider } from "~/trpc/react";
import { OAuthSessionVerifier } from "./_components/oauth-session-verifier";
import { ThemeProvider } from "./_components/theme-provider";
import { ThemeScript } from "./_components/theme-script";
import { UserMenu } from "./_components/user-menu";

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
		<html
			className={`${geist.variable}`}
			data-theme="light"
			lang={locale}
			suppressHydrationWarning
		>
			<head>
				<ThemeScript />
			</head>
			<body>
				<NextIntlClientProvider locale={locale} messages={messages}>
					<TRPCReactProvider>
						<ThemeProvider>
							<OAuthSessionVerifier />
							{userName && (
								<header className="fixed top-0 right-0 z-50 p-4">
									<UserMenu userName={userName} />
								</header>
							)}
							{children}
						</ThemeProvider>
					</TRPCReactProvider>
				</NextIntlClientProvider>
			</body>
		</html>
	);
}
