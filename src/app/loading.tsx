import { useTranslations } from "next-intl";
import { BrandLoading } from "@/components/brand-loading";

export default function Loading() {
  const t = useTranslations("common");
  return <BrandLoading label={t("loading")} fullScreen />;
}
