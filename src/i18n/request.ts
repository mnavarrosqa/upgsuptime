import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { DEFAULT_LOCALE, LOCALE_COOKIE, normalizeLocale } from "./config";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const headerStore = await headers();

  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
  const acceptLanguage = headerStore.get("accept-language");
  const session = await getServerSession(authOptions);
  const profileLocale = session?.user?.language;
  // Cookie wins so changing language in the UI applies on the next request
  // before the session JWT is refreshed (and matches LanguageSelect + /api/locale).
  const preferred =
    cookieLocale ??
    profileLocale ??
    acceptLanguage?.split(",")[0]?.trim() ??
    DEFAULT_LOCALE;
  const locale = normalizeLocale(preferred);

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
