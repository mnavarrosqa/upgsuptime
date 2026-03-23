import { NextResponse } from "next/server";
import { LOCALE_COOKIE, normalizeLocale } from "@/i18n/config";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const locale = normalizeLocale(typeof body.locale === "string" ? body.locale : undefined);
  const response = NextResponse.json({ success: true, locale });
  response.cookies.set(LOCALE_COOKIE, locale, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}
