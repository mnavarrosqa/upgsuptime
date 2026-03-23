/** Single source of truth for help structure; copy lives in messages/{en,es}.json under `help.articles` and `help.categories`. */

export type HelpArticleMeta = {
  id: string;
  adminOnly?: boolean;
};

export type HelpCategoryMeta = {
  id: string;
  articles: HelpArticleMeta[];
};

export const HELP_CATEGORIES: HelpCategoryMeta[] = [
  {
    id: "gettingStarted",
    articles: [
      { id: "welcome" },
      { id: "signInAndAccount" },
    ],
  },
  {
    id: "dashboard",
    articles: [
      { id: "dashboardOverview" },
      { id: "dashboardSearchAndStatusLink" },
      { id: "dashboardTrends" },
    ],
  },
  {
    id: "monitors",
    articles: [
      { id: "addingMonitors" },
      { id: "monitorSettings" },
      { id: "monitorsListAndBulk" },
      { id: "importExportMonitors" },
    ],
  },
  {
    id: "monitorDetail",
    articles: [{ id: "monitorDetailPage" }],
  },
  {
    id: "activity",
    articles: [{ id: "activityFeed" }],
  },
  {
    id: "account",
    articles: [
      { id: "accountProfile" },
      { id: "onboardingGuide" },
    ],
  },
  {
    id: "dataPortability",
    articles: [{ id: "accountExportImport" }],
  },
  {
    id: "publicStatus",
    articles: [{ id: "publicStatusPage" }],
  },
  {
    id: "appExperience",
    articles: [
      { id: "themeAndLanguage" },
      { id: "pwaOffline" },
    ],
  },
  {
    id: "admin",
    articles: [
      { id: "adminOverview", adminOnly: true },
      { id: "adminUsers", adminOnly: true },
      { id: "adminMonitorsAndSettings", adminOnly: true },
    ],
  },
];

export function isArticleVisible(meta: HelpArticleMeta, isAdmin: boolean): boolean {
  if (meta.adminOnly && !isAdmin) return false;
  return true;
}

export function filterCategoriesForUser(
  isAdmin: boolean
): HelpCategoryMeta[] {
  return HELP_CATEGORIES.map((cat) => ({
    ...cat,
    articles: cat.articles.filter((a) => isArticleVisible(a, isAdmin)),
  })).filter((cat) => cat.articles.length > 0);
}

export type HelpArticlePayload = {
  id: string;
  title: string;
  summary: string;
  body: string[];
  bullets?: string[];
};
