#!/usr/bin/env node
/**
 * FlareCMS Seed Script
 *
 * Populates the local Firestore emulator with development data so all
 * admin screens show real content immediately after starting emulators.
 *
 * Usage (against local emulator):
 *   FIRESTORE_EMULATOR_HOST=localhost:8080 node scripts/seed.js
 *
 * Usage (against production — use with extreme care):
 *   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json node scripts/seed.js --production
 */

const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const { v4: uuidv4 } = require('uuid');
const net = require('net');

const IS_PRODUCTION = process.argv.includes('--production');

if (!IS_PRODUCTION) {
  // Point at local emulators
  process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8080';
  process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || 'localhost:9099';
}

// Initialize Admin SDK
if (!getApps().length) {
  if (IS_PRODUCTION) {
    initializeApp(); // Uses ADC / GOOGLE_APPLICATION_CREDENTIALS
  } else {
    initializeApp({ projectId: 'flarecms-dev' });
  }
}

const db = getFirestore();
const auth = getAuth();

function checkPortOpen(host, port, timeoutMs = 1500) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let done = false;

    const finish = (ok) => {
      if (!done) {
        done = true;
        socket.destroy();
        resolve(ok);
      }
    };

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
    socket.connect(port, host);
  });
}

async function assertEmulatorsRunning() {
  const authUp = await checkPortOpen('127.0.0.1', 9099);
  const firestoreUp = await checkPortOpen('127.0.0.1', 8080);

  if (!authUp || !firestoreUp) {
    const missing = [
      !authUp ? 'Auth emulator (9099)' : null,
      !firestoreUp ? 'Firestore emulator (8080)' : null,
    ].filter(Boolean).join(', ');

    throw new Error(
      `Local emulators are not running: ${missing}. Start them first with \`npm run emulators\`.`
    );
  }
}

// ---------------------------------------------------------------------------
// Seed data definitions
// ---------------------------------------------------------------------------

const SEED_USERS = [
  {
    uid: 'seed-admin-001',
    email: 'admin@flarecms.dev',
    password: 'Admin1234!',
    fullName: 'Alice Admin',
    role: 'admin',
  },
  {
    uid: 'seed-editor-001',
    email: 'editor@flarecms.dev',
    password: 'Editor1234!',
    fullName: 'Bob Editor',
    role: 'editor',
  },
  {
    uid: 'seed-user-001',
    email: 'user@flarecms.dev',
    password: 'User1234!',
    fullName: 'Carol User',
    role: 'user',
  },
];

const SEED_PAGES = [
  {
    title: 'Welcome to FlareCMS',
    slug: 'welcome',
    status: 'published',
    blocks: [
      { id: uuidv4(), type: 'heading', level: 1, text: 'Welcome to FlareCMS' },
      {
        id: uuidv4(),
        type: 'paragraph',
        text: 'FlareCMS is a lightning-fast content management system built with React and Firebase.',
      },
    ],
    createdBy: 'seed-admin-001',
  },
  {
    title: 'About Us',
    slug: 'about',
    status: 'published',
    blocks: [
      { id: uuidv4(), type: 'heading', level: 1, text: 'About FlareCMS' },
      { id: uuidv4(), type: 'paragraph', text: 'We build great content experiences.' },
    ],
    createdBy: 'seed-editor-001',
  },
  {
    title: 'Draft: Upcoming Features',
    slug: 'upcoming-features',
    status: 'draft',
    blocks: [
      { id: uuidv4(), type: 'heading', level: 1, text: 'Coming Soon' },
      { id: uuidv4(), type: 'paragraph', text: 'Watch this space for exciting new features.' },
    ],
    createdBy: 'seed-admin-001',
  },
];

const SEED_ACTIVITY = [
  {
    actorId: 'seed-admin-001',
    actorEmail: 'admin@flarecms.dev',
    action: 'page_published',
    resourceType: 'page',
    meta: { title: 'Welcome to FlareCMS' },
  },
  {
    actorId: 'seed-editor-001',
    actorEmail: 'editor@flarecms.dev',
    action: 'page_created',
    resourceType: 'page',
    meta: { title: 'About Us', slug: 'about' },
  },
  {
    actorId: 'seed-admin-001',
    actorEmail: 'admin@flarecms.dev',
    action: 'role_change',
    resourceType: 'user',
    meta: { newRole: 'editor' },
  },
];

// ---------------------------------------------------------------------------
// Seed functions
// ---------------------------------------------------------------------------

async function seedUsers() {
  console.log('\n📋 Seeding users...');
  for (const u of SEED_USERS) {
    try {
      // Create or update Auth user
      try {
        await auth.createUser({
          uid: u.uid,
          email: u.email,
          password: u.password,
          displayName: u.fullName,
        });
        console.log(`  ✅ Auth user created: ${u.email}`);
      } catch (err) {
        if (err.code === 'auth/uid-already-exists' || err.code === 'auth/email-already-exists') {
          console.log(`  ⚠️  Auth user already exists: ${u.email}`);
        } else {
          throw err;
        }
      }

      // Set custom claims
      await auth.setCustomUserClaims(u.uid, { role: u.role });

      // Create/update Firestore user profile
      await db
        .collection('users')
        .doc(u.uid)
        .set(
          {
            email: u.email,
            fullName: u.fullName,
            displayName: u.fullName,
            role: u.role,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            lastActiveAt: FieldValue.serverTimestamp(),
            profileComplete: true,
          },
          { merge: true }
        );
      console.log(`  ✅ Firestore profile: ${u.email} (${u.role})`);
    } catch (err) {
      console.error(`  ❌ Failed for ${u.email}:`, err.message);
    }
  }
}

async function seedPages() {
  console.log('\n📄 Seeding pages...');
  const batch = db.batch();
  for (const p of SEED_PAGES) {
    const ref = db.collection('pages').doc();
    batch.set(ref, {
      ...p,
      featuredImage: null,
      updatedBy: p.createdBy,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      publishedAt: p.status === 'published' ? FieldValue.serverTimestamp() : null,
      version: 1,
    });
    console.log(`  ✅ Page: "${p.title}" (${p.status})`);
  }
  await batch.commit();
}

async function seedActivity() {
  console.log('\n📊 Seeding activity log...');
  const batch = db.batch();
  for (const entry of SEED_ACTIVITY) {
    const ref = db.collection('activityLog').doc();
    batch.set(ref, {
      ...entry,
      createdAt: FieldValue.serverTimestamp(),
    });
    console.log(`  ✅ Activity: ${entry.action}`);
  }
  await batch.commit();
}

async function seedSettings() {
  console.log('\n⚙️  Seeding settings...');
  await db.collection('settings').doc('general').set(
    {
      siteName: 'FlareCMS',
      siteDescription: 'A lightning-fast content management system.',
      inviteOnly: false,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  console.log('  ✅ General settings saved.');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`🌱 FlareCMS seed script starting (${IS_PRODUCTION ? 'PRODUCTION' : 'emulator'})…`);
  if (IS_PRODUCTION) {
    console.warn('⚠️  WARNING: Running against PRODUCTION. Ctrl+C to abort.');
    await new Promise((r) => setTimeout(r, 3000));
  } else {
    await assertEmulatorsRunning();
  }

  await seedUsers();
  await seedPages();
  await seedActivity();
  await seedSettings();

  console.log('\n✅ Seed complete!\n');
  console.log('Demo credentials:');
  SEED_USERS.forEach((u) => console.log(`  ${u.role.padEnd(8)} ${u.email}  /  ${u.password}`));
  console.log('');
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
