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

export const logger = mockFunctions.logger;
export = mockFunctions;
