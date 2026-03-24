// Mock firebase-admin for tests
const mockFirestore = {
  collection: jest.fn().mockReturnThis(),
  doc: jest.fn().mockReturnThis(),
  add: jest.fn().mockResolvedValue({ id: 'mock-id' }),
  set: jest.fn().mockResolvedValue(undefined),
  get: jest.fn().mockResolvedValue({ exists: false, data: () => undefined }),
  update: jest.fn().mockResolvedValue(undefined),
  delete: jest.fn().mockResolvedValue(undefined),
  where: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  startAfter: jest.fn().mockReturnThis(),
  count: jest.fn().mockReturnValue({ get: jest.fn().mockResolvedValue({ data: () => ({ count: 0 }) }) }),
};

const mockAuth = {
  setCustomUserClaims: jest.fn().mockResolvedValue(undefined),
  createUser: jest.fn().mockResolvedValue({ uid: 'mock-uid' }),
};

const mockAdmin = {
  apps: [],
  initializeApp: jest.fn(),
  firestore: jest.fn(() => mockFirestore),
  auth: jest.fn(() => mockAuth),
  storage: jest.fn(() => ({ bucket: jest.fn(() => ({ file: jest.fn(() => ({ delete: jest.fn().mockResolvedValue(undefined) })) })) })),
};

(mockAdmin.firestore as any).FieldValue = {
  serverTimestamp: jest.fn(() => 'SERVER_TIMESTAMP'),
  increment: jest.fn((n: number) => ({ _increment: n })),
  arrayUnion: jest.fn((...args: unknown[]) => ({ _union: args })),
  arrayRemove: jest.fn((...args: unknown[]) => ({ _remove: args })),
};

(mockAdmin.firestore as any).Timestamp = {
  fromDate: jest.fn((d: Date) => ({ toDate: () => d })),
};

export = mockAdmin;
