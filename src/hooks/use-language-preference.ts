"use client";

import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import { writeLocaleCookie } from "~/i18n/locale-client";
import {
	readGuestLanguageForMerge,
	writeLanguagePreference,
} from "~/lib/language-preference/storage";
import {
	DEFAULT_USER_LOCALE,
	type UserLocale,
	userLocaleSchema,
} from "~/lib/language-preference/types";
import type { OnboardingScope } from "~/lib/onboarding/types";
import { api } from "~/trpc/react";

function isUserLocale(value: string): value is UserLocale {
	return (userLocaleSchema as readonly string[]).includes(value);
}

export function useLanguagePreference(scope: OnboardingScope) {
	const router = useRouter();
	const activeLocale = useLocale();
	const [isPending, startTransition] = useTransition();
	const [persistError, setPersistError] = useState<string | null>(null);
	const scopeRef = useRef(scope);
	scopeRef.current = scope;

	const isGuest = scope.mode === "guest";
	const userId = isGuest ? null : scope.userId;

	const utils = api.useUtils();

	const setMutation = api.preference.set.useMutation({
		onSuccess: (data) => {
			utils.preference.get.setData(undefined, data);
		},
	});

	const preferenceQuery = api.preference.get.useQuery(undefined, {
		enabled: !isGuest && userId != null,
	});

	const guestMergeAttemptedRef = useRef(false);
	const mergeScopeKeyRef = useRef(isGuest ? "guest" : (userId ?? "unknown"));

	useEffect(() => {
		const scopeKey = isGuest ? "guest" : (userId ?? "unknown");
		if (mergeScopeKeyRef.current !== scopeKey) {
			mergeScopeKeyRef.current = scopeKey;
			guestMergeAttemptedRef.current = false;
		}

		if (isGuest || userId == null || !preferenceQuery.isFetched) {
			return;
		}

		if (guestMergeAttemptedRef.current) {
			return;
		}

		guestMergeAttemptedRef.current = true;

		const serverLanguage = preferenceQuery.data?.language ?? null;
		const guestLanguage = readGuestLanguageForMerge();

		if (
			guestLanguage != null &&
			(serverLanguage == null || serverLanguage === DEFAULT_USER_LOCALE)
		) {
			writeLocaleCookie(guestLanguage);
			writeLanguagePreference(scopeRef.current, guestLanguage);
			void setMutation.mutateAsync({ language: guestLanguage }).then(() => {
				startTransition(() => {
					router.refresh();
				});
			});
			return;
		}

		if (serverLanguage != null) {
			writeLocaleCookie(serverLanguage);
			writeLanguagePreference(scopeRef.current, serverLanguage);
		}
	}, [
		isGuest,
		userId,
		preferenceQuery.isFetched,
		preferenceQuery.data,
		router,
		setMutation,
	]);

	const locale: UserLocale = isUserLocale(activeLocale)
		? activeLocale
		: DEFAULT_USER_LOCALE;

	const setLocale = useCallback(
		(next: UserLocale) => {
			if (next === locale) {
				return;
			}

			setPersistError(null);
			writeLocaleCookie(next);
			writeLanguagePreference(scopeRef.current, next);
			document.documentElement.lang = next;

			void (async () => {
				if (!isGuest && userId != null) {
					try {
						await setMutation.mutateAsync({ language: next });
					} catch {
						setPersistError(
							"Language saved for this visit — account sync will retry later.",
						);
						return;
					}
				}

				startTransition(() => {
					router.refresh();
				});
			})();
		},
		[isGuest, locale, router, setMutation, userId],
	);

	return {
		locale,
		setLocale,
		isPending,
		persistError,
		isHydrated: isGuest || preferenceQuery.isFetched,
	};
}
