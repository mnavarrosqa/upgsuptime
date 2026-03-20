import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { checkResult, monitor, user } from "@/db/schema";
import { and, eq, ne } from "drizzle-orm";
import { randomUUID } from "crypto";
import { checkBodySizeLimit } from "@/lib/validate-monitor";
import {
  ACCOUNT_DATA_VERSION,
  MAX_ACCOUNT_IMPORT_BODY_BYTES,
  parseCheckResultFromImport,
  parseMonitorFromImport,
  type AccountImportMonitorError,
  type ParsedMonitorRow,
} from "@/lib/account-data";
import { runCheck } from "@/lib/run-check";
import type { Monitor } from "@/db/schema";

const MAX_MONITORS_PER_IMPORT = 500;
const MAX_CHECK_RESULTS_PER_IMPORT = 200_000;

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bodySizeError = checkBodySizeLimit(
    request,
    MAX_ACCOUNT_IMPORT_BODY_BYTES
  );
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
  const version = obj.upgsAccountExportVersion;
  if (version !== ACCOUNT_DATA_VERSION) {
    return NextResponse.json(
      {
        error: `Unsupported export version (expected ${ACCOUNT_DATA_VERSION})`,
      },
      { status: 400 }
    );
  }

  const replaceExistingMonitors = obj.replaceExistingMonitors !== false;
  const applyProfile = obj.applyProfile === true;

  if (!Array.isArray(obj.monitors)) {
    return NextResponse.json(
      { error: "monitors must be an array" },
      { status: 400 }
    );
  }

  if (obj.monitors.length === 0) {
    return NextResponse.json(
      { error: "At least one monitor is required" },
      { status: 400 }
    );
  }

  if (obj.monitors.length > MAX_MONITORS_PER_IMPORT) {
    return NextResponse.json(
      {
        error: `At most ${MAX_MONITORS_PER_IMPORT} monitors per import`,
      },
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

  const userId = session.user.id;
  const ownerEmail = session.user?.email ?? "";

  if (applyProfile && obj.user !== null && typeof obj.user === "object") {
    const u = obj.user as Record<string, unknown>;
    const patch: {
      username?: string | null;
      onboardingCompleted?: boolean | null;
      onboardingStep?: string | null;
    } = {};

    if ("username" in u) {
      const usernameRaw =
        typeof u.username === "string" ? u.username.trim() : null;
      const username = usernameRaw === "" ? null : usernameRaw;
      if (username !== null) {
        if (username.length < 2 || !/^[a-zA-Z0-9_]+$/.test(username)) {
          return NextResponse.json(
            {
              error:
                "Username must be at least 2 characters and only contain letters, numbers, and underscores",
            },
            { status: 400 }
          );
        }
        const [taken] = await db
          .select({ id: user.id })
          .from(user)
          .where(and(eq(user.username, username), ne(user.id, userId)));
        if (taken) {
          return NextResponse.json(
            { error: "Username from export is already taken" },
            { status: 400 }
          );
        }
      }
      patch.username = username;
    }

    if ("onboardingCompleted" in u) {
      patch.onboardingCompleted =
        typeof u.onboardingCompleted === "boolean"
          ? u.onboardingCompleted
          : null;
    }
    if ("onboardingStep" in u) {
      patch.onboardingStep =
        typeof u.onboardingStep === "string" ? u.onboardingStep : null;
    }

    if (Object.keys(patch).length > 0) {
      await db.update(user).set(patch).where(eq(user.id, userId));
    }
  }

  if (replaceExistingMonitors) {
    const checkResultsInput = Array.isArray(obj.checkResults)
      ? obj.checkResults
      : [];

    if (checkResultsInput.length > MAX_CHECK_RESULTS_PER_IMPORT) {
      return NextResponse.json(
        {
          error: `At most ${MAX_CHECK_RESULTS_PER_IMPORT} check results per import`,
        },
        { status: 400 }
      );
    }

    const monitorIdSet = new Set(parsedMonitors.map((m) => m.id));
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

    for (let i = 0; i < checkResultsInput.length; i++) {
      const item = checkResultsInput[i];
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
            lastCheckAt: m.lastCheckAt,
            currentStatus: m.currentStatus,
            lastStatusChangedAt: m.lastStatusChangedAt,
            alertEmail: m.alertEmail,
            alertEmailTo: m.alertEmailTo,
            sslMonitoring: m.sslMonitoring,
            sslValid: m.sslValid,
            sslExpiresAt: m.sslExpiresAt,
            sslLastCheckedAt: m.sslLastCheckedAt,
            showOnStatusPage: m.showOnStatusPage,
            paused: m.paused,
            createdAt: m.createdAt,
          })
          .run();
      }

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

    const created = await db
      .select()
      .from(monitor)
      .where(eq(monitor.userId, userId));

    for (const m of created) {
      runCheck(m as Monitor, ownerEmail).catch((err) => {
        console.error("[account-import] check failed for", m.id, err);
      });
    }

    return NextResponse.json({
      mode: "restore",
      monitorsImported: parsedMonitors.length,
      checkResultsImported: parsedChecks.length,
      monitorErrors,
      checkErrors,
      profileUpdated: applyProfile,
    });
  }

  const now = new Date();
  const newIds: string[] = [];

  db.transaction((tx) => {
    for (const m of parsedMonitors) {
      const id = randomUUID();
      newIds.push(id);
      tx.insert(monitor)
        .values({
          id,
          userId,
          name: m.name,
          url: m.url,
          intervalMinutes: m.intervalMinutes,
          timeoutSeconds: m.timeoutSeconds,
          method: m.method,
          expectedStatusCodes: m.expectedStatusCodes,
          lastCheckAt: null,
          currentStatus: null,
          lastStatusChangedAt: null,
          alertEmail: m.alertEmail,
          alertEmailTo: m.alertEmailTo,
          sslMonitoring: m.sslMonitoring,
          sslValid: null,
          sslExpiresAt: null,
          sslLastCheckedAt: null,
          showOnStatusPage: m.showOnStatusPage,
          paused: m.paused,
          createdAt: now,
        })
        .run();
    }
  });

  const appended = await db
    .select()
    .from(monitor)
    .where(eq(monitor.userId, userId));

  const idSet = new Set(newIds);
  for (const m of appended) {
    if (idSet.has(m.id)) {
      runCheck(m as Monitor, ownerEmail).catch((err) => {
        console.error("[account-import] check failed for", m.id, err);
      });
    }
  }

  return NextResponse.json({
    mode: "append",
    monitorsImported: parsedMonitors.length,
    checkResultsImported: 0,
    monitorErrors,
    checkErrors: [],
    note:
      "Append mode ignores check history from the file. Use restore mode to import results.",
    profileUpdated: applyProfile,
  });
}
