import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { checkResult, monitor, user } from "@/db/schema";
import { and, eq, ne } from "drizzle-orm";
import { checkBodySizeLimit } from "@/lib/validate-monitor";
import {
  ACCOUNT_DATA_VERSION,
  parseCheckResultFromImport,
  parseImportedDate,
  parseMonitorFromImport,
  type AccountImportMonitorError,
  type ParsedMonitorRow,
} from "@/lib/account-data";
import { runCheck } from "@/lib/run-check";
import type { Monitor } from "@/db/schema";

const MAX_CHUNKED_BODY_BYTES = 900 * 1024;
const MAX_MONITORS_PER_IMPORT = 500;
const MAX_CHECK_RESULTS_PER_REQUEST = 5_000;

type ChunkedStage = "init" | "checks" | "finalize";

function parseChunkedStage(value: unknown): ChunkedStage | null {
  if (value === "init" || value === "checks" || value === "finalize") return value;
  return null;
}

async function applyProfilePatch(
  userId: string,
  profileRaw: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (profileRaw === null || typeof profileRaw !== "object") return { ok: true };
  const u = profileRaw as Record<string, unknown>;
  const patch: {
    username?: string | null;
    language?: "en" | "es";
    onboardingCompleted?: boolean | null;
    onboardingStep?: string | null;
    activityClearedAt?: Date | null;
    activityDismissedIds?: string | null;
    statusPageTitle?: string | null;
    statusPageTagline?: string | null;
    statusPageShowPoweredBy?: boolean;
  } = {};

  if ("username" in u) {
    const usernameRaw = typeof u.username === "string" ? u.username.trim() : null;
    const username = usernameRaw === "" ? null : usernameRaw;
    if (username !== null) {
      if (username.length < 2 || !/^[a-zA-Z0-9_]+$/.test(username)) {
        return {
          ok: false,
          error:
            "Username must be at least 2 characters and only contain letters, numbers, and underscores",
        };
      }
      const [taken] = await db
        .select({ id: user.id })
        .from(user)
        .where(and(eq(user.username, username), ne(user.id, userId)));
      if (taken) return { ok: false, error: "Username from export is already taken" };
    }
    patch.username = username;
  }

  if ("onboardingCompleted" in u) {
    patch.onboardingCompleted =
      typeof u.onboardingCompleted === "boolean" ? u.onboardingCompleted : null;
  }
  if ("language" in u) {
    patch.language = u.language === "es" ? "es" : "en";
  }
  if ("onboardingStep" in u) {
    patch.onboardingStep = typeof u.onboardingStep === "string" ? u.onboardingStep : null;
  }
  if ("activityDismissedIds" in u) {
    patch.activityDismissedIds =
      typeof u.activityDismissedIds === "string" ? u.activityDismissedIds : null;
  }
  if ("activityClearedAt" in u) {
    if (u.activityClearedAt === null) {
      patch.activityClearedAt = null;
    } else {
      const cleared = parseImportedDate(u.activityClearedAt);
      if (cleared) {
        patch.activityClearedAt = cleared;
      } else if (
        typeof u.activityClearedAt === "string" &&
        u.activityClearedAt.trim() === ""
      ) {
        patch.activityClearedAt = null;
      } else {
        return { ok: false, error: "activityClearedAt must be a valid date or null" };
      }
    }
  }
  if ("statusPageTitle" in u) {
    if (u.statusPageTitle === null) patch.statusPageTitle = null;
    else if (typeof u.statusPageTitle === "string") {
      const t = u.statusPageTitle.trim();
      if (t.length > 120) return { ok: false, error: "statusPageTitle must be at most 120 characters" };
      patch.statusPageTitle = t || null;
    }
  }
  if ("statusPageTagline" in u) {
    if (u.statusPageTagline === null) patch.statusPageTagline = null;
    else if (typeof u.statusPageTagline === "string") {
      const t = u.statusPageTagline.trim();
      if (t.length > 400) return { ok: false, error: "statusPageTagline must be at most 400 characters" };
      patch.statusPageTagline = t || null;
    }
  }
  if ("statusPageShowPoweredBy" in u && typeof u.statusPageShowPoweredBy === "boolean") {
    patch.statusPageShowPoweredBy = u.statusPageShowPoweredBy;
  }

  if (Object.keys(patch).length > 0) {
    await db.update(user).set(patch).where(eq(user.id, userId));
  }
  return { ok: true };
}

