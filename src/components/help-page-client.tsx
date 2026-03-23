"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { HelpArticlePayload } from "@/lib/help-content";

export type HelpCategoryPayload = {
  id: string;
  title: string;
  articles: HelpArticlePayload[];
};

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

function articleMatches(article: HelpArticlePayload, q: string): boolean {
  if (!q) return true;
  const n = normalize(q);
  const hay = [
    article.title,
    article.summary,
    ...article.body,
    ...(article.bullets ?? []),
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(n);
}

type Props = {
  categories: HelpCategoryPayload[];
};

export function HelpPageClient({ categories }: Props) {
  const t = useTranslations("help");
  const [query, setQuery] = useState("");
  const [indexOpen, setIndexOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return categories;
    return categories
      .map((cat) => ({
        ...cat,
        articles: cat.articles.filter((a) => articleMatches(a, q)),
      }))
      .filter((cat) => cat.articles.length > 0);
  }, [categories, query]);

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash) return;
    const el = document.getElementById(hash);
    if (el) {
      requestAnimationFrame(() => {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, []);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1
          className="text-2xl font-semibold text-text-primary"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {t("pageTitle")}
        </h1>
        <p className="max-w-2xl text-sm text-text-muted">{t("pageSubtitle")}</p>
      </header>

      <div className="space-y-3">
        <label htmlFor="help-search" className="sr-only">
          {t("searchLabel")}
        </label>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            id="help-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            autoComplete="off"
            className="w-full max-w-md rounded-md border border-input-border bg-bg-page px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-input-focus focus:outline-none focus:ring-1 focus:ring-input-focus"
          />
          {query.trim() ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="shrink-0 text-sm font-medium text-accent hover:underline"
            >
              {t("clearSearch")}
            </button>
          ) : null}
        </div>
      </div>

      <div className="md:grid md:grid-cols-[minmax(12rem,14rem)_minmax(0,1fr)] md:items-start md:gap-10">
        <div className="mb-6 md:mb-0">
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-lg border border-border bg-bg-card px-3 py-2 text-left text-sm font-medium text-text-primary md:hidden"
            aria-expanded={indexOpen}
            onClick={() => setIndexOpen((o) => !o)}
          >
            <span>{t("indexHeading")}</span>
            <span className="text-text-muted">{indexOpen ? t("indexToggleHide") : t("indexToggleShow")}</span>
          </button>

          <nav
            className={`${indexOpen ? "mt-2" : "mt-0"} rounded-lg border border-border bg-bg-card p-3 md:sticky md:top-20 md:mt-0 md:block ${indexOpen ? "block" : "hidden md:block"}`}
            aria-label={t("indexHeading")}
          >
            <p className="mb-2 hidden text-xs font-semibold uppercase tracking-wide text-text-muted md:block">
              {t("indexHeading")}
            </p>
            <ul className="space-y-4 text-sm">
              {filtered.map((cat) => (
                <li key={cat.id}>
                  <p className="mb-1 font-medium text-text-primary">{cat.title}</p>
                  <ul className="space-y-0.5 border-l border-border pl-2">
                    {cat.articles.map((a) => (
                      <li key={a.id}>
                        <a
                          href={`#${a.id}`}
                          className="text-text-muted hover:text-text-primary"
                          onClick={() => setIndexOpen(false)}
                        >
                          {a.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div>
          {filtered.length === 0 ? (
            <p className="rounded-lg border border-border bg-bg-card px-4 py-6 text-sm text-text-muted">
              {t("searchEmpty")}
            </p>
          ) : (
            <div className="space-y-12" role="region" aria-label={t("mainAria")}>
              {filtered.map((cat) => (
                <div key={cat.id} className="space-y-8">
                  <h2
                    className="border-b border-border pb-2 text-lg font-semibold text-text-primary"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {cat.title}
                  </h2>
                  {cat.articles.map((article) => (
                    <section
                      key={article.id}
                      id={article.id}
                      className="scroll-mt-20 space-y-3"
                    >
                      <h3 className="text-base font-semibold text-text-primary">{article.title}</h3>
                      {article.summary ? (
                        <p className="text-sm font-medium text-text-muted">{article.summary}</p>
                      ) : null}
                      <div className="space-y-3 text-sm text-text-primary leading-relaxed">
                        {article.body.map((para, i) => (
                          <p key={i}>{para}</p>
                        ))}
                      </div>
                      {article.bullets && article.bullets.length > 0 ? (
                        <ul className="list-disc space-y-1 pl-5 text-sm text-text-primary">
                          {article.bullets.map((item, i) => (
                            <li key={i}>{item}</li>
                          ))}
                        </ul>
                      ) : null}
                    </section>
                  ))}
                </div>
              ))}
            </div>
          )}

          {filtered.length > 0 ? (
            <p className="mt-12 text-center">
              <button
                type="button"
                className="text-sm font-medium text-accent hover:underline"
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              >
                {t("backToTop")}
              </button>
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
