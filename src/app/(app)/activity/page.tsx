import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { loadActivityFeed } from "@/lib/activity-feed";
import { ActivityPageClient } from "@/components/activity-page-client";

const PAGE_SIZE = 20;

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const [sp, session] = await Promise.all([searchParams, getServerSession(authOptions)]);
  if (!session?.user?.id) redirect("/login");

  const itemsAll = await loadActivityFeed(session.user.id);
  const totalCount = itemsAll.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const pageRaw = parseInt(sp.page ?? "1", 10);
  const page =
    Number.isFinite(pageRaw) && pageRaw >= 1
      ? Math.min(pageRaw, totalPages)
      : 1;

  const start = (page - 1) * PAGE_SIZE;
  const items = itemsAll.slice(start, start + PAGE_SIZE);

  return (
    <ActivityPageClient
      items={items}
      page={page}
      totalPages={totalPages}
      totalCount={totalCount}
      pageSize={PAGE_SIZE}
    />
  );
}