async function triggerChecksForUserMonitors(userId: string, ownerEmail: string) {
  const created = await db.select().from(monitor).where(eq(monitor.userId, userId));
  for (const m of created) {
    runCheck(m as Monitor, ownerEmail).catch((err) => {
      console.error("[account-import/chunked] check failed for", m.id, err);
    });
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bodySizeError = checkBodySizeLimit(request, MAX_CHUNKED_BODY_BYTES);
  if (bodySizeError) {
    return NextResponse.json({ error: bodySizeError }, { status: 413 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (body === null || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const obj = body as Record<string, unknown>;
  const version = obj.upgAccountExportVersion ?? obj.upgsAccountExportVersion;
  if (version !== ACCOUNT_DATA_VERSION) {
    return NextResponse.json(
      { error: `Unsupported export version (expected ${ACCOUNT_DATA_VERSION})` },
      { status: 400 }
    );
  }

  const stage = parseChunkedStage(obj.stage);
  if (stage === null) {
    return NextResponse.json({ error: "stage must be init, checks, or finalize" }, { status: 400 });
  }

  const userId = session.user.id;
  const ownerEmail = session.user?.email ?? "";

  if (stage === "init") {
    if (!Array.isArray(obj.monitors)) {
      return NextResponse.json({ error: "monitors must be an array" }, { status: 400 });
    }
    if (obj.monitors.length === 0) {
      return NextResponse.json({ error: "At least one monitor is required" }, { status: 400 });
    }
    if (obj.monitors.length > MAX_MONITORS_PER_IMPORT) {
      return NextResponse.json(
        { error: `At most ${MAX_MONITORS_PER_IMPORT} monitors per import` },
        { status: 400 }
      );
    }

    const monitorErrors: AccountImportMonitorError[] = [];
    const parsedMonitors: ParsedMonitorRow[] = [];
    for (let i = 0; i < obj.monitors.length; i++) {
      const item = obj.monitors[i];
      if (item === null || typeof item !== "object") {
        monitorErrors.push({
          index: i + 1,
          id: "",
          name: "",
          url: "",
          error: "Invalid monitor entry",
        });
        continue;
      }
      const r = parseMonitorFromImport(item as Record<string, unknown>, i);
      if (!r.ok) monitorErrors.push(r.error);
      else parsedMonitors.push(r.row);
    }
    if (parsedMonitors.length === 0) {
      return NextResponse.json(
        { error: "No valid monitors to import", monitorErrors },
        { status: 400 }
      );
    }

    const applyProfile = obj.applyProfile === true;
    if (applyProfile) {
      const profileResult = await applyProfilePatch(userId, obj.user);
      if (!profileResult.ok) {
        return NextResponse.json({ error: profileResult.error }, { status: 400 });
      }
    }

    db.transaction((tx) => {
      tx.delete(monitor).where(eq(monitor.userId, userId)).run();
      for (const m of parsedMonitors) {
        tx.insert(monitor)
          .values({
            id: m.id,
            userId,
            name: m.name,
            url: m.url,
            intervalMinutes: m.intervalMinutes,
            timeoutSeconds: m.timeoutSeconds,
            method: m.method,
            expectedStatusCodes: m.expectedStatusCodes,
            requestHeaders: m.requestHeaders,
            requestBody: m.requestBody,
            requestBodyType: m.requestBodyType,
            followRedirects: m.followRedirects,
            maxRedirects: m.maxRedirects,
            lastCheckAt: m.lastCheckAt,
            currentStatus: m.currentStatus,
            lastStatusChangedAt: m.lastStatusChangedAt,
            downtimeAckEpisodeAt: m.downtimeAckEpisodeAt,
            alertEmail: m.alertEmail,
            alertEmailTo: m.alertEmailTo,
            sslMonitoring: m.sslMonitoring,
            sslValid: m.sslValid,
            sslExpiresAt: m.sslExpiresAt,
            sslLastCheckedAt: m.sslLastCheckedAt,
            showOnStatusPage: m.showOnStatusPage,
            paused: m.paused,
            consecutiveFailures: m.consecutiveFailures,
            type: m.type,
            keywordContains: m.keywordContains,
            keywordShouldExist: m.keywordShouldExist,
            dnsRecordType: m.dnsRecordType,
            dnsExpectedValue: m.dnsExpectedValue,
            tcpHost: m.tcpHost,
            tcpPort: m.tcpPort,
            maintenanceStartsAt: m.maintenanceStartsAt,
            maintenanceEndsAt: m.maintenanceEndsAt,
            maintenanceNote: m.maintenanceNote,
            degradationAlertEnabled: m.degradationAlertEnabled,
            baselineP75Ms: m.baselineP75Ms,
            baselineSampleCount: m.baselineSampleCount,
            consecutiveDegradedChecks: m.consecutiveDegradedChecks,
            degradingAlertSentAt: m.degradingAlertSentAt,
            baselineResetAt: m.baselineResetAt,
            createdAt: m.createdAt,
          })
          .run();
      }
    });

    return NextResponse.json({
      stage: "init",
      monitorsImported: parsedMonitors.length,
      monitorErrors,
      profileUpdated: applyProfile,
    });
  }

  if (stage === "checks") {
    if (!Array.isArray(obj.checkResults)) {
      return NextResponse.json({ error: "checkResults must be an array" }, { status: 400 });
    }
    if (obj.checkResults.length > MAX_CHECK_RESULTS_PER_REQUEST) {
      return NextResponse.json(
        { error: `At most ${MAX_CHECK_RESULTS_PER_REQUEST} check results per request` },
        { status: 400 }
      );
    }

    const userMonitorRows = await db
      .select({ id: monitor.id })
      .from(monitor)
      .where(eq(monitor.userId, userId));
    const monitorIdSet = new Set(userMonitorRows.map((m) => m.id));
    const checkErrors: { index: number; error: string }[] = [];
    const parsedChecks: {
      id: string;
      monitorId: string;
      statusCode: number | null;
      responseTimeMs: number | null;
      ok: boolean;
      message: string | null;
      createdAt: Date;
    }[] = [];

    for (let i = 0; i < obj.checkResults.length; i++) {
      const item = obj.checkResults[i];
      if (item === null || typeof item !== "object") {
        checkErrors.push({ index: i + 1, error: "Invalid check result entry" });
        continue;
      }
      const r = parseCheckResultFromImport(
        item as Record<string, unknown>,
        i,
        monitorIdSet
      );
      if (!r.ok) checkErrors.push(r.error);
      else parsedChecks.push(r.row);
    }

    if (parsedChecks.length > 0) {
      db.transaction((tx) => {
        for (const r of parsedChecks) {
          tx.insert(checkResult)
            .values({
              id: r.id,
              monitorId: r.monitorId,
              statusCode: r.statusCode,
              responseTimeMs: r.responseTimeMs,
              ok: r.ok,
              message: r.message,
              createdAt: r.createdAt,
            })
            .run();
        }
      });
    }

    return NextResponse.json({
      stage: "checks",
      checkResultsImported: parsedChecks.length,
      checkErrors,
    });
  }

  await triggerChecksForUserMonitors(userId, ownerEmail);
  return NextResponse.json({ stage: "finalize", ok: true });
}
