/**
 * Centralized error codes for FlareCMS Cloud Functions.
 * Error codes follow the pattern: FLARE_<DOMAIN>_<DESCRIPTION>
 */

export const ErrorCodes = {
  // Auth errors
  UNAUTHENTICATED: "unauthenticated",
  FORBIDDEN: "permission-denied",

  // Validation errors
  INVALID_ARGUMENT: "invalid-argument",

  // Not-found
  NOT_FOUND: "not-found",

  // Business logic
  ALREADY_EXISTS: "already-exists",
  FAILED_PRECONDITION: "failed-precondition",

  // Internal
  INTERNAL: "internal",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

export const ErrorMessages = {
  UNAUTHENTICATED: "You must be signed in to perform this action.",
  FORBIDDEN: "You do not have permission to perform this action.",
  NOT_FOUND: "The requested resource was not found.",
  INTERNAL: "An unexpected error occurred. Please try again.",
  LAST_ADMIN: "Cannot remove the last admin. Promote another user first.",
  SLUG_TAKEN: "This slug is already in use by another page.",
  INVITE_USED: "This invite has already been used or has expired.",
} as const;
