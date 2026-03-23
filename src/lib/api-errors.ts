import { useTranslations } from "next-intl";

export type ApiErrorPayload = {
  errorCode?: string;
  error?: string;
};

export function useApiErrorMessage() {
  const t = useTranslations("errors");
  return (payload: ApiErrorPayload, fallbackKey = "fallback") => {
    if (payload.errorCode) {
      const key = payload.errorCode as Parameters<typeof t>[0];
      try {
        return t(key);
      } catch {
        return payload.error ?? t(fallbackKey as Parameters<typeof t>[0]);
      }
    }
    return payload.error ?? t(fallbackKey as Parameters<typeof t>[0]);
  };
}
