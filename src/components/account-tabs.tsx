"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Tabs } from "radix-ui";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

const TAB_VALUES = ["profile", "security", "status", "guide", "developer"] as const;
type TabValue = (typeof TAB_VALUES)[number];

function isTabValue(v: string): v is TabValue {
  return (TAB_VALUES as readonly string[]).includes(v);
}

const triggerClass = cn(
  "inline-flex shrink-0 items-center justify-center rounded-md px-3 py-2 text-sm font-medium transition-colors",
  "text-text-muted hover:bg-bg-muted/60 hover:text-text-primary",
  "data-[state=active]:bg-accent data-[state=active]:text-bg-card",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
);

const panelClass = "mt-6 outline-none";

interface AccountTabsProps {
  profile: ReactNode;
  security: ReactNode;
  status: ReactNode;
  guide: ReactNode;
  developer: ReactNode;
}

export function AccountTabs({
  profile,
  security,
  status,
  guide,
  developer,
}: AccountTabsProps) {
  const t = useTranslations("account");
  const [tab, setTab] = useState<TabValue>("profile");

  useEffect(() => {
    const hash = typeof window !== "undefined" ? window.location.hash.slice(1) : "";
    if (hash === "onboarding") {
      setTab("guide");
    } else if (hash === "status") {
      setTab("status");
    }
  }, []);

  return (
    <Tabs.Root value={tab} onValueChange={(v) => isTabValue(v) && setTab(v)} className="mt-8">
      <div className="border-b border-border">
        <Tabs.List
          aria-label={t("tabsNavLabel")}
          className="-mb-px flex flex-wrap gap-1 pb-px"
        >
          <Tabs.Trigger value="profile" className={triggerClass}>
            {t("tabProfile")}
          </Tabs.Trigger>
          <Tabs.Trigger value="status" className={triggerClass}>
            {t("tabStatusPage")}
          </Tabs.Trigger>
          <Tabs.Trigger value="security" className={triggerClass}>
            {t("tabSecurity")}
          </Tabs.Trigger>
          <Tabs.Trigger value="guide" className={triggerClass}>
            {t("tabGuide")}
          </Tabs.Trigger>
          <Tabs.Trigger value="developer" className={triggerClass}>
            {t("tabDeveloper")}
          </Tabs.Trigger>
        </Tabs.List>
      </div>

      <Tabs.Content value="profile" className={panelClass}>
        {profile}
      </Tabs.Content>
      <Tabs.Content value="security" className={panelClass}>
        {security}
      </Tabs.Content>
      <Tabs.Content value="status" className={panelClass}>
        {status}
      </Tabs.Content>
      <Tabs.Content value="guide" className={panelClass}>
        {guide}
      </Tabs.Content>
      <Tabs.Content value="developer" className={panelClass}>
        {developer}
      </Tabs.Content>
    </Tabs.Root>
  );
}
