// Mock uuid to avoid ESM compatibility issues with Jest's CommonJS transform
export const v4 = jest.fn(() => "test-uuid-1234");
