// Mock firebase-functions for tests
const HttpsError = class extends Error {
  code: string;
  details: unknown;
  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.code = code;
    this.details = details;
    this.name = 'HttpsError';
  }
};

const mockFunctions = {
  https: {
    HttpsError,
    onCall: jest.fn((handler) => handler),
  },
  auth: {
    user: jest.fn(() => ({
      onCreate: jest.fn((handler) => handler),
      onDelete: jest.fn((handler) => handler),
    })),
  },
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
};

// `logger` is a named export used by lib/logger.ts; expose it both ways so
// that both `import { logger }` and `import * as functions from '...'` work.
export = Object.assign(mockFunctions, { logger: mockFunctions.logger });
