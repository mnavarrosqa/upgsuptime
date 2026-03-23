import { getServerSession } from "next-auth";
import { getMessages, getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { authOptions } from "@/lib/auth";
import { filterCategoriesForUser } from "@/lib/help-content";
import { HelpPageClient, type HelpCategoryPayload } from "@/components/help-page-client";

type HelpArticleRaw = {
  title: string;
  summary: string;
  body: string[];
  bullets?: string[];
};

type HelpMessages = {
  help?: {
    categories: Record<string, string>;
    articles: Record<string, HelpArticleRaw>;
  };
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("help");
  return {
    title: t("pageTitle"),
    description: t("pageSubtitle"),
  };
}

export default async function HelpPage() {
  const session = await getServerSession(authOptions);
  const isAdmin = session?.user?.role === "admin";
  const messages = (await getMessages()) as HelpMessages;
  const help = messages.help;
  if (!help?.categories || !help?.articles) {
    throw new Error("Missing help messages");
  }

  const filtered = filterCategoriesForUser(isAdmin);
  const categories: HelpCategoryPayload[] = filtered.map((cat) => ({
    id: cat.id,
    title: help.categories[cat.id] ?? cat.id,
    articles: cat.articles.map((meta) => {
      const raw = help.articles[meta.id];
      if (!raw) {
        throw new Error(`Missing help article: ${meta.id}`);
      }
      return {
        id: meta.id,
        title: raw.title,
        summary: raw.summary,
        body: Array.isArray(raw.body) ? raw.body : [],
        bullets: raw.bullets,
      };
    }),
  }));

  return <HelpPageClient categories={categories} />;
}
