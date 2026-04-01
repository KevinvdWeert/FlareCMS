/**
 * Tests for the in-memory rate limiter in lib/rate-limit.ts.
 */

describe("enforceRateLimit", () => {
  let enforceRateLimit: typeof import("../lib/rate-limit")["enforceRateLimit"];

  beforeEach(() => {
    jest.useFakeTimers();

    // Isolate the module so the `buckets` Map and the setInterval cleanup
    // timer are recreated fresh for each test.
    jest.isolateModules(() => {
      ({ enforceRateLimit } = require("../lib/rate-limit"));
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("allows calls under the limit", () => {
    const maxCalls = 5;
    const windowMs = 60_000;

    for (let i = 0; i < maxCalls; i++) {
      expect(() =>
        enforceRateLimit("uid-1", "createPage", maxCalls, windowMs)
      ).not.toThrow();
    }
  });

  it("throws resource-exhausted when the limit is exceeded", () => {
    const maxCalls = 3;
    const windowMs = 60_000;

    // Use up all allowed calls.
    for (let i = 0; i < maxCalls; i++) {
      enforceRateLimit("uid-1", "createPage", maxCalls, windowMs);
    }

    // The next call should be rejected.
    expect(() =>
      enforceRateLimit("uid-1", "createPage", maxCalls, windowMs)
    ).toThrow(
      expect.objectContaining({ code: "resource-exhausted" })
    );
  });

  it("resets after the time window expires", () => {
    const maxCalls = 2;
    const windowMs = 10_000;

    // Exhaust the limit.
    for (let i = 0; i < maxCalls; i++) {
      enforceRateLimit("uid-1", "createPage", maxCalls, windowMs);
    }

    // Still within the window — should throw.
    expect(() =>
      enforceRateLimit("uid-1", "createPage", maxCalls, windowMs)
    ).toThrow(
      expect.objectContaining({ code: "resource-exhausted" })
    );

    // Advance time past the window.
    jest.advanceTimersByTime(windowMs + 1);

    // Should be allowed again after the window resets.
    expect(() =>
      enforceRateLimit("uid-1", "createPage", maxCalls, windowMs)
    ).not.toThrow();
  });

  it("tracks different uid+action pairs independently", () => {
    const maxCalls = 1;
    const windowMs = 60_000;

    // First call for uid-1 / actionA — allowed.
    expect(() =>
      enforceRateLimit("uid-1", "actionA", maxCalls, windowMs)
    ).not.toThrow();

    // Second call for uid-1 / actionA — should be rejected.
    expect(() =>
      enforceRateLimit("uid-1", "actionA", maxCalls, windowMs)
    ).toThrow(
      expect.objectContaining({ code: "resource-exhausted" })
    );

    // First call for uid-1 / actionB — different action, still allowed.
    expect(() =>
      enforceRateLimit("uid-1", "actionB", maxCalls, windowMs)
    ).not.toThrow();

    // First call for uid-2 / actionA — different uid, still allowed.
    expect(() =>
      enforceRateLimit("uid-2", "actionA", maxCalls, windowMs)
    ).not.toThrow();
  });
});
