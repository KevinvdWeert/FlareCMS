# FlareCMS

A production-ready Content Management System built with React (Vite) and Firebase (Auth, Firestore, Storage, Cloud Functions).

## Architecture

```
FlareCMS/
├── apps/web/          # React + Vite frontend
├── functions/         # Firebase Cloud Functions (Node 20, TypeScript)
├── firebase/          # Firestore + Storage security rules
├── scripts/           # Seed and bootstrap scripts
├── firebase.json      # Firebase project config + emulator config
├── firestore.indexes.json
└── package.json       # Root scripts (emulators, deploy, seed)
```

## Features

- Public website with dynamic page routing (`/:slug`).
- Private admin dashboard (`/admin`).
- Block-based editor (Headings, Paragraphs, Images with Firebase Storage).
- Role-based access control (`admin`, `editor`, `user`) via Firebase custom claims + Firestore.
- Secure Firestore and Storage rules enforcing least privilege.
- Cloud Functions for all server-side operations (slug validation, role changes, dashboard stats).
- Last-admin guard: cannot demote the final admin.
- Audit log (`activityLog` collection) for all write operations.
- Media manager with real upload, list, and delete backed by Firestore metadata.
- Dashboard with real stats (published pages, draft pages, users, assets) and live activity feed.
- Invite-based user onboarding flow.
- Full local emulator support.

---

## Quick Start (Local Development with Emulators)

### Prerequisites

- Node.js 20+
- Firebase CLI: `npm install -g firebase-tools`

### 1. Clone and install dependencies

```bash
# Root (seed + deploy scripts)
npm install

# Cloud Functions
cd functions && npm install && npm run build && cd ..

# Frontend
cd apps/web && npm install && cd ..
```

### 2. Configure the frontend for emulators

```bash
cp apps/web/.env.example apps/web/.env.local
# Open apps/web/.env.local and set:
#   VITE_USE_EMULATORS=true
# All other VITE_FIREBASE_* values can be left as placeholders when using emulators.
```

### 3. Start emulators

```bash
# If command not found appears, run: npm install
npm run emulators
# Starts Auth (9099), Firestore (8080), Storage (9199), Functions (5001), Hosting (5000)
# Emulator UI at http://localhost:4000
```

### 4. Seed development data

In a separate terminal (while emulators are running):

```bash
npm run seed
```

If seeding fails:

- `Cannot find module 'firebase-admin/app'`:
	run `npm install` at repo root (the seed script depends on root packages).
- `ECONNREFUSED` while creating users:
	Auth emulator is not running on `localhost:9099`. Start emulators first with `npm run emulators`.

This creates four demo users:
| Role    | Email                    | Password       |
|---------|--------------------------|----------------|
| admin   | admin@flarecms.dev       | Admin1234!     |
| editor  | editor@flarecms.dev      | Editor1234!    |
| writer  | writer@flarecms.dev      | Writer1234!    |
| user    | user@flarecms.dev        | User1234!      |

These credentials are not automatically created in production Firebase projects.

### 5. Start the frontend dev server

```bash
npm run web:dev
# Open http://localhost:5173
# Admin login: http://localhost:5173/admin/login
```

### 6. Optional: run web + local upload server together

```bash
npm run dev
# Starts Vite frontend and local upload server concurrently
# Upload server: http://localhost:3001
```

The local upload server is useful for self-hosted/local image uploads via:

- `POST /api/upload-image`
- `GET /images/:file`

---

## Production Setup

### 1. Create a Firebase project

