/**
 * Tests for user management Cloud Functions (users.ts).
 * Focused on the race-condition-safe logic and pagination fixes.
 */
import * as admin from "firebase-admin";
import * as functions from "firebase-functions";

// Import the callable handlers (mocked via moduleNameMapper).
import { listUsers, setUserRole, acceptInvite } from "../users";

const mockDb = admin.firestore() as any;
const mockAuth = admin.auth() as any;

// Helper to build a minimal CallableContext.
const makeCtx = (uid: string, email?: string): functions.https.CallableContext =>
  ({
    auth: {
      uid,
      token: { email: email ?? `${uid}@example.com` } as any,
    },
  } as functions.https.CallableContext);

// onCall mock returns the handler directly, so call signatures match (data, context).
// Cast `data` to `any` to bypass the strict Request<ParamsDictionary> type.
const call = async (fn: Function, data: unknown, ctx: functions.https.CallableContext) =>
  fn(data as any, ctx);

// ---------------------------------------------------------------------------
// listUsers pagination
// ---------------------------------------------------------------------------

describe("listUsers", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns hasMore=false when fewer than pageSize docs are returned", async () => {
    // caller is admin
    mockDb.get.mockResolvedValueOnce({ exists: true, data: () => ({ role: "admin" }) });
    // query returns 2 docs (pageSize=5, safeLimit+1=6 fetched, only 2 returned)
    const fakeDocs = [
      { id: "u1", data: () => ({ email: "a@a.com" }) },
      { id: "u2", data: () => ({ email: "b@b.com" }) },
    ];
    mockDb.get.mockResolvedValueOnce({ docs: fakeDocs });

    const result = await call(listUsers, { pageSize: 5 }, makeCtx("admin-uid")) as any;

    expect(result.hasMore).toBe(false);
    expect(result.users).toHaveLength(2);
  });

  it("returns hasMore=true when docs.length > pageSize (extra sentinel doc)", async () => {
    // caller is admin
    mockDb.get.mockResolvedValueOnce({ exists: true, data: () => ({ role: "admin" }) });
    // safeLimit=2, fetch limit=3, return 3 docs → hasMore=true, users trimmed to 2
    const fakeDocs = [
      { id: "u1", data: () => ({}) },
      { id: "u2", data: () => ({}) },
      { id: "u3", data: () => ({}) }, // sentinel
    ];
    mockDb.get.mockResolvedValueOnce({ docs: fakeDocs });

    const result = await call(listUsers, { pageSize: 2 }, makeCtx("admin-uid")) as any;

    expect(result.hasMore).toBe(true);
    expect(result.users).toHaveLength(2);
  });

  it("throws unauthenticated when no auth context is provided", async () => {
    const ctx = { auth: undefined } as unknown as functions.https.CallableContext;
    await expect(call(listUsers, {}, ctx)).rejects.toMatchObject({ code: "unauthenticated" });
  });

  it("throws permission-denied for a non-admin caller", async () => {
    mockDb.get.mockResolvedValueOnce({ exists: true, data: () => ({ role: "editor" }) });
    await expect(call(listUsers, {}, makeCtx("editor-uid"))).rejects.toMatchObject({
      code: "permission-denied",
    });
  });
});

// ---------------------------------------------------------------------------
// setUserRole – last-admin guard via transaction
// ---------------------------------------------------------------------------

describe("setUserRole", () => {
  beforeEach(() => jest.clearAllMocks());

  it("throws permission-denied when caller is not admin", async () => {
    mockDb.get.mockResolvedValueOnce({ exists: true, data: () => ({ role: "editor" }) });
    await expect(
      call(setUserRole, { targetUid: "uid-2", role: "editor" }, makeCtx("editor-uid"))
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("throws invalid-argument for an unknown role", async () => {
    mockDb.get.mockResolvedValueOnce({ exists: true, data: () => ({ role: "admin" }) });
    await expect(
      call(setUserRole, { targetUid: "uid-2", role: "superadmin" }, makeCtx("admin-uid"))
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  it("runs a transaction to update the role when demoting from admin", async () => {
    // Caller is admin
    mockDb.get.mockResolvedValueOnce({ exists: true, data: () => ({ role: "admin" }) });

    // runTransaction mock: simulate successful transaction
    mockDb.runTransaction = jest.fn().mockImplementation(async (fn: (txn: any) => Promise<void>) => {
      const txn = {
        get: jest.fn().mockResolvedValue({ exists: true, data: () => ({ role: "admin" }) }),
        update: jest.fn(),
      };
      // admins query inside transaction
      mockDb.get.mockResolvedValueOnce({ size: 2 }); // 2 admins remain
      await fn(txn);
    });

    await call(setUserRole, { targetUid: "uid-2", role: "editor" }, makeCtx("admin-uid"));

    expect(mockDb.runTransaction).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// acceptInvite – transaction-safe token claim
// ---------------------------------------------------------------------------

describe("acceptInvite", () => {
  beforeEach(() => jest.clearAllMocks());

  it("throws not-found when invite does not exist", async () => {
    // invite query returns empty
    mockDb.get.mockResolvedValueOnce({ empty: true, docs: [] });

    await expect(
      call(acceptInvite, { token: "bad-token" }, makeCtx("uid-1", "user@example.com"))
    ).rejects.toMatchObject({ code: "not-found" });
  });

  it("throws failed-precondition when invite is expired", async () => {
    const pastDate = new Date(Date.now() - 1000);
    const inviteDoc = {
      ref: { id: "inv-1", update: jest.fn().mockResolvedValue(undefined) },
      id: "inv-1",
      data: () => ({
        token: "tok",
        status: "pending",
        email: "user@example.com",
        role: "editor",
        expiresAt: { toDate: () => pastDate },
      }),
    };
    mockDb.get.mockResolvedValueOnce({ empty: false, docs: [inviteDoc] });

    await expect(
      call(acceptInvite, { token: "tok" }, makeCtx("uid-1", "user@example.com"))
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });

  it("throws permission-denied when invite email doesn't match caller", async () => {
    const futureDate = new Date(Date.now() + 100000);
    const inviteDoc = {
      ref: { id: "inv-1", update: jest.fn() },
      id: "inv-1",
      data: () => ({
        token: "tok",
        status: "pending",
        email: "other@example.com",
        role: "editor",
        expiresAt: { toDate: () => futureDate },
      }),
    };
    mockDb.get.mockResolvedValueOnce({ empty: false, docs: [inviteDoc] });

    await expect(
      call(acceptInvite, { token: "tok" }, makeCtx("uid-1", "wrong@example.com"))
    ).rejects.toMatchObject({ code: "permission-denied" });
  });
});
