/**
 * Server-side validation utilities shared across Cloud Functions.
 */

export const ALLOWED_ROLES = ["user", "editor", "admin"] as const;
export type Role = (typeof ALLOWED_ROLES)[number];

export const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
] as const;

export const MAX_ASSET_BYTES = 10 * 1024 * 1024; // 10 MB

export const validateSlug = (slug: string): boolean =>
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test((slug || "").trim());

export const validateTitle = (title: string): boolean =>
  (title || "").trim().length >= 2;

export const validateRole = (role: string): role is Role =>
  (ALLOWED_ROLES as readonly string[]).includes(role);

export const sanitizeSlug = (raw: string): string =>
  (raw || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