1. Go to [Firebase Console](https://console.firebase.google.com/) and create a project.
2. Enable **Firestore** (Native mode), **Authentication** (Email/Password), **Storage**, and **Cloud Functions**.

### 2. Set project ID

Edit `.firebaserc`:
```json
{ "projects": { "default": "your-actual-project-id" } }
```

### 3. Configure frontend environment

```bash
cp apps/web/.env.example apps/web/.env.local
# Fill in all VITE_FIREBASE_* values from Firebase Console > Project Settings > Your Apps
# Leave VITE_USE_EMULATORS unset or false

# Optional but recommended for SEO artifacts generated during build:
export SITE_URL=https://your-domain.com
```

### 4. Deploy everything

```bash
npm run deploy
```

`npm run web:build` now also generates SEO artifacts in `apps/web/dist`:

- prerendered HTML files for `/` and each published `/:slug` page
- canonical + Open Graph + Twitter meta tags in initial HTML
- `sitemap.xml`
- `robots.txt`

Or step by step:
```bash
npm run deploy:rules     # Firestore + Storage rules
npm run deploy:cors      # Apply Storage CORS config from firebase/cors.json
npm run deploy:indexes   # Firestore indexes
npm run deploy:functions # Cloud Functions
npm run deploy:hosting   # Frontend
```

### 5. Bootstrap the first admin

```bash
pip install firebase-admin
export FIREBASE_SERVICE_ACCOUNT_KEY=/path/to/serviceAccountKey.json
python scripts/bootstrap_admin.py admin@example.com
```

### 6. Inject default users directly (no emulators)

```bash
npm run inject:users
```

This creates/updates these Auth users with roles and profile documents:

| Role    | Email               | Password    |
|---------|---------------------|-------------|
| admin   | admin@flarecms.dev  | Admin1234!  |
| editor  | editor@flarecms.dev | Editor1234! |
| writer  | writer@flarecms.dev | Writer1234! |
| user    | user@flarecms.dev   | User1234!   |

Note: local emulator seeding (`npm run seed`) currently creates `admin`, `editor`, and `user` accounts. The `writer` account is created by `npm run inject:users`.

Firestore writes include:

- `users/{uid}` (authoritative app profile)
- `users_by_name/{full-name-slug}/info/profile` (human-readable mirror)

---

## Data Model

### `users/{uid}`
| Field | Type | Description |
|-------|------|-------------|
| email | string | User email |
| fullName | string | Full name |
| displayName | string | Backward-compatible display name mirror |
| role | `user` \| `editor` \| `admin` | Access role |
| createdAt | timestamp | Account creation |
| updatedAt | timestamp | Last profile update |

Note: `users` document IDs should remain the Firebase Auth `uid`. Do not use full name as the document ID; names are not unique and can change.

### `pages/{pageId}`
| Field | Type | Description |
|-------|------|-------------|
| title | string | Page title |
| slug | string | Unique URL slug |
| status | `draft` \| `published` | Publishing state |
| blocks | array | Content blocks |
| createdBy | uid | Author |
| version | number | Concurrency counter |

### `mediaAssets/{assetId}`
| Field | Type | Description |
|-------|------|-------------|
| storagePath | string | Firebase Storage path |
| fileName | string | Original file name |
| mimeType | string | MIME type |
| sizeBytes | number? | File size |
| ownerId | uid | Uploader |
| usedInPages | uid[] | Pages using this asset |

### `activityLog/{entryId}`
Append-only audit log. Written by Cloud Functions only (client writes denied).

### `invites/{inviteId}`
Admin-created invite tokens (7-day expiry).

---

## Cloud Functions Reference

| Function | Role | Description |
|----------|------|-------------|
| `onUserCreated` | system trigger | Creates/updates profile defaults when an Auth user is created |
| `onUserDeleted` | system trigger | Cleans up profile-linked data when an Auth user is deleted |
| `refreshClaims` | any | Re-sync custom claims from Firestore |
| `setUserRole` | admin | Change role; enforces last-admin guard |
| `listUsers` | admin | Paginated user list |
| `createInvite` | admin | Creates invite token |
| `acceptInvite` | any | Redeems invite token |
| `checkSlug` | staff | Returns `{taken, valid}` for a slug |
| `createPage` | staff | Server-validated page creation |
| `updatePage` | staff | Server-validated page update |
| `deletePage` | staff | Deletes a page |
| `publishPage` | staff | Sets status to published |
| `unpublishPage` | staff | Sets status to draft |
| `setFrontPage` | staff | Sets which page is used as the public homepage |
| `registerMediaAsset` | staff | Saves upload metadata |
| `listMediaAssets` | staff | Paginated asset list |
| `deleteMediaAsset` | staff | Deletes asset + storage file |
| `attachAssetToPage` | staff | Marks a media asset as used by a page |
| `detachAssetFromPage` | staff | Removes a page usage reference from an asset |
| `getDashboardStats` | staff | Cached aggregate stats (5 min TTL) |
| `getRecentActivity` | staff | Last N activity log entries |
| `getTrafficSummary` | staff | Traffic placeholder |
| `saveGlobalSettings` | staff | Saves editable site-wide settings |
| `restoreSettingsVersion` | staff | Restores a previous settings revision |
| `getSettingsHistory` | staff | Lists previous settings revisions |
| `publishStagingSettings` | staff | Promotes staged settings to live |

---

## Quality Checks

Run these before opening a PR:

```bash
cd functions
npm run lint
npm test
```

---

## Security Model

- Firestore rules enforce per-role access; see `firebase/firestore.rules`.
- Storage rules enforce role+ownership checks; see `firebase/storage.rules`.
- Role changes happen **only** through `setUserRole` Cloud Function.
- The last admin cannot be demoted (server-side guard).
- All write operations are logged to `activityLog`.

---

## Rollback

```bash
# Roll back rules from git
git checkout <previous-sha> -- firebase/firestore.rules firebase/storage.rules
npm run deploy:rules

# Roll back hosting
firebase hosting:clone SOURCE_SITE:SOURCE_CHANNEL TARGET_SITE:live
```

---

## Known Limitations & Next Steps

1. **Traffic analytics** — `getTrafficSummary` returns placeholder data. Integrate Google Analytics Data API.
2. **Image dimensions** — A Storage trigger function can extract dimensions via `sharp` and write them to `mediaAssets`.
3. **Email for invites** — Wire up Firebase Extensions (Trigger Email) or SendGrid.
4. **Rate limiting** — Add Firebase App Check for stronger client verification.
