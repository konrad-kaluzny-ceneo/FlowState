export const userLocaleSchema = ["en", "pl"] as const;

export type UserLocale = (typeof userLocaleSchema)[number];

export const DEFAULT_USER_LOCALE: UserLocale = "pl";

export function isUserLocale(value: string): value is UserLocale {
	return (userLocaleSchema as readonly string[]).includes(value);
}
