"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Tabs } from "radix-ui";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import {
  User,
  Globe,
  Lock,
  BookOpen,
  Code2,
} from "lucide-react";

const TAB_VALUES = ["profile", "security", "status", "guide", "developer"] as const;
type TabValue = (typeof TAB_VALUES)[number];

function isTabValue(v: string): v is TabValue {
  return (TAB_VALUES as readonly string[]).includes(v);
}

const TAB_ICONS: Record<TabValue, typeof User> = {
  profile: User,
  status: Globe,
  security: Lock,
  guide: BookOpen,
  developer: Code2,
};

const mobileTriggerClass = cn(
  "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-2 text-sm font-medium transition-colors",
  "text-text-muted hover:text-text-primary",
  "data-[state=active]:text-text-primary",
  "border-b-2 border-transparent data-[state=active]:border-accent",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
);

const sidebarTriggerClass = cn(
  "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors text-left",
  "text-text-muted hover:bg-muted/50 hover:text-text-primary",
  "data-[state=active]:bg-accent/10 data-[state=active]:text-accent",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
);

interface AccountTabsProps {
  profile: ReactNode;
  security: ReactNode;
  status: ReactNode;
  guide: ReactNode;
  developer: ReactNode;
  userCard?: ReactNode;
}

export function AccountTabs({
  profile,
  security,
  status,
  guide,
  developer,
  userCard,
}: AccountTabsProps) {
  const t = useTranslations("account");
  const [tab, setTab] = useState<TabValue>("profile");

  useEffect(() => {
    const id = window.setTimeout(() => {
      const hash = window.location.hash.slice(1);
      if (hash === "onboarding") {
        setTab("guide");
      } else if (hash === "status") {
        setTab("status");
      }
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  const tabEntries: { value: TabValue; labelKey: string }[] = [
    { value: "profile", labelKey: "tabProfile" },
    { value: "status", labelKey: "tabStatusPage" },
    { value: "security", labelKey: "tabSecurity" },
    { value: "guide", labelKey: "tabGuide" },
    { value: "developer", labelKey: "tabDeveloper" },
  ];

  return (
    <Tabs.Root
      value={tab}
      onValueChange={(v) => isTabValue(v) && setTab(v)}
      orientation="vertical"
    >
      {/* Mobile: horizontal tabs */}
      <div className="md:hidden">
        <div className="-mx-4 overflow-x-auto border-b border-border px-4 sm:-mx-6 sm:px-6">
          <Tabs.List
            aria-label={t("tabsNavLabel")}
            className="flex gap-1"
          >
            {tabEntries.map(({ value, labelKey }) => {
              const Icon = TAB_ICONS[value];
              return (
                <Tabs.Trigger
                  key={value}
                  value={value}
                  className={mobileTriggerClass}
                >
                  <Icon className="size-3.5" aria-hidden />
                  {t(labelKey)}
                </Tabs.Trigger>
              );
            })}
          </Tabs.List>
        </div>
        <div className="mt-6">
          <TabPanels
            profile={profile}
            security={security}
            status={status}
            guide={guide}
            developer={developer}
          />
        </div>
      </div>

      {/* Desktop: sidebar + content */}
      <div className="hidden md:flex md:gap-8 lg:gap-10">
        <div className="w-56 shrink-0">
          {userCard && <div className="mb-4">{userCard}</div>}
          <Tabs.List
            aria-label={t("tabsNavLabel")}
            className="flex flex-col gap-0.5"
          >
            {tabEntries.map(({ value, labelKey }) => {
              const Icon = TAB_ICONS[value];
              return (
                <Tabs.Trigger
                  key={value}
                  value={value}
                  className={sidebarTriggerClass}
                >
                  <Icon className="size-4 shrink-0" aria-hidden />
                  {t(labelKey)}
                </Tabs.Trigger>
              );
            })}
          </Tabs.List>
        </div>
        <div className="min-w-0 flex-1">
          <TabPanels
            profile={profile}
            security={security}
            status={status}
            guide={guide}
            developer={developer}
          />
        </div>
      </div>
    </Tabs.Root>
  );
}

function TabPanels({
  profile,
  security,
  status,
  guide,
  developer,
}: Omit<AccountTabsProps, "userCard">) {
  const panelClass = "outline-none";
  return (
    <>
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
    </>
  );
}
