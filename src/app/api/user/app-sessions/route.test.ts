import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "@/test/sqlite-test-db";

const mocks = vi.hoisted(() => ({ db: null as unknown, getServerSession: vi.fn() }));
vi.mock("@/db", () => ({
  get db() {
    return mocks.db;
  },
}));
vi.mock("next-auth", () => ({ getServerSession: mocks.getServerSession }));
vi.stubEnv("NEXTAUTH_SECRET", "test-secret-for-app-sessions");

import { mobileSession, pushDevice, user } from "@/db/schema";
import { createMobileSession, revokeMobileSession } from "@/lib/mobile-auth";
import { DELETE as deleteAll, GET } from "./route";
import { DELETE as deleteOne } from "./[id]/route";

let db: TestDb;
const params = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(async () => {
  db = createTestDb();
  mocks.db = db;
  mocks.getServerSession.mockReset().mockResolvedValue({ user: { id: "user-1", email: "owner@example.com" } });
  const now = new Date();
  await db.insert(user).values([
    { id: "user-1", email: "owner@example.com", language: "en", passwordHash: "x", role: "user", createdAt: now },
    { id: "user-2", email: "other@example.com", language: "en", passwordHash: "x", role: "user", createdAt: now },
  ]);
});

describe("app sessions", () => {
  it("lists active sessions with push status, hiding revoked and others' sessions", async () => {
    const phone = await createMobileSession("user-1", "Pixel 9");
    const tablet = await createMobileSession("user-1", null);
    const old = await createMobileSession("user-1", "Old phone");
    await revokeMobileSession(old.sessionId);
    await createMobileSession("user-2", "Not mine");
    const now = new Date();
    await db.insert(pushDevice).values({ id: "d1", userId: "user-1", sessionId: phone.sessionId, token: "fcm-1", createdAt: now, lastSeenAt: now });

    const body = await (await GET()).json();

    expect(body).toHaveLength(2);
    expect(body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: phone.sessionId, deviceName: "Pixel 9", pushEnabled: true }),
        expect.objectContaining({ id: tablet.sessionId, deviceName: null, pushEnabled: false }),
      ]),
    );
  });

  it("signs out one owned device and refuses others' sessions", async () => {
    const mine = await createMobileSession("user-1", null);
    const theirs = await createMobileSession("user-2", null);

    expect((await deleteOne(new Request("http://localhost"), params(theirs.sessionId))).status).toBe(404);
    expect((await deleteOne(new Request("http://localhost"), params(mine.sessionId))).status).toBe(200);

    const rows = await db.select().from(mobileSession);
    expect(rows.find((r) => r.id === mine.sessionId)?.revokedAt).toBeInstanceOf(Date);
    expect(rows.find((r) => r.id === theirs.sessionId)?.revokedAt).toBeNull();
  });

  it("signs out every device of the user only", async () => {
    await createMobileSession("user-1", null);
    await createMobileSession("user-1", null);
    await createMobileSession("user-2", null);

    await deleteAll();

    const active = (await db.select().from(mobileSession)).filter((r) => r.revokedAt === null);
    expect(active.map((r) => r.userId)).toEqual(["user-2"]);
  });

  it("requires a web session", async () => {
    mocks.getServerSession.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect((await deleteAll()).status).toBe(401);
  });
});
