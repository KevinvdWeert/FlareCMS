#!/usr/bin/env node
/*
 * Inject canonical FlareCMS users directly into a real Firebase project.
 *
 * Writes both:
 * 1) users/{uid}                -> app-authoritative profile + role
 * 2) users_by_name/{slug}/info/profile -> human-readable mirror structure
 */

const path = require('path');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const SERVICE_KEY_PATH = process.env.FIREBASE_SERVICE_ACCOUNT_KEY ||
  path.join(__dirname, 'serviceAccountKey.json');

// Read demo-user passwords from environment variables.
// For production runs, these MUST be set; for non-production the script will
// still require them but you can supply any values you choose.
const ADMIN_PASSWORD = process.env.INJECT_ADMIN_PASSWORD;
const EDITOR_PASSWORD = process.env.INJECT_EDITOR_PASSWORD;
const USER_PASSWORD = process.env.INJECT_USER_PASSWORD;

if (!ADMIN_PASSWORD || !EDITOR_PASSWORD || !USER_PASSWORD) {
  console.error(
    'Error: INJECT_ADMIN_PASSWORD, INJECT_EDITOR_PASSWORD, and INJECT_USER_PASSWORD ' +
    'environment variables must all be set before running this script.\n' +
    'Example:\n' +
    '  INJECT_ADMIN_PASSWORD=... INJECT_EDITOR_PASSWORD=... INJECT_USER_PASSWORD=... node scripts/inject_prod_users.js'
  );
  process.exit(1);
}

const USERS = [
  {
    email: 'admin@flarecms.dev',
    password: ADMIN_PASSWORD,
    fullName: 'Admin Flare',
    role: 'admin',
  },
  {
    email: 'editor@flarecms.dev',
    password: EDITOR_PASSWORD,
    fullName: 'Editor Flare',
    role: 'editor',
  },
  {
    email: 'user@flarecms.dev',
    password: USER_PASSWORD,
    fullName: 'User Flare',
    role: 'user',
  },
];

function slugifyName(input) { // create whitelist instead of blacklist to avoid issues with non-Latin chars
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

async function ensureUser(auth, spec) {
  let userRecord;
  try {
    userRecord = await auth.getUserByEmail(spec.email);
    await auth.updateUser(userRecord.uid, {
      password: spec.password,
      displayName: spec.fullName,
      disabled: false,
    });
  } catch (err) {
    if (err && err.code === 'auth/user-not-found') {
      userRecord = await auth.createUser({
        email: spec.email,
        password: spec.password,
        displayName: spec.fullName,
        emailVerified: true,
        disabled: false,
      });
    } else {
      throw err;
    }
  }

  await auth.setCustomUserClaims(userRecord.uid, { role: spec.role });
  return userRecord;
}

async function writeProfiles(db, userRecord, spec) {
  const now = FieldValue.serverTimestamp();

  // Authoritative profile the app and functions rely on
  await db.collection('users').doc(userRecord.uid).set(
    {
      email: spec.email,
      fullName: spec.fullName,
      displayName: spec.fullName,
      role: spec.role,
      createdAt: now,
      updatedAt: now,
      lastActiveAt: now,
      profileComplete: true,
      source: 'inject_prod_users',
    },
    { merge: true }
  );

  // Human-readable mirror requested by user
  const nameSlug = slugifyName(spec.fullName);
  const nameDoc = db.collection('users_by_name').doc(nameSlug);

  await nameDoc.set(
    {
      uid: userRecord.uid,
      fullName: spec.fullName,
      email: spec.email,
      role: spec.role,
      updatedAt: now,
    },
    { merge: true }
  );

  await nameDoc.collection('info').doc('profile').set(
    {
      uid: userRecord.uid,
      fullName: spec.fullName,
      email: spec.email,
      role: spec.role,
      updatedAt: now,
    },
    { merge: true }
  );
}

async function main() {
  if (!getApps().length) {
    initializeApp({ credential: cert(SERVICE_KEY_PATH) });
  }

  const auth = getAuth();
  const db = getFirestore();

  console.log('Injecting users into Firebase project...');

  for (const spec of USERS) {
    const record = await ensureUser(auth, spec);
    await writeProfiles(db, record, spec);
    console.log(`- ${spec.email} -> uid=${record.uid}, role=${spec.role}, fullName=${spec.fullName}`);
  }

  console.log('\nDone.');
  console.log('Authoritative docs: users/{uid}');
  console.log('Human-readable mirror: users_by_name/{full-name-slug}/info/profile');
}

main().catch((err) => {
  console.error('Injection failed:', err.message || err);
  process.exit(1);
});
