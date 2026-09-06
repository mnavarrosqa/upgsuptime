import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const navigation = vi.hoisted(() => ({
  pathname: "/dashboard",
  destination: "/monitors" as string | null,
  pending: false,
}));

vi.mock("react", async (importOriginal) => ({
  ...await importOriginal<typeof import("react")>(),
  useTransition: () => [navigation.pending, vi.fn()],
  // Model a retained destination after completing a navigation and pressing Back.
  useState: (initial: unknown) => [initial === null ? navigation.destination : initial, vi.fn()],
}));
vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
}));
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("next/link", () => ({ default: "a" }));
vi.mock("@/components/app-sidebar", () => ({ AppSidebar: () => null }));
vi.mock("@/components/activity-context", () => ({ useActivity: () => ({ unreadCount: 2 }) }));

import { AppShell } from "./app-shell";

function renderShell() {
  // AppShell requires children in its props type, including with createElement.
  // eslint-disable-next-line react/no-children-prop
  return renderToStaticMarkup(createElement(AppShell, { email: "test@example.com", children: "Page content" }));
}

describe("AppShell navigation feedback", () => {
  beforeEach(() => {
    navigation.pathname = "/dashboard";
    navigation.destination = "/monitors";
    navigation.pending = false;
  });

  it("does not reactivate a completed destination after Back", () => {
    const html = renderShell();
    expect(html).not.toContain('aria-busy="true"');
    expect(html).toContain('href="/dashboard" aria-current="page"');
    expect(html).not.toContain("pointer-events-none opacity-60");
  });

  it("shows pending feedback only while React is navigating", () => {
    navigation.pending = true;
    expect(renderShell()).toContain('href="/monitors" aria-busy="true"');
  });

  it("keeps Monitors selected on monitor detail pages", () => {
    navigation.pathname = "/monitors/site-1";
    expect(renderShell()).toContain('href="/monitors" aria-current="page"');
  });

  it("exposes unread activity in the mobile navigation", () => {
    expect(renderShell()).toContain("unreadIncidents");
  });
});
