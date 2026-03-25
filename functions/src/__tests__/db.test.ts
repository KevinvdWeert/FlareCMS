/**
 * Tests for the shared Firestore helpers in lib/db.ts.
 */
import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { writeActivityLog, requireStaff } from "../lib/db";

// Access the mock firestore instance set up by the firebase-admin mock.
const mockDb = admin.firestore() as any;

describe("writeActivityLog", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("adds a document to the activityLog collection with a serverTimestamp", async () => {
    const entry = {
      actorId: "uid-123",
      actorEmail: "user@example.com",
      action: "page_created",
      resourceType: "page",
      resourceId: "page-456",
      meta: { title: "Hello" },
    };

    await writeActivityLog(entry);

    expect(mockDb.collection).toHaveBeenCalledWith("activityLog");
    expect(mockDb.add).toHaveBeenCalledWith({
      ...entry,
      createdAt: "SERVER_TIMESTAMP",
    });
  });

  it("adds a document when optional fields are omitted", async () => {
    const entry = {
      actorId: "uid-123",
      action: "page_deleted",
      resourceType: "page",
    };

    await writeActivityLog(entry);

    expect(mockDb.add).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: "uid-123", action: "page_deleted" })
    );
  });
});

describe("requireStaff", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const makeContext = (uid: string | null): functions.https.CallableContext =>
    ({
      auth: uid ? { uid, token: {} as any } : undefined,
    } as functions.https.CallableContext);

  it("throws unauthenticated when there is no auth context", async () => {
    const ctx = makeContext(null);
    await expect(requireStaff(ctx)).rejects.toMatchObject({ code: "unauthenticated" });
  });

  it("throws permission-denied when the user document does not exist", async () => {
    mockDb.get.mockResolvedValueOnce({ exists: false, data: () => undefined });
    const ctx = makeContext("uid-unknown");
    await expect(requireStaff(ctx)).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("throws permission-denied when the user has role 'user'", async () => {
    mockDb.get.mockResolvedValueOnce({ exists: true, data: () => ({ role: "user" }) });
    const ctx = makeContext("uid-regular");
    await expect(requireStaff(ctx)).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("returns the user data for an editor", async () => {
    const userData = { role: "editor", email: "ed@example.com" };
    mockDb.get.mockResolvedValueOnce({ exists: true, data: () => userData });
    const ctx = makeContext("uid-editor");
    const result = await requireStaff(ctx);
    expect(result).toEqual(userData);
  });

  it("returns the user data for an admin", async () => {
    const userData = { role: "admin", email: "admin@example.com" };
    mockDb.get.mockResolvedValueOnce({ exists: true, data: () => userData });
    const ctx = makeContext("uid-admin");
    const result = await requireStaff(ctx);
    expect(result).toEqual(userData);
  });
});
